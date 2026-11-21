// Vuelca el catálogo de permisos de la cadena completa 001–020 (aislada, sin red). Solo lectura.
import { buildDatabase } from "./chain.mjs";
const db = await buildDatabase();
const q = async (sql) => (await db.query(sql)).rows;

console.log("== TABLAS (esquemas public/private/storage): RLS y grants a anon/authenticated");
for (const r of await q(`
 select n.nspname s, c.relname t, c.relrowsecurity rls, c.relforcerowsecurity frls,
  (select string_agg(distinct g.grantee||':'||g.privilege_type, ',' order by g.grantee||':'||g.privilege_type) from information_schema.role_table_grants g where g.table_schema=n.nspname and g.table_name=c.relname and g.grantee in ('anon','authenticated','PUBLIC')) grants
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname in ('public','private','storage') order by 1,2`))
  console.log(`${r.s}.${r.t} rls=${r.rls} grants=${r.grants ?? "-"}`);

console.log("\n== POLÍTICAS");
for (const r of await q(`select schemaname||'.'||tablename t, policyname, cmd, roles::text, qual, with_check from pg_policies order by 1,2`))
  console.log(`${r.t} · ${r.policyname} · ${r.cmd} · ${r.roles}\n   using: ${r.qual}\n   check: ${r.with_check}`);

console.log("\n== FUNCIONES con EXECUTE para anon/authenticated/PUBLIC");
for (const r of await q(`
 select n.nspname s, p.proname f, pg_get_function_identity_arguments(p.oid) a, p.prosecdef definer, p.proconfig cfg,
  has_function_privilege('anon',p.oid,'execute') anon, has_function_privilege('authenticated',p.oid,'execute') auth
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') order by 1,2`))
  console.log(`${r.s}.${r.f}(${r.a}) definer=${r.definer} search_path=${r.cfg ?? "NONE"} anon=${r.anon} auth=${r.auth}`);
await db.close();
