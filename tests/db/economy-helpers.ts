import { createHash } from "node:crypto";
import { actor, command, createInput, database, ids } from "./helpers";

export type Db = Awaited<ReturnType<typeof database>>;

export const users = {
  onza: "10000000-0000-4000-8000-0000000000a1",
  friend: "10000000-0000-4000-8000-0000000000a2",
  stranger: "10000000-0000-4000-8000-0000000000a3",
  minor: "10000000-0000-4000-8000-0000000000a4",
};

/** El dueño del esquema lee y prepara datos sin las restricciones de RLS. */
export async function owner<T = Record<string, unknown>>(
  db: Db,
  sql: string,
  params: unknown[] = [],
) {
  await db.exec("reset role");
  return (await db.query<T>(sql, params)).rows;
}

/** Base de pruebas: cliente con perfil, tres perfiles más (amigo, desconocido, menor) y un megaadministrador. */
export async function setup() {
  const db = await database();
  await db.exec("reset role");
  await db.exec(
    `insert into auth.users(id) values('${users.onza}'),('${users.friend}'),('${users.stranger}'),('${users.minor}');
     insert into public.memberships(user_id,venue_id,role) values('${users.onza}','${ids.venue}','onza');
     insert into public.profiles(user_id,full_name,username,phone_country,phone_e164,birth_date,terms_version,privacy_version,terms_accepted_at) values
      ('${ids.customer}','Sofía Vargas','sofiav','+506','+50688887771','1990-01-01','demo-v1','demo-v1',now()),
      ('${users.friend}','Mario Rojas','marior','+506','+50688887772','1991-02-02','demo-v1','demo-v1',now()),
      ('${users.stranger}','Laura Mora','lauram','+506','+50688887773','1992-03-03','demo-v1','demo-v1',now()),
      ('${users.minor}','Joven Prueba','joven','+506','+50688887774',(now()-interval '16 years')::date,'demo-v1','demo-v1',now())`,
  );
  return db;
}

export const asOnza = (db: Db) => actor(db, users.onza, "onza-device", false);
export const asUser = (db: Db, id: string = ids.customer) =>
  actor(db, id, `dev-${id.slice(-4)}`, false);

/** Llama a una RPC pública como la persona indicada y devuelve su resultado JSON. */
export async function rpc<T = Record<string, unknown>>(
  db: Db,
  as: "onza" | string,
  fn: string,
  ...args: unknown[]
) {
  if (as === "onza") await asOnza(db);
  else await asUser(db, as);
  const placeholders = args.map((_, i) => `$${i + 1}`).join(",");
  const r = await db.query<{ r: T }>(
    `select public.${fn}(${placeholders}) as r`,
    args.map((a) =>
      typeof a === "object" && a !== null ? JSON.stringify(a) : a,
    ),
  );
  return r.rows[0].r;
}

export async function adminCommand(
  db: Db,
  entity: string,
  values: Record<string, unknown>,
) {
  return rpc(db, "onza", "economy_admin_command", { entity, values });
}

/** Pedido real hasta cobro capturado (queda entregado): crea, acepta, marca listo y cobra con el código. */
export async function paidOrder(
  db: Db,
  key: string,
  customer: string = ids.customer,
) {
  await actor(db, customer, `device-${key}`, false);
  const made = await command(db, createInput(key));
  await actor(db, ids.staff, `bar-${key}`, false);
  await command(db, {
    action: "accept",
    orderId: made.id,
    expectedVersion: made.version,
    idempotencyKey: `acc-${key}`,
  });
  await command(db, {
    action: "ready",
    orderId: made.id,
    expectedVersion: 2,
    idempotencyKey: `rdy-${key}`,
  });
  const claim = await command(db, {
    action: "resolve",
    venueId: ids.venue,
    code: createHash("sha256").update(key).digest("hex").slice(0, 12),
  });
  await command(db, {
    action: "capture",
    orderId: made.id,
    claimId: claim.claim_id,
  });
  await command(db, {
    action: "complete",
    orderId: made.id,
    claimId: claim.claim_id,
    physicalHandoff: true,
  });
  return made.id as string;
}

export type Wallet = {
  coins: number;
  xp: number;
  level: number;
  venues_unlocked: number;
  coin_history: { kind: string; amount: number }[];
  achievements: {
    code: string;
    unlocked_at: string | null;
    progress: number;
  }[];
};

export const wallet = (db: Db, who: string = ids.customer) =>
  rpc<Wallet>(db, who, "economy_wallet");

/** Permite varios pedidos premiados seguidos en una prueba. */
export async function relaxLimits(db: Db) {
  await adminCommand(db, "settings", {
    crc_per_coin: 100,
    max_rewarded_orders_per_day: 50,
    min_minutes_between_rewarded: 0,
    daily_coin_cap: 1000,
    daily_xp_cap: 1000,
  });
}
