import { beforeEach, describe, expect, it, vi } from "vitest";

const OPERATOR = "admin.choliempresas@gmail.com";
const SECRET_TOKEN_SIGNATURE = "firma-secreta-que-nunca-debe-registrarse";

type Fake = {
  getUserError?: { name?: string; status?: number; code?: string } | null;
  user?: { id: string; email?: string; email_confirmed_at?: string | null; is_anonymous?: boolean } | null;
  accessToken?: string | null;
  access?: { data?: unknown; error?: { message: string } | null };
  operatorEmail?: boolean | "throw";
};
const calls: string[] = [];
let fake: Fake = {};

vi.mock("@/lib/supabase/server", () => ({
  serverDb: async () => ({
    auth: {
      getUser: async () =>
        fake.getUserError ? { data: { user: null }, error: fake.getUserError } : { data: { user: fake.user ?? null }, error: null },
      getSession: async () => ({ data: { session: fake.accessToken ? { access_token: fake.accessToken } : null } }),
    },
    rpc: async (fn: string) => {
      calls.push(fn);
      if (fn === "platform_access") return fake.access ?? { data: { ok: true, mfa_recent: true, email: OPERATOR }, error: null };
      return { data: { done: true }, error: null };
    },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  adminDb: () => {
    if (fake.operatorEmail === "throw") throw new Error("TEAM_ADMIN_NOT_CONFIGURED");
    return {
      rpc: async () => ({ data: fake.operatorEmail === true, error: null }),
      auth: { admin: { deleteUser: async () => ({ error: null }), updateUserById: async () => ({ error: null }) } },
    };
  },
}));

import { guardPlatformRequest, unverifiedEmailOf } from "@/lib/platform/guard";
import { clientIpOf, requestIdOf, setPlatformLogSink } from "@/lib/platform/log";
import { GET as dataGet } from "@/app/api/platform-admin/data/route";
import { POST as commandsPost } from "@/app/api/platform-admin/commands/route";
import { POST as panelCommands } from "@/app/api/panel/commands/route";
import { GET as panelData } from "@/app/api/panel/data/route";

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const tokenFor = (email: string) => `${b64({ alg: "ES256" })}.${b64({ email, sub: "u1" })}.${SECRET_TOKEN_SIGNATURE}`;
const good = { id: "u1", email: OPERATOR, email_confirmed_at: "2026-01-01T00:00:00Z", is_anonymous: false };
const UUID = "30000000-0000-4000-8000-000000000001";
const req = (path: string, init: RequestInit & { origin?: string } = {}) =>
  new Request(`https://panel.test${path}`, {
    method: init.method ?? "GET",
    headers: { "x-request-id": "req-abc-123", "cf-connecting-ip": "203.0.113.5", origin: init.origin ?? "https://panel.test", "content-type": "application/json", authorization: "Bearer " + SECRET_TOKEN_SIGNATURE, ...(init.headers as object) },
    body: init.body,
  });

let logs: string[] = [];
beforeEach(() => {
  calls.length = 0;
  logs = [];
  fake = { user: good, accessToken: tokenFor(OPERATOR), operatorEmail: true };
  process.env.APP_ORIGIN = "https://panel.test";
  setPlatformLogSink((line) => logs.push(line));
});

describe("guard del panel: cada petición", () => {
  it("sin sesión → 404 (nunca 401/403) y registro estructurado con IP, ruta e id de la petición", async () => {
    fake = { getUserError: { name: "AuthSessionMissingError" } };
    const g = await guardPlatformRequest(req("/api/platform-admin/data?view=overview"), { sensitive: false });
    expect(g.ok).toBe(false);
    if (g.ok) return;
    expect(g.response.status).toBe(404);
    expect(await g.response.json()).toEqual({ error: "NOT_FOUND" });
    expect(JSON.parse(logs[0])).toMatchObject({ event: "platform_access_denied", reason: "no_session", requestId: "req-abc-123", ip: "203.0.113.5", path: "/api/platform-admin/data", method: "GET" });
    expect(calls).toEqual([]);
  });

  it("sesión revocada: SESSION_REVOKED solo si el token era del operador; para cualquier otra cuenta, 404", async () => {
    fake = { getUserError: { name: "AuthApiError", status: 403, code: "session_not_found" }, accessToken: tokenFor(OPERATOR), operatorEmail: true };
    const operator = await guardPlatformRequest(req("/x"), { sensitive: false });
    if (operator.ok) throw new Error("debía denegar");
    expect(operator.response.status).toBe(401);
    expect(await operator.response.json()).toMatchObject({ error: "SESSION_REVOKED" });
    expect(JSON.parse(logs[0]).reason).toBe("session_revoked_operator");

    fake = { getUserError: { name: "AuthApiError", status: 403, code: "session_not_found" }, accessToken: tokenFor("otra@ejemplo.com"), operatorEmail: false };
    const other = await guardPlatformRequest(req("/x"), { sensitive: false });
    if (other.ok) throw new Error("debía denegar");
    expect(other.response.status).toBe(404);
    expect(JSON.parse(logs[1]).reason).toBe("session_revoked_other");

    // Sin la clave de servicio no se puede saber: se cierra con 404 (nunca se abre).
    fake = { getUserError: { name: "AuthApiError", status: 401, code: "bad_jwt" }, accessToken: tokenFor(OPERATOR), operatorEmail: "throw" };
    const closed = await guardPlatformRequest(req("/x"), { sensitive: false });
    if (closed.ok) throw new Error("debía denegar");
    expect(closed.response.status).toBe(404);
    // Token ilegible: 404.
    fake = { getUserError: { name: "AuthApiError", status: 401 }, accessToken: "no-es-un-jwt", operatorEmail: true };
    const garbage = await guardPlatformRequest(req("/x"), { sensitive: false });
    if (garbage.ok) throw new Error("debía denegar");
    expect(garbage.response.status).toBe(404);
  });

  it("correo sin verificar o sesión anónima → 404 sin consultar a la base", async () => {
    for (const user of [{ ...good, email_confirmed_at: null }, { ...good, is_anonymous: true }, { ...good, email: undefined }]) {
      fake = { user };
      const g = await guardPlatformRequest(req("/x"), { sensitive: false });
      if (g.ok) throw new Error("debía denegar");
      expect(g.response.status).toBe(404);
    }
    expect(calls).toEqual([]);
    expect(logs.map((l) => JSON.parse(l).reason)).toEqual(["email_unverified", "email_unverified", "email_unverified"]);
  });

  it("la base decide: NOT_FOUND → 404; REAUTH_REQUIRED → 401 solo para quien ya es el operador; ok → contexto", async () => {
    fake = { user: good, access: { error: { message: "NOT_FOUND" } } };
    const notOp = await guardPlatformRequest(req("/x", { method: "POST" }), { sensitive: true });
    if (notOp.ok) throw new Error("debía denegar");
    expect(notOp.response.status).toBe(404);
    expect(JSON.parse(logs[0]).reason).toBe("not_operator");

    fake = { user: good, access: { error: { message: "REAUTH_REQUIRED" } } };
    const reauth = await guardPlatformRequest(req("/x", { method: "POST" }), { sensitive: true });
    if (reauth.ok) throw new Error("debía pedir reautenticación");
    expect(reauth.response.status).toBe(401);
    expect(await reauth.response.json()).toMatchObject({ error: "REAUTH_REQUIRED" });

    fake = { user: good };
    const ok = await guardPlatformRequest(req("/x"), { sensitive: true });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.ctx).toMatchObject({ meta: { requestId: "req-abc-123", ip: "203.0.113.5" }, mfaRecent: true });
    expect(calls.filter((c) => c === "platform_access")).toHaveLength(3);
  });

  it("una falla transitoria del proveedor es 503, no 404 ni acceso", async () => {
    fake = { getUserError: { name: "AuthRetryableFetchError", status: 502 } };
    const g = await guardPlatformRequest(req("/x"), { sensitive: false });
    if (g.ok) throw new Error("debía fallar");
    expect(g.response.status).toBe(503);
  });

  it("los registros no contienen el token, las cookies, el correo ni el cuerpo", async () => {
    fake = { getUserError: { name: "AuthApiError", status: 403, code: "session_not_found" }, accessToken: tokenFor(OPERATOR), operatorEmail: true };
    await guardPlatformRequest(req("/api/platform-admin/commands", { method: "POST", body: JSON.stringify({ password: "super-secreta" }) }), { sensitive: true });
    fake = { user: { ...good, email_confirmed_at: null } };
    await guardPlatformRequest(req("/x", { headers: { cookie: "sb-token=cookie-secreta" } }), { sensitive: false });
    const all = logs.join("\n");
    for (const secret of [SECRET_TOKEN_SIGNATURE, "cookie-secreta", "super-secreta", OPERATOR, "Bearer"]) expect(all).not.toContain(secret);
    expect(Object.keys(JSON.parse(logs[0])).sort()).toEqual(["at", "event", "ip", "level", "method", "path", "reason", "requestId"]);
  });

  it("identificador de petición e IP: se aceptan solo valores seguros", () => {
    const withId = (id: string) => new Request("https://x.test", { headers: { "x-request-id": id } });
    expect(requestIdOf(withId("abc-123_X.9"))).toBe("abc-123_X.9");
    expect(requestIdOf(withId("malo id{}"))).toMatch(/^[0-9a-f-]{36}$/);
    expect(requestIdOf(new Request("https://x.test"))).toMatch(/^[0-9a-f-]{36}$/);
    const ip = (h: Record<string, string>) => clientIpOf(new Request("https://x.test", { headers: h }));
    expect(ip({ "cf-connecting-ip": "198.51.100.7", "x-forwarded-for": "1.2.3.4" })).toBe("198.51.100.7");
    expect(ip({ "x-forwarded-for": "2001:db8::1, 10.0.0.1" })).toBe("2001:db8::1");
    expect(ip({ "x-forwarded-for": "<script>" })).toBe("unknown");
    expect(ip({})).toBe("unknown");
  });

  it("el correo del token se lee sin verificar y solo para elegir un mensaje", () => {
    expect(unverifiedEmailOf(tokenFor("Admin@X.com"))).toBe("admin@x.com");
    expect(unverifiedEmailOf("basura")).toBeNull();
    expect(unverifiedEmailOf(null)).toBeNull();
  });
});

const dataViews = [
  "overview",
  "organizations",
  `organization&id=${UUID}`,
  `inventory&id=${UUID}`,
  "venues",
  `venue&id=${UUID}`,
  `venue_menu&id=${UUID}`,
  "users",
  "audit",
];
const commands: Record<string, unknown>[] = [
  { command: "onboard", organization: {}, venue: {}, owner: {} },
  { command: "org_update", id: UUID, values: {} },
  { command: "org_status", id: UUID, status: "suspended", reason: "motivo largo" },
  { command: "org_delete", id: UUID, confirmSlug: "x" },
  { command: "venue_create", organizationId: UUID, venue: {} },
  { command: "venue_update", id: UUID, values: {} },
  { command: "venue_status", id: UUID, action: "publish" },
  { command: "venue_delete", id: UUID, confirmSlug: "x" },
  { command: "invitation_create", organizationId: UUID, email: "a@b.co", role: "admin" },
  { command: "invitation_revoke", id: UUID },
  { command: "user", action: "delete", userId: UUID },
];

describe("API del panel: TODAS las rutas y acciones", () => {
  const asConsumer = () => {
    fake = { user: { id: "c1", email: "consumidor@ejemplo.com", email_confirmed_at: "2026-01-01T00:00:00Z", is_anonymous: false }, access: { error: { message: "NOT_FOUND" } } };
  };

  it("una cuenta que no es el operador recibe 404 en cada lectura, aun con datos inválidos", async () => {
    asConsumer();
    for (const view of dataViews) {
      const res = await dataGet(req(`/api/platform-admin/data?view=${view}`));
      expect(res.status, view).toBe(404);
      expect(await res.json()).toEqual({ error: "NOT_FOUND" });
    }
    expect((await dataGet(req("/api/platform-admin/data?view=cualquier-cosa"))).status).toBe(404);
    expect((await dataGet(req("/api/platform-admin/data"))).status).toBe(404);
    expect(calls.every((c) => c === "platform_access")).toBe(true);
  });

  it("una cuenta que no es el operador recibe 404 en cada acción, aun con origen ajeno o cuerpo inválido, y nada se ejecuta", async () => {
    asConsumer();
    for (const body of commands) {
      for (const origin of ["https://panel.test", "https://evil.test"]) {
        const res = await commandsPost(req("/api/platform-admin/commands", { method: "POST", body: JSON.stringify(body), origin }));
        expect(res.status, `${body.command} @ ${origin}`).toBe(404);
      }
    }
    expect((await commandsPost(req("/api/platform-admin/commands", { method: "POST", body: "no es json" }))).status).toBe(404);
    expect(calls.every((c) => c === "platform_access")).toBe(true);
  });

  it("con sesión revocada del operador, cada ruta responde SESSION_REVOKED", async () => {
    fake = { getUserError: { name: "AuthApiError", status: 403, code: "session_not_found" }, accessToken: tokenFor(OPERATOR), operatorEmail: true };
    const r1 = await dataGet(req("/api/platform-admin/data?view=overview"));
    const r2 = await commandsPost(req("/api/platform-admin/commands", { method: "POST", body: JSON.stringify(commands[1]) }));
    for (const r of [r1, r2]) {
      expect(r.status).toBe(401);
      expect(await r.json()).toMatchObject({ error: "SESSION_REVOKED" });
    }
  });

  it("cada acción sensible sin segundo factor reciente responde REAUTH_REQUIRED y no ejecuta nada", async () => {
    fake = { user: good, access: { error: { message: "REAUTH_REQUIRED" } } };
    for (const body of commands) {
      const res = await commandsPost(req("/api/platform-admin/commands", { method: "POST", body: JSON.stringify(body) }));
      expect(res.status, String(body.command)).toBe(401);
      expect(await res.json()).toMatchObject({ error: "REAUTH_REQUIRED" });
    }
    expect(calls.every((c) => c === "platform_access")).toBe(true);
    // La lectura no pide segundo factor: la comprobación de lectura no es sensible.
    fake = { user: good };
    expect((await dataGet(req("/api/platform-admin/data?view=overview"))).status).toBe(200);
  });

  it("el operador con segundo factor ejecuta la acción; con origen ajeno se rechaza (403, solo él lo ve)", async () => {
    fake = { user: good };
    const ok = await commandsPost(req("/api/platform-admin/commands", { method: "POST", body: JSON.stringify({ command: "invitation_revoke", id: UUID }) }));
    expect(ok.status).toBe(200);
    const foreign = await commandsPost(req("/api/platform-admin/commands", { method: "POST", body: JSON.stringify({ command: "invitation_revoke", id: UUID }), origin: "https://evil.test" }));
    expect(foreign.status).toBe(403);
    const bad = await commandsPost(req("/api/platform-admin/commands", { method: "POST", body: JSON.stringify({ command: "inventada" }) }));
    expect(bad.status).toBe(422);
  });

  it("las rutas del panel de empresa exigen sesión viva y origen propio", async () => {
    fake = { getUserError: { name: "AuthSessionMissingError" } };
    expect((await panelData(req("/api/panel/data?view=my"))).status).toBe(401);
    const noSession = await panelCommands(req("/api/panel/commands", { method: "POST", body: JSON.stringify({ command: "invitation_revoke", id: UUID }) }));
    expect(noSession.status).toBe(401);
    fake = { user: good };
    const foreign = await panelCommands(req("/api/panel/commands", { method: "POST", body: JSON.stringify({ command: "invitation_revoke", id: UUID }), origin: "https://evil.test" }));
    expect(foreign.status).toBe(403);
  });
});
