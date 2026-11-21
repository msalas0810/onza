// Postgres 17 REAL, efímero y aislado (embedded-postgres) para las pruebas que PGlite no puede hacer: transacciones
// concurrentes con bloqueos reales, cadena de migraciones y carga. No toca ningún proyecto remoto.
//
// Requisito (una vez, fuera del repo y sin tocar package.json):
//   mkdir -p ~/Documents/Onza/audit-tools && cd ~/Documents/Onza/audit-tools && npm init -y &&
//   npm install embedded-postgres@17.12.0-beta.19 pg@8.13.1
// Variable opcional: ONZA_AUDIT_TOOLS (por defecto ~/Documents/Onza/audit-tools).
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdtempSync, rmSync } from "node:fs";
import { migrationFiles, read, SUPABASE_STUB } from "./chain.mjs";

const TOOLS = process.env.ONZA_AUDIT_TOOLS ?? join(homedir(), "Documents/Onza/audit-tools");
const toolRequire = createRequire(join(TOOLS, "package.json"));

/** Postgres en un directorio temporal y un puerto libre. `close()` lo detiene y borra los datos. */
export async function startPostgres({ port = 54500 + Math.floor(Math.random() * 400) } = {}) {
  const { default: EmbeddedPostgres } = await import(pathToFileURL(toolRequire.resolve("embedded-postgres")).href);
  const pg = toolRequire("pg");
  const dir = mkdtempSync(join(tmpdir(), "onza-audit-pg-"));
  const server = new EmbeddedPostgres({
    databaseDir: dir,
    user: "postgres",
    password: "audit",
    port,
    persistent: false,
    postgresFlags: ["-c", "max_connections=300", "-c", "fsync=off", "-c", "synchronous_commit=off"],
    onLog: () => {},
    onError: () => {},
  });
  await server.initialise();
  await server.start();
  const admin = new pg.Client({ host: "127.0.0.1", port, user: "postgres", password: "audit", database: "postgres" });
  await admin.connect();
  await admin.query(`do $$ begin
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
    if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
  end $$`);
  let counter = 0;
  return {
    pg,
    port,
    /** Base nueva con el stub de Supabase y las migraciones pedidas. */
    async database({ upTo, from, only, files, label = "t" } = {}) {
      const name = `${label}_${Date.now().toString(36)}_${counter++}`;
      await admin.query(`create database ${name}`);
      const pool = new pg.Pool({ host: "127.0.0.1", port, user: "postgres", password: "audit", database: name, max: 60 });
      const stub = SUPABASE_STUB.replace(/create role anon;\s*create role authenticated;\s*create role service_role;/, "");
      pool.on("error", (e) => console.error(`[pool ${name}] ${e.code ?? ""} ${e.message}`));
      await pool.query(stub);
      const list = files ?? migrationFiles();
      for (const file of list) {
        const id = file.slice(0, 12);
        if (upTo && id > upTo) continue;
        if (from && id <= from) continue;
        if (only && !only.includes(id)) continue;
        await pool.query(read(file));
      }
      return { name, pool, query: (...a) => pool.query(...a) };
    },
    /** Ejecuta `fn(client)` en una transacción con la identidad (JWT) simulada de un usuario. */
    async asUser(db, user, fn, { anonymous = false, session = "s-" + user.slice(-4), role = "authenticated" } = {}) {
      const client = await db.pool.connect();
      try {
        await client.query("begin");
        await client.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({ sub: user, session_id: session, is_anonymous: anonymous }),
        ]);
        await client.query(`set local role ${role}`);
        const value = await fn(client);
        await client.query("commit");
        return value;
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await admin.end().catch(() => undefined);
      await server.stop().catch(() => undefined);
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
