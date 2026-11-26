import { createHash } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { database, actor, command, createInput, ids } from "./helpers";

/**
 * Matriz de permisos de la auditoría (2026-11-21): cliente, empleado, administrador, empleado de OTRO local, Onza y sesión
 * invitada, contra la cadena real de migraciones (PGlite, datos ficticios). Cada fila es una regresión: si una migración
 * futura abre un permiso, esta prueba falla. La RPC se llama directa, como lo haría un cliente con su JWT sin pasar por Next.
 */
const u = {
  other: ids.other,
  rival: "10000000-0000-4000-8000-000000000011", // empleado de OTRO local (Patio Central)
  rivalAdmin: "10000000-0000-4000-8000-000000000012",
  onza: "10000000-0000-4000-8000-000000000013",
  noProfile: "10000000-0000-4000-8000-000000000014",
};
let db: PGlite;
let order: { id: string; version: number; venue: { id: string } };

const as = (user: string, session = "dev-" + user.slice(-2), anonymous = false) =>
  actor(db, user, session, anonymous);
const rejects = async (promise: Promise<unknown>, code: string | RegExp) => {
  await expect(promise).rejects.toThrow(code);
};
const rpc = (name: string, args: unknown[] = []) =>
  db.query<{ r: unknown }>(
    `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as r`,
    args.map((a) => (a !== null && typeof a === "object" ? JSON.stringify(a) : a)),
  );

beforeAll(async () => {
  db = await database();
  await db.exec("reset role");
  await db.exec(
    `insert into auth.users(id) values('${u.rival}'),('${u.rivalAdmin}'),('${u.onza}'),('${u.noProfile}');
     insert into public.memberships(user_id,venue_id,role) values
       ('${u.rival}','${ids.patio}','bartender'),('${u.rivalAdmin}','${ids.patio}','admin'),('${u.onza}','${ids.venue}','onza');
     insert into public.profiles(user_id,full_name,username,phone_country,phone_e164,birth_date,terms_version,privacy_version,terms_accepted_at)
       values('${ids.customer}','Cliente Prueba','cliente.prueba','+506','+50688887777','1990-01-01','demo-v1','demo-v1',now()),
             ('${ids.other}','Otra Prueba','otra.prueba','+506','+50688887778','1990-01-01','demo-v1','demo-v1',now());`,
  );
  await as(ids.customer);
  order = (await command(db, createInput("audit-order"))) as typeof order;
});
afterAll(async () => db.close());

describe("pedidos: lectura por participante", () => {
  it("el dueño y el equipo del local lo leen; otro cliente y el equipo de otro local no", async () => {
    await as(ids.customer);
    expect((await command(db, { action: "get", orderId: order.id })).id).toBe(order.id);
    await as(ids.staff);
    expect((await command(db, { action: "get", orderId: order.id })).id).toBe(order.id);
    await as(ids.admin);
    expect((await command(db, { action: "get", orderId: order.id })).id).toBe(order.id);
    await as(u.other);
    await rejects(command(db, { action: "get", orderId: order.id }), "NOT_AUTHORIZED");
    await as(u.rival);
    await rejects(command(db, { action: "get", orderId: order.id }), "NOT_AUTHORIZED");
    await as(u.rivalAdmin);
    await rejects(command(db, { action: "get", orderId: order.id }), "NOT_AUTHORIZED");
  });
  it("order_list: el cliente solo ve lo suyo; filtrar por un local ajeno se rechaza", async () => {
    await as(u.other);
    expect((await rpc("order_list")).rows[0].r).toEqual([]);
    await rejects(rpc("order_list", [ids.venue]), "NOT_AUTHORIZED");
    await as(u.rival);
    await rejects(rpc("order_list", [ids.venue]), "NOT_AUTHORIZED");
    await as(ids.staff);
    expect(((await rpc("order_list", [ids.venue])).rows[0].r as unknown[]).length).toBeGreaterThan(0);
  });
  it("lectura directa de tablas: cada actor ve solo sus filas y no puede escribir", async () => {
    await as(u.other);
    expect((await db.query("select id from public.orders")).rows).toHaveLength(0);
    expect((await db.query("select id from public.order_items")).rows).toHaveLength(0);
    await as(u.rival);
    expect((await db.query("select id from public.orders")).rows).toHaveLength(0);
    await as(ids.staff);
    expect((await db.query("select id from public.orders")).rows.length).toBeGreaterThan(0);
    for (const sql of [
      "insert into public.orders(venue_id,customer_id,public_code,status,total_minor,deadline) values(gen_random_uuid(),gen_random_uuid(),'X','queued',1,now())",
      "update public.orders set total_minor=0",
      "delete from public.orders",
      "update public.venues set capacity=100",
      "insert into public.memberships(user_id,venue_id,role) values(gen_random_uuid(),gen_random_uuid(),'admin')",
      "update public.memberships set role='admin'",
      "update public.products set price_minor=1",
      "update public.profiles set full_name='x'",
      "select * from private.payments",
      "select * from private.pickup_tokens",
    ])
      await rejects(db.query(sql), /permission denied/i);
    await as(ids.admin);
    await rejects(db.query("update public.products set price_minor=1"), /permission denied/i);
  });
  it("el sin-sesión (anon) lee el catálogo pero ninguna función ni pedido", async () => {
    await db.exec("reset role");
    await db.exec("select set_config('request.jwt.claims','',false)");
    await db.exec("set role anon");
    expect((await db.query("select id from public.venues")).rows.length).toBeGreaterThan(0);
    await rejects(db.query("select id from public.orders"), /permission denied/i);
    await rejects(db.query("select public.onza_command('{\"action\":\"get\"}'::jsonb)"), /permission denied/i);
    await rejects(db.query("select public.order_list()"), /permission denied/i);
    await rejects(db.query("select public.venue_summary($1,current_date)", [ids.venue]), /permission denied/i);
  });
});

describe("privacidad de eventos (auditoría)", () => {
  it("el cliente no ve actor_id ni metadata de los eventos; el equipo sí", async () => {
    await as(ids.staff);
    const accepted = await command(db, { action: "accept", orderId: order.id, expectedVersion: order.version, idempotencyKey: "priv-acc" });
    const staffEvents = accepted.events as { type: string; actor_id: string | null; metadata: Record<string, unknown> }[];
    expect(staffEvents.find((e) => e.type === "accept")?.actor_id).toBe(ids.staff);
    await as(ids.customer);
    const mine = await command(db, { action: "get", orderId: order.id });
    const events = mine.events as { type: string; actor_id: string | null; metadata: Record<string, unknown> }[];
    expect(events.length).toBeGreaterThan(1);
    expect(events.every((e) => e.actor_id === null || e.actor_id === undefined)).toBe(true);
    expect(events.every((e) => Object.keys(e.metadata).length === 0)).toBe(true);
  });
  it("la tabla order_events ya no se lee directo (solo vía order_view)", async () => {
    await as(ids.customer);
    await rejects(db.query("select * from public.order_events"), /permission denied/i);
    await as(ids.staff);
    await rejects(db.query("select * from public.order_events"), /permission denied/i);
  });
});

describe("acciones del equipo por rol y por local", () => {
  const venueUpdate = (extra: Record<string, unknown>, venueId = ids.venue) => command(db, { action: "venue_update", venueId, ...extra });
  it("pausar: empleado y admin del local sí; cliente y empleado de otro local no", async () => {
    await as(ids.staff);
    expect((await venueUpdate({ paused: true })).paused).toBe(true);
    await as(ids.admin);
    expect((await venueUpdate({ paused: false })).paused).toBe(false);
    await as(ids.customer);
    await rejects(venueUpdate({ paused: true }), "NOT_AUTHORIZED");
    await as(u.rival);
    await rejects(venueUpdate({ paused: true }), "NOT_AUTHORIZED");
    await as(u.rivalAdmin);
    await rejects(venueUpdate({ paused: true }), "NOT_AUTHORIZED");
  });
  it("capacidad, nombre y horario: solo admin del local", async () => {
    await as(ids.staff);
    await rejects(venueUpdate({ capacity: 99 }), "NOT_AUTHORIZED");
    await rejects(venueUpdate({ name: "Hackeado" }), "NOT_AUTHORIZED");
    await as(u.rivalAdmin);
    await rejects(venueUpdate({ capacity: 99 }), "NOT_AUTHORIZED");
    await as(ids.admin);
    expect((await venueUpdate({ capacity: 40 })).capacity).toBe(40);
  });
  it("menú (guardar, agotar, archivar): solo admin del local", async () => {
    for (const input of [
      { action: "product_availability", venueId: ids.venue, productId: ids.product, available: true },
      { action: "product_archive", venueId: ids.venue, productId: ids.product, archived: false },
      { action: "product_save", venueId: ids.venue, productId: ids.product, expectedVersion: 1, name: "Cambiado" },
    ]) {
      await as(ids.staff);
      await rejects(command(db, input), "NOT_AUTHORIZED");
      await as(ids.customer);
      await rejects(command(db, input), "NOT_AUTHORIZED");
      await as(u.rivalAdmin);
      await rejects(command(db, input), "NOT_AUTHORIZED");
    }
    await as(ids.admin);
    expect((await command(db, { action: "product_availability", venueId: ids.venue, productId: ids.product, available: true })).available).toBe(true);
  });
  it("aceptación automática: encender es del admin; apagar, de cualquiera del equipo; nunca de otro local", async () => {
    await as(ids.staff);
    await rejects(rpc("venue_auto_accept", [{ venueId: ids.venue, enabled: true }]), "NOT_AUTHORIZED");
    await as(u.rivalAdmin);
    await rejects(rpc("venue_auto_accept", [{ venueId: ids.venue, enabled: false }]), "NOT_AUTHORIZED");
    await as(ids.admin);
    await rpc("venue_auto_accept", [{ venueId: ids.venue, enabled: true, maxPreparing: 3 }]);
    await as(ids.staff);
    await rpc("venue_auto_accept", [{ venueId: ids.venue, enabled: false }]);
    await as(ids.customer);
    await rejects(rpc("venue_auto_accept", [{ venueId: ids.venue, enabled: false }]), "NOT_AUTHORIZED");
  });
  it("resumen y tiempos del local: solo admin del local", async () => {
    for (const user of [ids.staff, ids.customer, u.rivalAdmin, u.rival]) {
      await as(user);
      await rejects(rpc("venue_summary", [ids.venue, "2026-11-20"]), "NOT_AUTHORIZED");
      await rejects(rpc("venue_summary_range", [ids.venue, "2026-11-20", "2026-11-20"]), "NOT_AUTHORIZED");
      await rejects(rpc("venue_timing_stats", [ids.venue, "2026-11-20", "2026-11-20"]), "NOT_AUTHORIZED");
    }
    await as(ids.admin);
    await rpc("venue_summary_range", [ids.venue, "2026-11-20", "2026-11-20"]);
  });
  it("imagen y portada: solo admin del local, nunca de otro", async () => {
    for (const user of [ids.staff, ids.customer, u.rivalAdmin]) {
      await as(user);
      await rejects(rpc("update_venue_branding", [{ venueId: ids.venue, name: "X" }]), "NOT_AUTHORIZED");
      await rejects(rpc("update_product_image", [{ productId: ids.product, imageUrl: null }]), "NOT_AUTHORIZED");
      await rejects(rpc("update_venue_cover_focus", [ids.venue, 10, 10]), "NOT_AUTHORIZED");
    }
    await as(ids.admin);
    await rpc("update_venue_cover_focus", [ids.venue, 10, 10]);
  });
  it("dinero: reembolsar, conciliar y transferir retiros exigen admin del local", async () => {
    await as(ids.staff);
    await rejects(command(db, { action: "refund", orderId: order.id, reason: "prueba larga" }), "NOT_AUTHORIZED");
    await rejects(command(db, { action: "transfer", orderId: order.id, physicalCheck: "not_delivered", reason: "prueba larga" }), "SUPERVISOR_REVIEW_REQUIRED");
    await rejects(command(db, { action: "reconcile_authorization", orderId: order.id, outcome: "authorized", reason: "prueba larga", providerResultConfirmed: true }), "NOT_AUTHORIZED");
    await as(u.rivalAdmin);
    await rejects(command(db, { action: "refund", orderId: order.id, reason: "prueba larga" }), "NOT_AUTHORIZED");
  });
  it("retiro: cliente y empleado de otro local no validan códigos de este local", async () => {
    await as(ids.customer);
    await rejects(command(db, { action: "resolve", venueId: ids.venue, code: "abcdef012345" }), "INVALID_PICKUP");
    await as(u.rival);
    await rejects(command(db, { action: "resolve", venueId: ids.venue, code: "abcdef012345" }), "INVALID_PICKUP");
  });
});

describe("pedidos: quién puede comprar (auditoría)", () => {
  it("una cuenta del equipo no crea pedidos aunque llame a la RPC directamente", async () => {
    await as(ids.staff);
    await rejects(command(db, createInput("staff-buys")), "STAFF_CANNOT_ORDER");
    await as(ids.admin);
    await rejects(command(db, createInput("admin-buys")), "STAFF_CANNOT_ORDER");
    await as(u.rival);
    await rejects(command(db, createInput("rival-buys")), "STAFF_CANNOT_ORDER");
  });
  it("una cuenta del equipo sin locales (acceso revocado) tampoco compra", async () => {
    await db.exec("reset role");
    await db.exec(`insert into public.staff_accounts(user_id,display_name,must_change_password) values('${u.noProfile}','Ex empleado',false)`);
    await as(u.noProfile);
    await rejects(command(db, createInput("ex-staff-buys")), "STAFF_CANNOT_ORDER");
    await db.exec("reset role");
    await db.exec(`delete from public.staff_accounts where user_id='${u.noProfile}'`);
  });
  it("con cuentas obligatorias: sin invitados ni perfiles incompletos; con perfil, sí", async () => {
    await db.exec("reset role");
    await db.exec("update private.configuration set accounts_required=true where id");
    try {
      await as(u.other, "dev-guest", true);
      await rejects(command(db, createInput("guest-buys")), "ACCOUNT_REQUIRED");
      await as(u.noProfile);
      await rejects(command(db, createInput("noprofile-buys")), "ONBOARDING_REQUIRED");
      await as(ids.customer);
      expect((await command(db, createInput("customer-buys"))).id).toBeTruthy();
    } finally {
      await db.exec("reset role");
      await db.exec("update private.configuration set accounts_required=false where id");
    }
  });
});

describe("pagos simulados cerrados por defecto (auditoría)", () => {
  it("con allow_scenarios=false un resultado simulado (rechazo, timeout) se rechaza por RPC directa", async () => {
    await db.exec("reset role");
    await db.exec("update private.configuration set allow_scenarios=false where id");
    try {
      await as(ids.other);
      for (const scenario of ["declined", "timeout", "requires_action"])
        await rejects(command(db, createInput(`scn-${scenario}`, { scenario })), "SCENARIO_DISABLED");
      expect((await command(db, createInput("scn-approved"))).payment_state).toBe("authorized");
    } finally {
      await db.exec("reset role");
      await db.exec("update private.configuration set allow_scenarios=true where id");
    }
  });
  it("con allow_scenarios=false la captura simulada fallida se rechaza", async () => {
    await db.exec("reset role");
    await db.exec("update private.configuration set allow_scenarios=false where id");
    try {
      await as(ids.customer);
      const made = await command(db, createInput("scn-capture"));
      await as(ids.staff, "staff-sc");
      await command(db, { action: "accept", orderId: made.id, expectedVersion: made.version, idempotencyKey: "scn-acc" });
      await command(db, { action: "ready", orderId: made.id, expectedVersion: 2, idempotencyKey: "scn-rdy" });
      const code = createHash("sha256").update("scn-capture").digest("hex").slice(0, 12);
      const claim = await command(db, { action: "resolve", venueId: ids.venue, code });
      for (const scenario of ["declined", "unknown", "timeout_after_success"])
        await rejects(
          command(db, { action: "capture", orderId: made.id, claimId: claim.claim_id, scenario }),
          "SCENARIO_DISABLED",
        );
      const ok = await command(db, { action: "capture", orderId: made.id, claimId: claim.claim_id });
      expect(ok.payment_state).toBe("captured");
    } finally {
      await db.exec("reset role");
      await db.exec("update private.configuration set allow_scenarios=true where id");
    }
  });
});

describe("equipo y plataforma", () => {
  it("las funciones de alta/consulta de equipo no se ejecutan con una sesión normal (solo service_role)", async () => {
    await as(ids.admin);
    await rejects(rpc("team_lookup_email", ["x@y.com"]), /permission denied/i);
    await rejects(rpc("team_attach", [ids.venue, u.other, "X", "bartender", ids.admin, true]), /permission denied/i);
    await rejects(rpc("complete_password_change", [ids.staff]), /permission denied/i);
    await rejects(rpc("auto_accept_tick"), /permission denied/i);
  });
  it("cambiar rol y quitar acceso: solo admin del local; no a sí mismo; nunca al último admin", async () => {
    await as(ids.staff);
    await rejects(rpc("team_set_role", [ids.venue, ids.staff, "admin"]), "NOT_AUTHORIZED");
    await rejects(rpc("team_revoke", [ids.venue, ids.admin]), "NOT_AUTHORIZED");
    await as(u.rivalAdmin);
    await rejects(rpc("team_revoke", [ids.venue, ids.staff]), "NOT_AUTHORIZED");
    await rejects(rpc("list_venue_team", [ids.venue]), "NOT_AUTHORIZED");
    await as(ids.admin);
    await rejects(rpc("team_revoke", [ids.venue, ids.admin]), "SELF_CHANGE");
    await rejects(rpc("team_revoke", [ids.venue, u.onza]), "NOT_AUTHORIZED");
  });
  it("plataforma: solo Onza crea locales y asigna membresías", async () => {
    for (const user of [ids.admin, ids.staff, ids.customer, u.rivalAdmin]) {
      await as(user);
      await rejects(rpc("platform_command", [{ action: "venue_create", name: "Nuevo", slug: "nuevo-" + user.slice(-2), zone: "" }]), "NOT_AUTHORIZED");
      await rejects(rpc("platform_command", [{ action: "membership_save", venueId: ids.venue, userId: user, role: "admin" }]), "NOT_AUTHORIZED");
    }
    await as(u.onza);
    await rpc("platform_command", [{ action: "venue_create", name: "Nuevo", slug: "nuevo-onza", zone: "" }]);
  });
  it("sesión invitada: no es del equipo aunque tenga membresía antigua (is_staff exige no anónimo)", async () => {
    await as(ids.staff, "dev-anon-staff", true);
    await rejects(command(db, { action: "venue_update", venueId: ids.venue, paused: true }), "NOT_AUTHORIZED");
    expect((await rpc("has_venue_access", [ids.venue])).rows[0].r).toBe(false);
  });
  it("clave temporal pendiente: la cuenta no opera aunque conserve su membresía", async () => {
    await db.exec("reset role");
    await db.exec(`insert into public.staff_accounts(user_id,display_name,must_change_password) values('${u.rival}','Rival',true)`);
    await as(u.rival);
    await rejects(command(db, { action: "venue_update", venueId: ids.patio, paused: true }), "NOT_AUTHORIZED");
    expect((await rpc("has_venue_access", [ids.patio])).rows[0].r).toBe(false);
    await db.exec("reset role");
    await db.exec(`delete from public.staff_accounts where user_id='${u.rival}'`);
  });
  it("acceso revocado: la siguiente operación se rechaza al instante (membresía vigente, no JWT)", async () => {
    await as(ids.staff);
    expect((await rpc("has_venue_access", [ids.venue])).rows[0].r).toBe(true);
    await db.exec("reset role");
    await db.exec(`delete from public.memberships where user_id='${ids.staff}'`);
    await as(ids.staff);
    expect((await rpc("has_venue_access", [ids.venue])).rows[0].r).toBe(false);
    await rejects(command(db, { action: "accept", orderId: order.id, expectedVersion: 99, idempotencyKey: "revoked" }), "NOT_AUTHORIZED");
    expect((await db.query("select id from public.orders")).rows).toHaveLength(0);
    await db.exec("reset role");
    await db.exec(`insert into public.memberships(user_id,venue_id,role) values('${ids.staff}','${ids.venue}','bartender')`);
  });
});

describe("catálogo de permisos (bajo los permisos por defecto de Supabase)", () => {
  it("ninguna tabla pública concede escritura, TRUNCATE, REFERENCES ni TRIGGER a anon o authenticated", async () => {
    await db.exec("reset role");
    const { rows } = await db.query<{ t: string; g: string; p: string }>(
      `select table_name t,grantee g,privilege_type p from information_schema.role_table_grants
       where table_schema='public' and grantee in ('anon','authenticated') and privilege_type<>'SELECT' order by 1,2,3`,
    );
    expect(rows).toEqual([]);
  });
  it("lectura pública solo en catálogo y lugares habilitados; el resto exige sesión; order_events no se lee directo", async () => {
    await db.exec("reset role");
    const { rows } = await db.query<{ t: string; g: string }>(
      `select table_name t,grantee g from information_schema.role_table_grants
       where table_schema='public' and grantee in ('anon','authenticated') and privilege_type='SELECT' order by 1,2`,
    );
    const granted = rows.map((r) => `${r.t}:${r.g}`).sort();
    expect(granted).toEqual(
      [
        "categories:anon", "categories:authenticated", "products:anon", "products:authenticated", "venues:anon", "venues:authenticated",
        // Lugares de entrega: públicos para el checkout; la política RLS solo deja ver los habilitados (025).
        "delivery_spots:anon", "delivery_spots:authenticated",
        "memberships:authenticated", "orders:authenticated", "order_items:authenticated", "profiles:authenticated", "staff_accounts:authenticated",
      ].sort(),
    );
  });
  it("funciones públicas ejecutables por anon: solo la utilidad de fecha; las privadas, solo los dos predicados de RLS", async () => {
    await db.exec("reset role");
    const anon = await db.query<{ f: string }>(
      `select n.nspname||'.'||p.proname f from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname in ('public','private') and has_function_privilege('anon',p.oid,'execute') order by 1`,
    );
    expect(anon.rows.map((r) => r.f)).toEqual(["private.can_read_order", "private.is_staff", "public.business_date_at"]);
    const serverOnly = await db.query<{ f: string }>(
      `select p.proname f from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and has_function_privilege('authenticated',p.oid,'execute') and p.proname in ('team_lookup_email','team_attach','complete_password_change','auto_accept_tick')`,
    );
    expect(serverOnly.rows).toEqual([]);
  });
  it("toda función SECURITY DEFINER fija search_path (sin secuestro de esquema)", async () => {
    await db.exec("reset role");
    const { rows } = await db.query<{ f: string }>(
      `select n.nspname||'.'||p.proname f from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname in ('public','private') and p.prosecdef and not coalesce(p.proconfig::text like '%search_path%',false)`,
    );
    expect(rows).toEqual([]);
  });
  it("todas las tablas de public y private tienen RLS activo", async () => {
    await db.exec("reset role");
    const { rows } = await db.query<{ t: string }>(
      `select c.relnamespace::regnamespace||'.'||c.relname t from pg_class c where c.relkind='r' and c.relnamespace in ('public'::regnamespace,'private'::regnamespace) and not c.relrowsecurity`,
    );
    expect(rows).toEqual([]);
  });
});
