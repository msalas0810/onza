// Cadena completa de migraciones sobre PGlite (base aislada en memoria, datos ficticios).
// Simula solo lo mínimo de Supabase: roles, auth.uid()/auth.jwt(), esquema storage y la publicación realtime.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";

const DIR = new URL("../../supabase/migrations/", import.meta.url);
export const migrationFiles = () =>
  readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

export const read = (file) => readFileSync(new URL(file, DIR), "utf8");

export const SUPABASE_STUB = `
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}', is_anonymous boolean default false);
create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;
grant usage on schema auth to authenticated,anon,service_role;
grant execute on all functions in schema auth to authenticated,anon,service_role;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner uuid default auth.uid());
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
grant usage on schema storage to anon,authenticated,service_role;
grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
grant select on storage.buckets to anon,authenticated,service_role;
create publication supabase_realtime;
-- Supabase concede por defecto TODO en public a anon/authenticated/service_role a cada objeto nuevo (ALTER DEFAULT PRIVILEGES del
-- rol postgres). Sin esto el catálogo se ve más cerrado de lo que está en un proyecto real; las migraciones deben revocar a mano.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
`;

/** Aplica la cadena. `upTo`: prefijo (inclusive) del último archivo; `only`: lista explícita. */
export async function buildDatabase({ upTo, from, skip = [] } = {}) {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of migrationFiles()) {
    if (upTo && file.slice(0, 12) > upTo) continue;
    if (from && file.slice(0, 12) <= from) continue;
    if (skip.includes(file.slice(0, 12))) continue;
    await db.exec(read(file));
  }
  return db;
}
