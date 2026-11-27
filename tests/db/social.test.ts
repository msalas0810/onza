import type { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { actor, command, createInput, database, ids } from "./helpers";

// Cuentas ficticias: ids.customer (ana) y ids.other (beto) más tres clientes extra para el mapa de actividad.
const extra = [
  "10000000-0000-4000-8000-0000000000e1",
  "10000000-0000-4000-8000-0000000000e2",
  "10000000-0000-4000-8000-0000000000e3",
];
const closedVenue = "20000000-0000-4000-8000-000000000003";

async function setup() {
  const db = await database();
  await db.exec(`insert into auth.users(id) values ${extra.map((id) => `('${id}')`).join(",")}`);
  const people = [
    [ids.customer, "Ana Cliente", "ana"],
    [ids.other, "Beto Cliente", "beto"],
    [extra[0], "Caro Uno", "caro"],
    [extra[1], "Dani Dos", "dani"],
    [extra[2], "Eli Tres", "eli"],
  ];
  await db.exec(
    `insert into public.profiles(user_id,full_name,username,phone_country,phone_e164,birth_date,terms_version,privacy_version,terms_accepted_at) values ${people
      .map(([id, name, user], i) => `('${id}','${name}','${user}','+506','+5068888770${i}','1995-05-05','v1','v1',now())`)
      .join(",")}`,
  );
  // Coordenadas de prueba solo para el local de la prueba (el seed no inventa coordenadas).
  await db.exec(`update public.venues set latitude=9.93,longitude=-84.08 where id='${ids.venue}'`);
  return db;
}
const as = (db: PGlite, user: string) => actor(db, user, "phone", false);
const rpc = async <T = Record<string, unknown>>(db: PGlite, sql: string, args: unknown[] = []) =>
  (await db.query<{ r: T }>(`select ${sql} as r`, args)).rows[0].r;
const checkin = (db: PGlite, venue = ids.venue, extraInput: Record<string, unknown> = {}) =>
  rpc(db, "public.social_checkin($1::jsonb)", [JSON.stringify({ venueId: venue, minutes: 60, ...extraInput })]);
const overview = (db: PGlite) =>
  rpc<{
    checkin: { share: boolean; venueName: string; expiresAt: string } | null;
    friends: { username: string; venue: { name: string; expiresAt: string } | null }[];
    incoming: { id: string; username: string }[];
    outgoing: { username: string }[];
  }>(db, "public.social_overview()");
const activity = (db: PGlite) =>
  rpc<{ venueId: string; level: number; [k: string]: unknown }[]>(db, "public.venue_activity()");

describe("social: quién puede usarlo", () => {
  it("rechaza al equipo, a la sesión invitada y a una cuenta sin perfil", async () => {
    const db = await setup();
    await actor(db, ids.staff, "x", false);
    await expect(checkin(db)).rejects.toThrow("STAFF_NOT_SOCIAL");
    await actor(db, ids.customer, "x", true);
    await expect(checkin(db)).rejects.toThrow("ACCOUNT_REQUIRED");
    await db.exec("reset role");
    await db.exec(`delete from public.profiles where user_id='${extra[2]}'`);
    await as(db, extra[2]);
    await expect(overview(db)).rejects.toThrow("ONBOARDING_REQUIRED");
  });
  it("las tablas no se leen ni escriben directo, solo por las funciones", async () => {
    const db = await setup();
    await as(db, ids.customer);
    await expect(db.query("select * from public.venue_checkins")).rejects.toThrow();
    await expect(db.query("select * from public.friendships")).rejects.toThrow();
    await expect(
      db.query(`insert into public.friendships(requester,addressee,status) values('${ids.customer}','${ids.other}','accepted')`),
    ).rejects.toThrow();
  });
});

describe("social: check-in y mapa de actividad", () => {
  it("valida duración y local, y deja un solo check-in activo por persona", async () => {
    const db = await setup();
    await as(db, ids.customer);
    await expect(checkin(db, ids.venue, { minutes: 600 })).rejects.toThrow("INVALID_INPUT");
    await expect(checkin(db, closedVenue)).rejects.toThrow("VENUE_CLOSED");
    const first = await checkin(db);
    expect(first).toMatchObject({ venueId: ids.venue, share: false }); // compartir arranca apagado
    await checkin(db, ids.patio);
    await checkin(db, ids.venue);
    await db.exec("reset role");
    const active = await db.query<{ n: number }>(
      `select count(*)::int as n from public.venue_checkins where user_id='${ids.customer}' and ended_at is null and expires_at>now()`,
    );
    expect(active.rows[0].n).toBe(1);
  });
  it("sin actividad devuelve vacío; menos de 3 personas no se muestra; 3 o más da solo un nivel, sin conteos", async () => {
    const db = await setup();
    await as(db, ids.customer);
    expect(await activity(db)).toEqual([]);
    for (const user of [ids.customer, ids.other]) {
      await as(db, user);
      await checkin(db);
      await checkin(db); // la misma persona otra vez no suma
    }
    expect(await activity(db)).toEqual([]); // 2 personas: conteo chico, oculto
    await as(db, extra[0]);
    await checkin(db);
    const rows = await activity(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ venueId: ids.venue, level: 1 });
    expect(JSON.stringify(rows)).not.toMatch(/people|count|user/i);
  });
  it("lo vencido, lo cerrado y los locales sin coordenadas no cuentan", async () => {
    const db = await setup();
    for (const user of [ids.customer, ids.other, extra[0]]) {
      await as(db, user);
      await checkin(db, ids.patio); // Patio Central no tiene coordenadas
    }
    await as(db, ids.customer);
    expect(await activity(db)).toEqual([]);
    for (const user of [ids.customer, ids.other, extra[0]]) {
      await as(db, user);
      await checkin(db);
    }
    expect(await activity(db)).toHaveLength(1);
    await as(db, extra[0]);
    await rpc(db, "public.social_checkout()");
    expect(await activity(db)).toEqual([]);
    await as(db, extra[0]);
    await checkin(db);
    await db.exec("reset role");
    await db.exec(
      `update public.venue_checkins set created_at=now()-interval '2 hours', expires_at=now()-interval '1 minute' where user_id='${extra[0]}' and ended_at is null`,
    );
    await as(db, ids.customer);
    expect(await activity(db)).toEqual([]);
  });
  it("hacer un pedido no crea un check-in", async () => {
    const db = await setup();
    await as(db, ids.customer);
    await command(db, createInput("social-order"));
    await db.exec("reset role");
    const rows = await db.query<{ n: number }>("select count(*)::int as n from public.venue_checkins");
    expect(rows.rows[0].n).toBe(0);
  });
});

describe("social: amigos y compartir", () => {
  it("solicitud por @usuario, aceptación, y solo la amistad aceptada ve el local compartido", async () => {
    const db = await setup();
    await as(db, ids.customer);
    await expect(rpc(db, "public.social_friend_request($1)", ["ana"])).rejects.toThrow("FRIEND_SELF");
    await expect(rpc(db, "public.social_friend_request($1)", ["nadie"])).rejects.toThrow("FRIEND_NOT_FOUND");
    expect(await rpc(db, "public.social_friend_request($1)", ["@Beto"])).toMatchObject({ status: "pending" });
    await checkin(db, ids.venue, { share: true });

    // Pendiente: Beto ve la solicitud, pero todavía no el local.
    await as(db, ids.other);
    let beto = await overview(db);
    expect(beto.friends).toEqual([]);
    expect(beto.incoming.map((r) => r.username)).toEqual(["ana"]);
    await rpc(db, "public.social_friend_respond($1,true)", [beto.incoming[0].id]);
    beto = await overview(db);
    expect(beto.friends[0]).toMatchObject({ username: "ana", venue: { name: "Sala Norte" } });
    expect(beto.friends[0].venue?.expiresAt).toBeTruthy();

    // Alguien fuera de la relación no ve nada de Ana.
    await as(db, extra[0]);
    const caro = await overview(db);
    expect(caro.friends).toEqual([]);
    expect(JSON.stringify(caro)).not.toContain("Sala Norte");

    // Dejar de compartir es inmediato.
    await as(db, ids.customer);
    expect(await rpc(db, "public.social_share(false)")).toMatchObject({ share: false });
    await as(db, ids.other);
    expect((await overview(db)).friends[0].venue).toBeNull();

    // Volver a compartir y vencer: desaparece al vencer.
    await as(db, ids.customer);
    await rpc(db, "public.social_share(true)");
    await as(db, ids.other);
    expect((await overview(db)).friends[0].venue).not.toBeNull();
    await db.exec("reset role");
    await db.exec(
      `update public.venue_checkins set created_at=now()-interval '2 hours', expires_at=now()-interval '1 second' where user_id='${ids.customer}'`,
    );
    await as(db, ids.other);
    expect((await overview(db)).friends[0].venue).toBeNull();
    await as(db, ids.customer);
    await expect(rpc(db, "public.social_share(true)")).rejects.toThrow("CHECKIN_REQUIRED");
  });
  it("una solicitud cruzada queda aceptada; quitar la amistad corta el acceso; solo quien recibe responde", async () => {
    const db = await setup();
    await as(db, ids.customer);
    await rpc(db, "public.social_friend_request($1)", ["beto"]);
    const pending = (await db.query<{ id: string }>("select (public.social_overview()->'outgoing'->0->>'id') as id")).rows[0];
    expect(pending.id).toBe(ids.other);
    // Ana no puede aceptar su propia solicitud.
    await db.exec("reset role");
    const request = (await db.query<{ id: string }>("select id from public.friendships")).rows[0].id;
    await as(db, ids.customer);
    await expect(rpc(db, "public.social_friend_respond($1,true)", [request])).rejects.toThrow("RESOURCE_NOT_FOUND");
    await as(db, ids.other);
    expect(await rpc(db, "public.social_friend_request($1)", ["ana"])).toMatchObject({ status: "accepted" });
    await as(db, ids.customer);
    await checkin(db, ids.venue, { share: true });
    await as(db, ids.other);
    expect((await overview(db)).friends[0].venue).not.toBeNull();
    await rpc(db, "public.social_friend_remove($1)", [ids.customer]);
    expect((await overview(db)).friends).toEqual([]);
  });
});
