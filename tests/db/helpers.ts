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
  await db.exec(
    readFileSync(
      "supabase/migrations/202611160004_explicit_private_permissions.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync("supabase/migrations/202611160005_venue_images.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/202611160007_product_images.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/202611160008_secure_pickup.sql", "utf8"),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202611160009_venue_coordinates.sql",
      "utf8",
    ),
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

// The Supabase storage schema does not exist in PGlite. This installs the minimum (objects table with RLS, foldername)
// and runs the REAL venue-images storage migration. It does not test size/MIME limits: the Storage service enforces those.
export async function installStorageStub(db: PGlite) {
  await db.exec("reset role");
  await db.exec(`
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner uuid default auth.uid());
    create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
    grant select on storage.buckets to anon,authenticated;
  `);
  await db.exec(
    readFileSync(
      "supabase/migrations/202611160006_venue_images_storage.sql",
      "utf8",
    ),
  );
}
