import { describe, it, expect } from "vitest";
import { decideAccess, safeNext, accountsRequired } from "@/lib/access-policy";
const none = { kind: "none", onboarded: false } as const;
const guest = { kind: "guest", onboarded: false } as const;
const fresh = { kind: "customer", onboarded: false } as const;
const customer = { kind: "customer", onboarded: true } as const;
const staff = { kind: "staff", onboarded: false } as const;
describe("política de acceso", () => {
  it("sin sesión (o invitado) todo el área cliente pide acceso y conserva el destino del QR", () => {
    for (const p of [
      "/",
      "/v/sala-norte",
      "/cart",
      "/checkout",
      "/orders",
      "/cuenta",
    ])
      expect(decideAccess(p, none)).toBe(
        `/acceso?next=${encodeURIComponent(p)}`,
      );
    expect(decideAccess("/v/sala-norte", guest)).toContain("/acceso?next=");
  });
  it("cliente sin onboarding va a completar su perfil conservando destino", () => {
    expect(decideAccess("/v/patio", fresh)).toBe(
      "/onboarding?next=%2Fv%2Fpatio",
    );
    expect(decideAccess("/onboarding", fresh)).toBeNull();
    expect(decideAccess("/onboarding", customer)).toBe("/");
  });
  it("con sesión vigente se entra directo y el acceso redirige", () => {
    expect(decideAccess("/v/patio", customer)).toBeNull();
    expect(decideAccess("/acceso", customer)).toBe("/");
  });
  it("cuenta laboral nunca compra y no se cierra sola: ofrece continuar o cambiar", () => {
    for (const p of ["/", "/v/x", "/checkout", "/acceso", "/onboarding"])
      expect(decideAccess(p, staff)).toBe("/sesion-activa?want=cliente");
    expect(decideAccess("/staff/abc", staff)).toBeNull();
    expect(decideAccess("/admin/abc", staff)).toBeNull();
    expect(decideAccess("/equipo/acceso", staff)).toBeNull();
  });
  it("cuenta personal no entra al portal laboral y tampoco se cierra sola", () => {
    expect(decideAccess("/staff/abc", customer)).toBe(
      "/sesion-activa?want=equipo",
    );
    expect(decideAccess("/admin/abc", customer)).toBe(
      "/sesion-activa?want=equipo",
    );
    expect(decideAccess("/equipo/acceso", customer)).toBe(
      "/sesion-activa?want=equipo",
    );
    expect(decideAccess("/staff/abc", none)).toBe(
      "/equipo/acceso?next=%2Fstaff%2Fabc",
    );
  });
  it("/login histórico y rutas públicas", () => {
    expect(decideAccess("/login", none)).toBe("/equipo/acceso");
    expect(decideAccess("/acceso", none)).toBeNull();
    expect(decideAccess("/policies", none)).toBeNull();
    expect(decideAccess("/sesion-activa", none)).toBe("/acceso");
  });
  it("safeNext solo acepta rutas relativas del sitio", () => {
    expect(safeNext("/v/sala")).toBe("/v/sala");
    for (const bad of [
      "//evil.com",
      "https://evil.com",
      "/\\evil",
      "javascript:1",
      null,
      undefined,
      "",
    ])
      expect(safeNext(bad as string | null)).toBe("/");
  });
  it("sin la bandera el demo conserva el flujo invitado", () => {
    expect(accountsRequired({})).toBe(false);
    expect(accountsRequired({ ACCOUNTS_REQUIRED: "true" })).toBe(true);
  });
  it("una cuenta del equipo con contraseña temporal pendiente solo puede cambiarla", () => {
    const pending = {
      kind: "staff",
      onboarded: false,
      mustChangePassword: true,
    } as const;
    for (const p of ["/staff/x", "/admin/x", "/onza", "/equipo/locales"])
      expect(decideAccess(p, pending)).toBe("/equipo/clave");
    expect(decideAccess("/equipo/clave", pending)).toBeNull();
    expect(decideAccess("/staff/x", staff)).toBeNull();
    expect(decideAccess("/equipo/locales", staff)).toBeNull();
  });
  it("el cambio de clave y los locales del equipo no están abiertos a clientes ni a quien no inició sesión", () => {
    expect(decideAccess("/equipo/clave", customer)).toBe(
      "/sesion-activa?want=equipo",
    );
    expect(decideAccess("/equipo/locales", none)).toBe(
      `/equipo/acceso?next=${encodeURIComponent("/equipo/locales")}`,
    );
  });
});
