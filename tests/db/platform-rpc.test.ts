import { createHash, randomBytes } from "node:crypto";
import { describe, it, expect } from "vitest";
import { command, createInput, database, ids, actor } from "./helpers";
import { OPERATOR_EMAIL, account, as, asOperator, call, owner, type Db } from "./platform-helpers";

const hashOf = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");
const ZERO = "00000000-0000-4000-8000-000000000000";
const meta = { requestId: "req-123", ip: "203.0.113.7" };

const onboardInput = (extra: { slug?: string; venueSlug?: string; email?: string; token?: string } = {}) => ({
  organization: { name: "Bar Central S.A.", slug: extra.slug ?? "bar-central", legal_name: "Bar Central Sociedad Anónima", tax_id: "3101123456", country: "CR", contact_phone: "+50688887777" },
  venue: { name: "Bar Central Escazú", slug: extra.venueSlug ?? "bar-central-escazu", zone: "Escazú" },
  owner: { email: extra.email ?? "dueno@barcentral.test", tokenHash: hashOf(extra.token ?? newToken()) },
  meta,
});

type Onboarded = { organization_id: string; venue_id: string; invitation_id: string };
async function onboard(db: Db, extra: Parameters<typeof onboardInput>[0] = {}) {
  await asOperator(db);
  return call<Onboarded>(db, "platform_onboard", onboardInput(extra));
}

/** Acepta una invitación como el servidor: crea la cuenta (correo confirmado) y llama a la función de servicio. */
async function acceptAs(db: Db, token: string, email: string, id?: string) {
  const uid = await account(db, email, true, id);
  await db.exec("reset role");
  await db.query("select public.invitation_accept($1,$2)", [hashOf(token), uid]);
  return uid;
}

/** Empresa con propietario activo (y su cuenta). */
async function company(db: Db, slug: string, email: string) {
  const token = newToken();
  const o = await onboard(db, { slug, venueSlug: `${slug}-local`, email, token });
  const owner_id = await acceptAs(db, token, email);
  await owner(db, `update public.venues set publication_status='published' where id='${o.venue_id}'`);
  return { ...o, owner_id, email };
}

describe("panel: matriz de seguridad de TODAS las funciones de plataforma", () => {
  const reads: [string, unknown[]][] = [
    ["platform_overview", [{}]],
    ["platform_orgs_list", [{}]],
    ["platform_org_get", [ZERO]],
    ["platform_org_inventory", [ZERO]],
    ["platform_venues_list", [{}]],
    ["platform_venue_get", [ZERO]],
    ["platform_venue_menu", [ZERO]],
    ["platform_users_list", [{}]],
    ["platform_audit_list", [{}]],
  ];
  const writes: [string, unknown[]][] = [
    ["platform_onboard", [{}]],
    ["platform_org_update", [{}]],
    ["platform_org_set_status", [{}]],
    ["platform_org_delete", [{}]],
    ["platform_venue_create", [{}]],
    ["platform_venue_update", [{}]],
    ["platform_venue_set_status", [{}]],
    ["platform_venue_delete", [{}]],
    ["platform_invitation_create", [{}]],
    ["platform_invitation_revoke", [{}]],
    ["platform_user_target", [ZERO]],
    ["platform_user_record", [{}]],
  ];

  it("cuentas que no son el operador reciben NOT_FOUND, con cualquier argumento, incluso con un segundo factor fresco", async () => {
    const db = await database();
    try {
      const c = await company(db, "seguridad", "dueno@seguridad.test");
      await owner(db, `insert into auth.users(id,email,email_confirmed_at) values('${ids.customer}','consumidor@ejemplo.com',now()) on conflict(id) do update set email=excluded.email`);
      const unverified = await account(db, OPERATOR_EMAIL, false, "10000000-0000-4000-8000-0000000000e1");
      const other = await account(db, "otro@ejemplo.com");
      const sessions: [string, string, string | null][] = [
        ["dueño de empresa", c.owner_id, c.email],
        ["consumidor", ids.customer, "consumidor@ejemplo.com"],
        ["correo del operador sin verificar", unverified, OPERATOR_EMAIL],
        ["otro correo", other, "otro@ejemplo.com"],
      ];
      for (const [label, id, email] of sessions)
        for (const [fn, args] of [...reads, ...writes]) {
          await as(db, id, email, { aal: "aal2", mfaMinutesAgo: 0 });
          await expect(call(db, fn, ...args), `${label} → ${fn}`).rejects.toThrow(/NOT_FOUND/);
        }
    } finally {
      await db.close();
    }
  });

  it("el operador sin segundo factor lee, pero toda acción sensible pide REAUTH_REQUIRED", async () => {
    const db = await database();
    try {
      for (const [fn, args] of reads) {
        await asOperator(db, { aal: "aal1" });
        // Puede fallar por datos (NOT_FOUND del recurso), pero nunca por REAUTH_REQUIRED.
        await call(db, fn, ...args).catch((e: Error) => expect(String(e.message)).not.toMatch(/REAUTH_REQUIRED/));
      }
      for (const [fn, args] of writes) {
        await asOperator(db, { aal: "aal1" });
        await expect(call(db, fn, ...args), fn).rejects.toThrow(/REAUTH_REQUIRED/);
        await asOperator(db, { aal: "aal2", mfaMinutesAgo: 16 });
        await expect(call(db, fn, ...args), `${fn} con 2º factor viejo`).rejects.toThrow(/REAUTH_REQUIRED/);
      }
    } finally {
      await db.close();
    }
  });

  it("los roles público y anónimo no pueden ejecutar ninguna función del panel", async () => {
    const db = await database();
    try {
      await db.exec("reset role");
      await db.exec("set role anon");
      for (const [fn] of [...reads, ...writes]) await expect(db.query(`select public.${fn}()`)).rejects.toThrow(/permission denied|does not exist|function/);
      await db.exec("reset role");
      await db.exec("set role anon");
      await expect(db.query("select public.platform_overview('{}'::jsonb)")).rejects.toThrow(/permission denied/);
      await expect(db.query("select public.invitation_lookup('x')")).rejects.toThrow(/permission denied/);
    } finally {
      await db.close();
    }
  });
});

describe("panel: alta atómica de empresa, local y propietario", () => {
  it("crea empresa, local en borrador e invitación del propietario, y deja auditoría con la petición", async () => {
    const db = await database();
    try {
      const o = await onboard(db);
      const [v] = await owner<{ publication_status: string; demo_listed: boolean; organization_id: string }>(db, "select publication_status,demo_listed,organization_id from public.venues where id=$1", [o.venue_id]);
      expect(v).toEqual({ publication_status: "draft", demo_listed: false, organization_id: o.organization_id });
      const [inv] = await owner<{ role: string; email: string; token_hash: string }>(db, "select role,email,token_hash from public.org_invitations where id=$1", [o.invitation_id]);
      expect(inv).toMatchObject({ role: "owner", email: "dueno@barcentral.test" });
      expect(inv.token_hash).toMatch(/^[0-9a-f]{64}$/);
      expect((await owner(db, "select 1 from private.organization_secrets where organization_id=$1", [o.organization_id]))).toHaveLength(1);
      await asOperator(db);
      const audit = await call<{ action: string; request_id: string; ip: string; details: Record<string, unknown> }[]>(db, "platform_audit_list", {});
      expect(audit[0]).toMatchObject({ action: "organization.onboard", request_id: "req-123", ip: "203.0.113.7" });
      expect(JSON.stringify(audit)).not.toMatch(/token/i);
    } finally {
      await db.close();
    }
  });

  it("es atómica: si algo falla no queda nada a medias", async () => {
    const db = await database();
    try {
      await onboard(db);
      await asOperator(db);
      // El local repite un slug existente: la empresa tampoco debe quedar creada.
      await expect(call(db, "platform_onboard", onboardInput({ slug: "otra-empresa", venueSlug: "bar-central-escazu", email: "otro@x.test" }))).rejects.toThrow(/SLUG_TAKEN/);
      await expect(call(db, "platform_onboard", onboardInput({ slug: "bar-central", venueSlug: "otro-local", email: "otro@x.test" }))).rejects.toThrow(/SLUG_TAKEN/);
      await expect(call(db, "platform_onboard", onboardInput({ slug: "tercera", venueSlug: "tercer-local", email: "no-es-correo" }))).rejects.toThrow(/INVALID_EMAIL/);
      const bad = onboardInput({ slug: "cuarta", venueSlug: "cuarto-local" });
      (bad.owner as { tokenHash: string }).tokenHash = "no-es-un-hash";
      await expect(call(db, "platform_onboard", bad)).rejects.toThrow(/INVALID_INPUT/);
      await expect(call(db, "platform_onboard", onboardInput({ slug: "Mal Slug", venueSlug: "ok-local", email: "a@b.co" }))).rejects.toThrow(/INVALID_INPUT/);
      const rows = await owner<{ slug: string }>(db, "select slug from public.organizations order by slug");
      expect(rows.map((r) => r.slug)).toEqual(["bar-central"]);
      expect((await owner<{ n: number }>(db, "select count(*)::int n from public.org_invitations"))[0].n).toBe(1);
      expect((await owner<{ n: number }>(db, "select count(*)::int n from private.organization_secrets"))[0].n).toBe(1);
    } finally {
      await db.close();
    }
  });
});

describe("panel: estados de empresas y locales", () => {
  it("suspender exige un motivo, bloquea pedidos y reactivar los permite; nada se publica solo", async () => {
    const db = await database();
    try {
      const c = await company(db, "estados", "dueno@estados.test");
      await owner(db, `update public.venues set organization_id='${c.organization_id}' where id='${ids.venue}'`);
      const makeOrder = async (key: string) => {
        await actor(db, ids.customer, `dev-${key}`, false);
        return command(db, createInput(key));
      };
      await makeOrder("antes");
      await asOperator(db);
      await expect(call(db, "platform_org_set_status", { id: c.organization_id, status: "suspended", reason: "no", meta })).rejects.toThrow(/REASON_REQUIRED/);
      await call(db, "platform_org_set_status", { id: c.organization_id, status: "suspended", reason: "Falta de pago de contrato", meta });
      await expect(makeOrder("suspendida")).rejects.toThrow(/ORGANIZATION_SUSPENDED/);
      // Con la empresa suspendida no se puede publicar un local.
      await asOperator(db);
      await expect(call(db, "platform_venue_set_status", { id: c.venue_id, action: "publish", meta })).rejects.toThrow(/ORGANIZATION_NOT_ACTIVE/);
      await call(db, "platform_org_set_status", { id: c.organization_id, status: "active", meta });
      await makeOrder("reactivada");
      await asOperator(db);
      await expect(call(db, "platform_org_set_status", { id: c.organization_id, status: "otra", meta })).rejects.toThrow(/INVALID_INPUT/);
      const log = await call<{ action: string }[]>(db, "platform_audit_list", { organizationId: c.organization_id, action: "organization.status" });
      expect(log).toHaveLength(2);
    } finally {
      await db.close();
    }
  });

  it("locales: publicar, suspender (con motivo), archivar y volver a estados anteriores, con visibilidad pública coherente", async () => {
    const db = await database();
    try {
      const o = await onboard(db);
      const visibleToPublic = async () => {
        await actor(db, ids.customer, "anon-v", true);
        return (await db.query<{ id: string }>("select id from public.venues where id=$1", [o.venue_id])).rows.length === 1;
      };
      expect(await visibleToPublic()).toBe(false); // borrador: nada se publica solo
      await asOperator(db);
      await call(db, "platform_venue_set_status", { id: o.venue_id, action: "publish", meta });
      expect(await visibleToPublic()).toBe(true);
      await asOperator(db);
      await expect(call(db, "platform_venue_set_status", { id: o.venue_id, action: "suspend", reason: "x", meta })).rejects.toThrow(/REASON_REQUIRED/);
      await call(db, "platform_venue_set_status", { id: o.venue_id, action: "suspend", reason: "Reclamos de clientes", meta });
      expect(await visibleToPublic()).toBe(false);
      await asOperator(db);
      await call(db, "platform_venue_set_status", { id: o.venue_id, action: "unsuspend", meta });
      expect(await visibleToPublic()).toBe(true);
      await asOperator(db);
      await call(db, "platform_venue_set_status", { id: o.venue_id, action: "archive", meta });
      expect(await visibleToPublic()).toBe(false);
      await asOperator(db);
      await expect(call(db, "platform_venue_set_status", { id: o.venue_id, action: "volar", meta })).rejects.toThrow(/INVALID_INPUT/);
      const v = await call<{ items: { publication_status: string }[] }>(db, "platform_venues_list", { filter: "archived" });
      expect(v.items.map((i) => i.publication_status)).toEqual(["archived"]);
      const p = await call<{ items: unknown[] }>(db, "platform_venues_list", { filter: "pending" });
      expect(p.items).toHaveLength(0);
    } finally {
      await db.close();
    }
  });

  it("editar empresa y local valida los datos y las modalidades de servicio", async () => {
    const db = await database();
    try {
      const o = await onboard(db);
      await asOperator(db);
      await call(db, "platform_org_update", { id: o.organization_id, values: { plan: "premium", notes: "Cliente piloto", is_demo: true }, meta });
      await expect(call(db, "platform_org_update", { id: o.organization_id, values: { plan: "oro" }, meta })).rejects.toThrow(/INVALID_INPUT/);
      await expect(call(db, "platform_org_update", { id: ZERO, values: {}, meta })).rejects.toThrow(/NOT_FOUND/);
      const modes = { dine_in: true, pickup: false, delivery: { enabled: true, zones: ["Escazú", "Santa Ana"], fee_minor: 150000, min_order_minor: 500000 } };
      await call(db, "platform_venue_update", { id: o.venue_id, values: { hours: "Lun–Sáb 17:00–01:00", eta_minutes: 20, service_modes: modes, brand_color: "#112233", directory_visible: true }, meta });
      const [v] = await owner<{ eta_minutes: number; demo_listed: boolean; service_modes: typeof modes }>(db, "select eta_minutes,demo_listed,service_modes from public.venues where id=$1", [o.venue_id]);
      expect(v).toMatchObject({ eta_minutes: 20, demo_listed: true });
      expect(v.service_modes.delivery.zones).toEqual(["Escazú", "Santa Ana"]);
      await asOperator(db);
      for (const bad of [
        { service_modes: { dine_in: false, pickup: false, delivery: { enabled: false } } },
        { service_modes: { dine_in: "sí" } },
        { eta_minutes: 0 },
        { brand_color: "rojo" },
      ])
        await expect(call(db, "platform_venue_update", { id: o.venue_id, values: bad, meta }), JSON.stringify(bad)).rejects.toThrow(/INVALID_INPUT/);
    } finally {
      await db.close();
    }
  });

  it("eliminar exige confirmación, estado previo y que no haya datos; con pedidos no se toca nada", async () => {
    const db = await database();
    try {
      const o = await onboard(db);
      await asOperator(db);
      await expect(call(db, "platform_venue_delete", { id: o.venue_id, confirmSlug: "bar-central-escazu", meta })).rejects.toThrow(/VENUE_NOT_ARCHIVED/);
      await call(db, "platform_venue_set_status", { id: o.venue_id, action: "archive", meta });
      await expect(call(db, "platform_venue_delete", { id: o.venue_id, confirmSlug: "otro", meta })).rejects.toThrow(/CONFIRMATION_REQUIRED/);
      await expect(call(db, "platform_org_delete", { id: o.organization_id, confirmSlug: "bar-central", meta })).rejects.toThrow(/ORGANIZATION_NOT_CLOSED/);
      await call(db, "platform_org_set_status", { id: o.organization_id, status: "closed", reason: "Cierre solicitado", meta });
      await expect(call(db, "platform_org_delete", { id: o.organization_id, confirmSlug: "bar-central", meta })).rejects.toThrow(/ORGANIZATION_HAS_VENUES/);
      await call(db, "platform_venue_delete", { id: o.venue_id, confirmSlug: "bar-central-escazu", meta });
      await call(db, "platform_org_delete", { id: o.organization_id, confirmSlug: "bar-central", meta });
      expect(await owner(db, "select 1 from public.organizations")).toHaveLength(0);
      // Un local con pedidos no se elimina.
      await owner(db, `update public.venues set publication_status='archived' where id='${ids.venue}'`);
      await actor(db, ids.customer, "dev-del", false);
      await asOperator(db);
      await owner(db, `update public.venues set publication_status='published' where id='${ids.venue}'`);
      await actor(db, ids.customer, "dev-del", false);
      await command(db, createInput("para-borrar"));
      await owner(db, `update public.venues set publication_status='archived' where id='${ids.venue}'`);
      await asOperator(db);
      await expect(call(db, "platform_venue_delete", { id: ids.venue, confirmSlug: (await owner<{ slug: string }>(db, "select slug from public.venues where id=$1", [ids.venue]))[0].slug, meta })).rejects.toThrow(/VENUE_HAS_DATA/);
      expect((await owner<{ n: number }>(db, "select count(*)::int n from public.products where venue_id=$1", [ids.venue]))[0].n).toBeGreaterThan(0);
    } finally {
      await db.close();
    }
  });
});

describe("panel: invitaciones", () => {
  it("un solo uso, vencen a los 7 días, se revocan y exigen el mismo correo verificado", async () => {
    const db = await database();
    try {
      const token = newToken();
      const o = await onboard(db, { token, email: "dueno@inv.test" });
      // Correo distinto: no sirve.
      const intruder = await account(db, "intruso@ejemplo.com");
      await db.exec("reset role");
      await expect(db.query("select public.invitation_accept($1,$2)", [hashOf(token), intruder])).rejects.toThrow(/INVITATION_INVALID/);
      // Correo sin verificar: no sirve.
      const unverified = await account(db, "dueno@inv.test", false);
      await db.exec("reset role");
      await expect(db.query("select public.invitation_accept($1,$2)", [hashOf(token), unverified])).rejects.toThrow(/INVITATION_INVALID/);
      await owner(db, "delete from auth.users where id=$1", [unverified]);
      // El token en claro no está guardado y un token inventado no existe.
      await expect(owner(db, "select public.invitation_lookup($1)", [token])).rejects.toThrow(/INVITATION_INVALID/);
      expect((await owner<{ r: { organization: string; role: string; account_exists: boolean } }>(db, "select public.invitation_lookup($1) r", [hashOf(token)]))[0].r).toMatchObject({ role: "owner", account_exists: false });
      const uid = await acceptAs(db, token, "dueno@inv.test");
      expect((await owner(db, "select 1 from public.org_memberships where user_id=$1 and organization_id=$2 and role='owner'", [uid, o.organization_id]))).toHaveLength(1);
      // Reflejo operativo: el propietario administra el local con el modelo existente.
      expect((await owner<{ role: string }>(db, "select role from public.memberships where user_id=$1", [uid])).map((r) => r.role)).toEqual(["admin"]);
      // Segundo uso: invalida.
      await db.exec("reset role");
      await expect(db.query("select public.invitation_accept($1,$2)", [hashOf(token), uid])).rejects.toThrow(/INVITATION_INVALID/);
    } finally {
      await db.close();
    }
  });

  it("vencida a los 7 días y revocada no se pueden usar; la plataforma crea y revoca invitaciones", async () => {
    const db = await database();
    try {
      const o = await onboard(db);
      await asOperator(db);
      const t1 = newToken();
      const t2 = newToken();
      await call(db, "platform_invitation_create", { organizationId: o.organization_id, email: "gerente@x.test", role: "venue_manager", venueIds: [o.venue_id], tokenHash: hashOf(t1), meta });
      await expect(call(db, "platform_invitation_create", { organizationId: o.organization_id, email: "gerente@x.test", role: "analyst", tokenHash: hashOf(t2), meta })).rejects.toThrow(/INVITATION_EXISTS/);
      await expect(call(db, "platform_invitation_create", { organizationId: o.organization_id, email: "otro@x.test", role: "venue_manager", tokenHash: hashOf(t2), meta })).rejects.toThrow(/INVALID_INPUT/);
      const inv = await owner<{ id: string }>(db, "select id from public.org_invitations where email='gerente@x.test'");
      await owner(db, "update public.org_invitations set expires_at=now()-interval '1 minute' where email='gerente@x.test'");
      const uid = await account(db, "gerente@x.test");
      await db.exec("reset role");
      await expect(db.query("select public.invitation_accept($1,$2)", [hashOf(t1), uid])).rejects.toThrow(/INVITATION_INVALID/);
      await owner(db, "update public.org_invitations set expires_at=now()+interval '7 days' where email='gerente@x.test'");
      await asOperator(db);
      await call(db, "platform_invitation_revoke", { id: inv[0].id, meta });
      await db.exec("reset role");
      await expect(db.query("select public.invitation_accept($1,$2)", [hashOf(t1), uid])).rejects.toThrow(/INVITATION_INVALID/);
      await asOperator(db);
      await expect(call(db, "platform_invitation_revoke", { id: inv[0].id, meta })).rejects.toThrow(/NOT_FOUND/);
    } finally {
      await db.close();
    }
  });

  it("una cuenta personal (con perfil de cliente) no se convierte en laboral", async () => {
    const db = await database();
    try {
      const token = newToken();
      await onboard(db, { token, email: "cliente@x.test" });
      const uid = await account(db, "cliente@x.test");
      await owner(db, `insert into public.profiles(user_id,full_name,username,phone_country,phone_e164,birth_date,terms_version,privacy_version,terms_accepted_at)
        values('${uid}','Cliente Real','clientereal','+506','+50688880000','1990-01-01','v1','v1',now())`);
      await db.exec("reset role");
      await expect(db.query("select public.invitation_accept($1,$2)", [hashOf(token), uid])).rejects.toThrow(/CUSTOMER_EMAIL/);
    } finally {
      await db.close();
    }
  });

  it("una cuenta laboral existente acepta con su sesión; con otro correo o sin sesión no", async () => {
    const db = await database();
    try {
      const token = newToken();
      await onboard(db, { token, email: "existente@x.test" });
      const uid = await account(db, "existente@x.test");
      await as(db, uid, "otro@x.test", { tokenEmail: "otro@x.test" });
      await owner(db, "update auth.users set email='existente@x.test' where id=$1", [uid]);
      await as(db, uid, "existente@x.test", { anonymous: true });
      await expect(call(db, "invitation_accept_self", hashOf(token))).rejects.toThrow(/SESSION_REQUIRED/);
      const stranger = await account(db, "extrano@x.test");
      await as(db, stranger, "extrano@x.test");
      await expect(call(db, "invitation_accept_self", hashOf(token))).rejects.toThrow(/INVITATION_INVALID/);
      await as(db, uid, "existente@x.test");
      expect(await call(db, "invitation_accept_self", hashOf(token))).toMatchObject({ role: "owner" });
    } finally {
      await db.close();
    }
  });
});

describe("panel de empresa: roles, alcance y aislamiento", () => {
  type World = Awaited<ReturnType<typeof twoCompanies>>;
  async function twoCompanies(db: Db) {
    const a = await company(db, "empresa-a", "dueno@a.test");
    const b = await company(db, "empresa-b", "dueno@b.test");
    // Segundo local de A, un gerente de ese local y un analista de toda la empresa A.
    await asOperator(db);
    const v2 = await call<{ venue_id: string }>(db, "platform_venue_create", { organizationId: a.organization_id, name: "Local Dos", slug: "empresa-a-dos", meta });
    await owner(db, `update public.venues set publication_status='published' where id='${v2.venue_id}'`);
    const tm = newToken();
    const ta = newToken();
    await as(db, a.owner_id, a.email);
    await call(db, "org_invitation_create", { organizationId: a.organization_id, email: "gerente@a.test", role: "venue_manager", venueIds: [a.venue_id], tokenHash: hashOf(tm), meta });
    await call(db, "org_invitation_create", { organizationId: a.organization_id, email: "analista@a.test", role: "analyst", tokenHash: hashOf(ta), meta });
    const manager = await acceptAs(db, tm, "gerente@a.test");
    const analyst = await acceptAs(db, ta, "analista@a.test");
    return { a, b, v2: v2.venue_id, manager, analyst };
  }
  const orderAt = async (db: Db, w: World, venue: string, key: string, user: string = ids.customer) => {
    await owner(db, `update public.venues set organization_id='${venue === w.v2 ? w.a.organization_id : w.a.organization_id}' where id='${ids.venue}'`);
    void venue;
    await actor(db, user, `d-${key}`, false);
    await command(db, createInput(key));
  };

  it("cada persona ve solo su empresa y, según su rol, solo sus locales", async () => {
    const db = await database();
    try {
      const w = await twoCompanies(db);
      await as(db, w.a.owner_id, w.a.email);
      const mine = await call<{ slug: string; role: string; venues: unknown[] }[]>(db, "org_my");
      expect(mine.map((m) => [m.slug, m.role, m.venues.length])).toEqual([["empresa-a", "owner", 2]]);
      await as(db, w.manager, "gerente@a.test");
      const mm = await call<{ venues: { id: string }[] }[]>(db, "org_my");
      expect(mm[0].venues.map((v) => v.id)).toEqual([w.a.venue_id]);
      await as(db, w.b.owner_id, w.b.email);
      expect((await call<{ slug: string }[]>(db, "org_my")).map((m) => m.slug)).toEqual(["empresa-b"]);
      // Aislamiento: la empresa B no ve nada de la A.
      for (const [fn, arg] of [
        ["org_summary", { organizationId: w.a.organization_id }],
        ["org_customers", { organizationId: w.a.organization_id }],
      ] as const)
        await expect(call(db, fn, arg), fn).rejects.toThrow(/NOT_FOUND/);
      await expect(call(db, "org_staff_list", w.a.organization_id)).rejects.toThrow(/NOT_FOUND/);
      await expect(call(db, "org_menu", w.a.venue_id)).rejects.toThrow(/NOT_FOUND/);
      await expect(call(db, "org_venue_settings_save", { venueId: w.a.venue_id, values: { hours: "x" }, meta })).rejects.toThrow(/NOT_FOUND/);
      await expect(call(db, "org_invitation_create", { organizationId: w.a.organization_id, email: "x@y.co", role: "analyst", tokenHash: hashOf(newToken()), meta })).rejects.toThrow(/NOT_FOUND/);
      await expect(call(db, "org_member_remove", { organizationId: w.a.organization_id, userId: w.manager, meta })).rejects.toThrow(/NOT_FOUND/);
    } finally {
      await db.close();
    }
  });

  it("el gerente de un local no ve el otro local, ni el personal, ni puede invitar; el analista solo lee", async () => {
    const db = await database();
    try {
      const w = await twoCompanies(db);
      await as(db, w.manager, "gerente@a.test");
      await expect(call(db, "org_staff_list", w.a.organization_id)).rejects.toThrow(/NOT_FOUND/);
      await expect(call(db, "org_menu", w.v2)).rejects.toThrow(/NOT_FOUND/);
      await expect(call(db, "org_summary", { organizationId: w.a.organization_id, venueId: w.v2 })).rejects.toThrow(/NOT_FOUND/);
      await expect(call(db, "org_invitation_create", { organizationId: w.a.organization_id, email: "x@y.co", role: "staff", venueIds: [w.a.venue_id], tokenHash: hashOf(newToken()), meta })).rejects.toThrow(/NOT_FOUND/);
      await call(db, "org_venue_settings_save", { venueId: w.a.venue_id, values: { hours: "Todos los días 12:00–23:00", eta_minutes: 25 }, meta });
      await expect(call(db, "org_venue_settings_save", { venueId: w.v2, values: { hours: "x" }, meta })).rejects.toThrow(/NOT_FOUND/);
      await as(db, w.analyst, "analista@a.test");
      expect(await call(db, "org_summary", { organizationId: w.a.organization_id })).toMatchObject({ venues: 2 });
      await expect(call(db, "org_venue_settings_save", { venueId: w.a.venue_id, values: { hours: "x" }, meta })).rejects.toThrow(/NOT_FOUND/);
      await expect(call(db, "org_staff_list", w.a.organization_id)).rejects.toThrow(/NOT_FOUND/);
    } finally {
      await db.close();
    }
  });

  it("solo el propietario concede propietario o administrador; el último propietario y el cambio propio están protegidos", async () => {
    const db = await database();
    try {
      const w = await twoCompanies(db);
      // Un administrador puede invitar roles de local pero no propietarios.
      const tAdmin = newToken();
      await as(db, w.a.owner_id, w.a.email);
      await call(db, "org_invitation_create", { organizationId: w.a.organization_id, email: "admin@a.test", role: "admin", tokenHash: hashOf(tAdmin), meta });
      const admin = await acceptAs(db, tAdmin, "admin@a.test");
      await as(db, admin, "admin@a.test");
      await call(db, "org_invitation_create", { organizationId: w.a.organization_id, email: "cajero@a.test", role: "cashier", venueIds: [w.a.venue_id], tokenHash: hashOf(newToken()), meta });
      await expect(call(db, "org_invitation_create", { organizationId: w.a.organization_id, email: "otro-dueno@a.test", role: "owner", tokenHash: hashOf(newToken()), meta })).rejects.toThrow(/NOT_AUTHORIZED/);
      await expect(call(db, "org_member_set", { organizationId: w.a.organization_id, userId: w.a.owner_id, role: "staff", venueIds: [w.a.venue_id], meta })).rejects.toThrow(/NOT_AUTHORIZED/);
      await expect(call(db, "org_member_remove", { organizationId: w.a.organization_id, userId: w.a.owner_id, meta })).rejects.toThrow(/NOT_AUTHORIZED/);
      // Un administrador no puede cambiar ni a otro administrador (ni a sí mismo): eso es del propietario.
      await expect(call(db, "org_member_set", { organizationId: w.a.organization_id, userId: admin, role: "staff", venueIds: [w.a.venue_id], meta })).rejects.toThrow(/NOT_AUTHORIZED/);
      // El propietario: no puede bajarse a sí mismo ni quedar la empresa sin propietario.
      await as(db, w.a.owner_id, w.a.email);
      await expect(call(db, "org_member_set", { organizationId: w.a.organization_id, userId: w.a.owner_id, role: "admin", meta })).rejects.toThrow(/SELF_CHANGE/);
      // Cambiar roles y locales de otro miembro actualiza también el modelo operativo.
      await call(db, "org_member_set", { organizationId: w.a.organization_id, userId: w.manager, role: "cashier", venueIds: [w.a.venue_id, w.v2], meta });
      expect((await owner<{ role: string; venue_id: string }>(db, "select role,venue_id from public.memberships where user_id=$1 order by venue_id", [w.manager])).map((r) => r.role)).toEqual(["bartender", "bartender"]);
      await call(db, "org_member_remove", { organizationId: w.a.organization_id, userId: w.manager, meta });
      expect(await owner(db, "select 1 from public.memberships where user_id=$1", [w.manager])).toHaveLength(0);
      await expect(call(db, "org_member_set", { organizationId: w.a.organization_id, userId: w.manager, role: "staff", venueIds: [w.a.venue_id], meta })).rejects.toThrow(/NOT_FOUND/);
      // Un local de otra empresa no se puede asignar.
      await expect(call(db, "org_member_set", { organizationId: w.a.organization_id, userId: admin, role: "staff", venueIds: [w.b.venue_id], meta })).rejects.toThrow(/VENUE_NOT_IN_ORGANIZATION/);
    } finally {
      await db.close();
    }
  });

  it("reenviar entrega un token nuevo con nuevo plazo; el anterior deja de servir", async () => {
    const db = await database();
    try {
      const w = await twoCompanies(db);
      const t1 = newToken();
      const t2 = newToken();
      await as(db, w.a.owner_id, w.a.email);
      const inv = await call<{ id: string }>(db, "org_invitation_create", { organizationId: w.a.organization_id, email: "cocina@a.test", role: "kitchen", venueIds: [w.a.venue_id], tokenHash: hashOf(t1), meta });
      await owner(db, "update public.org_invitations set expires_at=now()+interval '1 hour' where id=$1", [inv.id]);
      await as(db, w.a.owner_id, w.a.email);
      await call(db, "org_invitation_resend", { id: inv.id, tokenHash: hashOf(t2), meta });
      const [row] = await owner<{ days: number }>(db, "select round(extract(epoch from expires_at-now())/86400)::int days from public.org_invitations where id=$1", [inv.id]);
      expect(row.days).toBe(7);
      const uid = await account(db, "cocina@a.test");
      await db.exec("reset role");
      await expect(db.query("select public.invitation_accept($1,$2)", [hashOf(t1), uid])).rejects.toThrow(/INVITATION_INVALID/);
      await db.query("select public.invitation_accept($1,$2)", [hashOf(t2), uid]);
      expect((await owner<{ role: string }>(db, "select role from public.memberships where user_id=$1", [uid]))).toEqual([{ role: "bartender" }]);
      await as(db, w.a.owner_id, w.a.email);
      const list = await call<{ members: { email: string }[]; invitations: unknown[] }>(db, "org_staff_list", w.a.organization_id);
      expect(list.members.map((m) => m.email)).toContain("cocina@a.test");
      expect(JSON.stringify(list)).not.toMatch(/token_hash|tokenHash/);
    } finally {
      await db.close();
    }
  });

  it("una empresa suspendida no puede cambiar su configuración ni invitar", async () => {
    const db = await database();
    try {
      const w = await twoCompanies(db);
      await asOperator(db);
      await call(db, "platform_org_set_status", { id: w.a.organization_id, status: "suspended", reason: "Revisión de cumplimiento", meta });
      await as(db, w.a.owner_id, w.a.email);
      await expect(call(db, "org_venue_settings_save", { venueId: w.a.venue_id, values: { hours: "x" }, meta })).rejects.toThrow(/ORGANIZATION_NOT_ACTIVE/);
      await expect(call(db, "org_invitation_create", { organizationId: w.a.organization_id, email: "n@a.test", role: "analyst", tokenHash: hashOf(newToken()), meta })).rejects.toThrow(/ORGANIZATION_NOT_ACTIVE/);
      // Leer sí puede.
      expect(await call(db, "org_summary", { organizationId: w.a.organization_id })).toMatchObject({ venues: 2 });
    } finally {
      await db.close();
    }
  });

  it("los clientes se ven con seudónimo propio de cada empresa, sin correo ni identificador de cuenta", async () => {
    const db = await database();
    try {
      const w = await twoCompanies(db);
      const second = await account(db, "segundo@consumidor.test", true, ids.other);
      await owner(db, `update public.profiles set user_id=user_id where false`);
      for (const [u, name, nick] of [
        [ids.customer, "Cliente Uno", "clienteuno"],
        [second, "Cliente Dos", "clientedos"],
      ])
        await owner(db, `insert into public.profiles(user_id,full_name,username,phone_country,phone_e164,birth_date,terms_version,privacy_version,terms_accepted_at)
          values('${u}','${name}','${nick}','+506','+5068888${nick.length}00','1990-01-01','v','v',now()) on conflict do nothing`);
      await owner(db, `update public.venues set organization_id='${w.a.organization_id}' where id='${ids.venue}'`);
      await orderAt(db, w, ids.venue, "p-1", ids.customer);
      await orderAt(db, w, ids.venue, "p-2", ids.customer);
      await orderAt(db, w, ids.venue, "p-3", second);
      await as(db, w.a.owner_id, w.a.email);
      const list = await call<{ pseudonym: string; orders: number }[]>(db, "org_customers", { organizationId: w.a.organization_id });
      expect(list).toHaveLength(2);
      expect(list.map((c) => c.orders).sort()).toEqual([1, 2]);
      expect(list.every((c) => /^Cliente-[0-9A-F]{6}$/.test(c.pseudonym))).toBe(true);
      const raw = JSON.stringify(list);
      expect(raw).not.toMatch(/@|consumidor|clienteuno|Cliente Uno|customer_id|user_id/);
      expect(raw).not.toContain(ids.customer);
      expect(raw).not.toContain(second);
      // Estable dentro de la empresa; distinto en otra (sal propia de cada empresa).
      const again = await call<{ pseudonym: string }[]>(db, "org_customers", { organizationId: w.a.organization_id });
      expect(again.map((c) => c.pseudonym).sort()).toEqual(list.map((c) => c.pseudonym).sort());
      await owner(db, `update public.venues set organization_id='${w.b.organization_id}' where id='${ids.venue}'`);
      await as(db, w.b.owner_id, w.b.email);
      const other = await call<{ pseudonym: string }[]>(db, "org_customers", { organizationId: w.b.organization_id });
      expect(other).toHaveLength(2);
      expect(other.map((c) => c.pseudonym).filter((p) => list.some((c) => c.pseudonym === p))).toHaveLength(0);
    } finally {
      await db.close();
    }
  });

  it("registra las acciones de la empresa en la auditoría, que solo lee el operador", async () => {
    const db = await database();
    try {
      const w = await twoCompanies(db);
      await as(db, w.a.owner_id, w.a.email);
      expect((await db.query("select * from public.platform_audit")).rows).toHaveLength(0);
      await expect(call(db, "platform_audit_list", {})).rejects.toThrow(/NOT_FOUND/);
      await asOperator(db);
      const entries = await call<{ action: string; organization_id: string }[]>(db, "platform_audit_list", { organizationId: w.a.organization_id });
      expect(entries.map((e) => e.action)).toEqual(expect.arrayContaining(["invitation.create", "invitation.accept", "venue.create"]));
      const onlyInv = await call<{ action: string }[]>(db, "platform_audit_list", { action: "invitation." });
      expect(onlyInv.every((e) => e.action.startsWith("invitation."))).toBe(true);
    } finally {
      await db.close();
    }
  });
});

describe("panel: usuarios, inventario y resumen", () => {
  it("lista miembros, consumidores y el único operador; no se puede actuar sobre el operador", async () => {
    const db = await database();
    try {
      const c = await company(db, "usuarios", "dueno@usuarios.test");
      await owner(db, `insert into auth.users(id,email,email_confirmed_at) values('${ids.customer}','cliente@x.test',now()) on conflict(id) do update set email=excluded.email;
        insert into public.profiles(user_id,full_name,username,phone_country,phone_e164,birth_date,terms_version,privacy_version,terms_accepted_at)
        values('${ids.customer}','Cliente X','clientex','+506','+50688880001','1990-01-01','v','v',now())`);
      await asOperator(db);
      expect((await call<{ items: { email: string }[] }>(db, "platform_users_list", { kind: "members" })).items.map((i) => i.email)).toEqual(["dueno@usuarios.test"]);
      expect((await call<{ items: { email: string }[] }>(db, "platform_users_list", { kind: "consumers" })).items.map((i) => i.email)).toEqual(["cliente@x.test"]);
      expect((await call<{ items: { email: string; role: string }[] }>(db, "platform_users_list", { kind: "operators" })).items).toMatchObject([{ email: OPERATOR_EMAIL, role: "super_admin" }]);
      await expect(call(db, "platform_users_list", { kind: "todos" })).rejects.toThrow(/INVALID_INPUT/);
      const operatorId = (await owner<{ id: string }>(db, "select id from auth.users where email=$1", [OPERATOR_EMAIL]))[0].id;
      await asOperator(db);
      await expect(call(db, "platform_user_target", operatorId)).rejects.toThrow(/OPERATOR_PROTECTED/);
      await expect(call(db, "platform_user_record", { userId: operatorId, action: "delete", meta })).rejects.toThrow(/OPERATOR_PROTECTED/);
      // Suspender a un miembro lo saca de la empresa y del modelo operativo; reactivarlo lo devuelve.
      await call(db, "platform_user_record", { userId: c.owner_id, action: "suspend", meta });
      expect(await owner(db, "select 1 from public.memberships where user_id=$1", [c.owner_id])).toHaveLength(0);
      expect((await owner<{ status: string }>(db, "select status from public.org_memberships where user_id=$1", [c.owner_id]))[0].status).toBe("suspended");
      await as(db, c.owner_id, c.email);
      expect(await call(db, "org_my")).toEqual([]);
      await asOperator(db);
      await call(db, "platform_user_record", { userId: c.owner_id, action: "unsuspend", meta });
      expect(await owner(db, "select 1 from public.memberships where user_id=$1", [c.owner_id])).toHaveLength(1);
      await call(db, "platform_user_record", { userId: c.owner_id, action: "delete", meta });
      expect(await owner(db, "select 1 from public.org_memberships where user_id=$1", [c.owner_id])).toHaveLength(0);
    } finally {
      await db.close();
    }
  });

  it("el resumen global y el detalle de empresa no mezclan datos y traen lo pedido", async () => {
    const db = await database();
    try {
      const a = await company(db, "resumen-a", "dueno@ra.test");
      await company(db, "resumen-b", "dueno@rb.test");
      await owner(db, `update public.venues set organization_id='${a.organization_id}' where id='${ids.venue}'`);
      await actor(db, ids.customer, "dev-r", false);
      await command(db, createInput("resumen-1"));
      await asOperator(db);
      const ov = await call<{
        organizations: { total: number; active: number };
        venues: { total: number; draft: number; without_organization: number };
        orders: { count: number };
        by_day: unknown[];
        by_organization: { name: string; orders: number }[];
      }>(db, "platform_overview", {});
      expect(ov.organizations).toMatchObject({ total: 2, active: 2 });
      expect(ov.orders.count).toBe(1);
      expect(ov.by_day).toHaveLength(30);
      expect(ov.by_organization.find((r) => r.name === "Bar Central S.A.")?.orders).toBe(1);
      await expect(call(db, "platform_overview", { from: "2026-01-01", to: "2027-12-31" })).rejects.toThrow(/INVALID_INPUT/);
      const detail = await call<{ organization: { slug: string }; venues: unknown[]; recent_orders: { code: string }[]; invitations: { state: string }[]; inventory: { products: number } }>(db, "platform_org_get", a.organization_id);
      expect(detail.organization.slug).toBe("resumen-a");
      expect(detail.venues).toHaveLength(2);
      expect(detail.recent_orders).toHaveLength(1);
      expect(detail.invitations[0].state).toBe("accepted");
      expect(detail.inventory.products).toBeGreaterThan(0);
      const inv = await call<{ product: string }[]>(db, "platform_org_inventory", a.organization_id);
      expect(inv.length).toBe(detail.inventory.products);
      const list = await call<{ total: number; items: { slug: string }[] }>(db, "platform_orgs_list", { q: "resumen-a", status: "active" });
      expect(list.items.map((i) => i.slug)).toEqual(["resumen-a"]);
      await expect(call(db, "platform_orgs_list", { status: "x" })).rejects.toThrow(/INVALID_INPUT/);
      const demos = await call<{ items: unknown[] }>(db, "platform_orgs_list", { demo: "true" });
      expect(demos.items).toHaveLength(0);
      const menu = await call<{ categories: unknown[]; products: unknown[] }>(db, "platform_venue_menu", ids.venue);
      expect(menu.products.length).toBeGreaterThan(0);
      const venue = await call<{ menu_link: string; activity_30d: unknown[] }>(db, "platform_venue_get", ids.venue);
      expect(venue.menu_link).toMatch(/^\/v\//);
      expect(venue.activity_30d).toHaveLength(30);
    } finally {
      await db.close();
    }
  });
});
