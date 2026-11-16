import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
export const ids = {
  customer: "10000000-0000-4000-8000-000000000001",
  other: "10000000-0000-4000-8000-000000000002",
  staff: "10000000-0000-4000-8000-000000000003",
  admin: "10000000-0000-4000-8000-000000000004",
  venue: "20000000-0000-4000-8000-000000000001",
  patio: "20000000-0000-4000-8000-000000000002",
  product: "30000000-0000-4000-8000-000000000001",
};
export async function database() {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;`,
  );
  await db.exec(
    `create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$; grant usage on schema auth to authenticated,anon;grant execute on all functions in schema auth to authenticated,anon;`,
  );
  await db.exec(
    readFileSync("supabase/migrations/202611150001_core.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/202611150003_platform.sql", "utf8"),
  );
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.exec(
    `insert into auth.users values('${ids.customer}'),('${ids.other}'),('${ids.staff}'),('${ids.admin}');insert into public.memberships(user_id,venue_id,role) values('${ids.staff}','${ids.venue}','bartender'),('${ids.admin}','${ids.venue}','admin');`,
  );
  return db;
}
export async function actor(
  db: PGlite,
  user = ids.customer,
  session = "device-a",
  anonymous = true,
) {
  await db.exec("reset role");
  await db.query(`select set_config('request.jwt.claims',$1,false)`, [
    JSON.stringify({ sub: user, session_id: session, is_anonymous: anonymous }),
  ]);
  await db.exec("set role authenticated");
}
export async function command(db: PGlite, input: Record<string, unknown>) {
  const result = await db.query<{ result: Record<string, unknown> }>(
    "select public.onza_command($1::jsonb) as result",
    [JSON.stringify(input)],
  );
  const value = result.rows[0].result;
  if (value.error) throw new Error(String(value.error));
  return value;
}
export function createInput(
  key = "order-one",
  extra: Record<string, unknown> = {},
) {
  return {
    action: "create",
    venueId: ids.venue,
    items: [{ productId: ids.product, quantity: 2, expectedProductVersion: 1 }],
    idempotencyKey: key,
    termsVersion: "demo-v1",
    privacyVersion: "demo-v1",
    adult: true,
    scenario: "approved",
    tokenHash: createHash("sha256").update(key).digest("hex"),
    encryptedToken: "test-cipher",
    ...extra,
  };
}
