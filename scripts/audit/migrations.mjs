// Migraciones 013–022 sobre Postgres 17 REAL y aislado: (A) desde una base vacía y (B) actualizando desde 012 con datos
// ficticios en todos los estados; compara el esquema final de ambos caminos, comprueba que los datos se conservan y que la
// aplicación sigue funcionando sobre pedidos antiguos, y mide cuánto tarda el salto sobre un volumen grande.
// Trata 001–012 como historial: no se modifican; solo se aplican los archivos tal como están.
// Uso: node scripts/audit/migrations.mjs [--volume=100000]
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { startPostgres } from "./pg.mjs";
import { migrationFiles } from "./chain.mjs";

const volume = Number(process.argv.find((a) => a.startsWith("--volume="))?.split("=")[1] ?? 100000);
let total = 0;
let failed = 0;
const check = (name, ok, detail = "") => {
  total++;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${detail}`}`);
};
const id = (n, k) => `${n}0000000-0000-4000-8000-${String(k).padStart(12, "0")}`;
const V1 = "20000000-0000-4000-8000-000000000001";
const PRODUCT = "30000000-0000-4000-8000-000000000001";
const staff = id(5, 1);
const admin = id(5, 2);
const customer = (k) => id(1, k);
const seedSql = readFileSync(new URL("../../supabase/seed.sql", import.meta.url), "utf8");

const FINGERPRINT = `
 select 'col '||table_schema||'.'||table_name||'.'||column_name||' '||data_type||' null='||is_nullable||' def='||coalesce(regexp_replace(column_default,'[0-9a-f]{8}-[0-9a-f-]{27}','<uuid>','g'),'') l
   from information_schema.columns where table_schema in ('public','private')
 union all select 'con '||conrelid::regclass||' '||conname||' '||pg_get_constraintdef(oid) from pg_constraint where connamespace in ('public'::regnamespace,'private'::regnamespace)
 union all select 'idx '||indexdef from pg_indexes where schemaname in ('public','private')
 union all select 'fn '||n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||') '||md5(p.prosrc)||' definer='||p.prosecdef||' cfg='||coalesce(p.proconfig::text,'')||' acl='||coalesce(p.proacl::text,'') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')
 union all select 'pol '||schemaname||'.'||tablename||' '||policyname||' '||cmd||' '||coalesce(qual,'')||' | '||coalesce(with_check,'') from pg_policies
 union all select 'trg '||event_object_schema||'.'||event_object_table||' '||trigger_name||' '||action_timing||' '||event_manipulation from information_schema.triggers where trigger_schema in ('public','private')
 union all select 'grt '||table_schema||'.'||table_name||' '||grantee||' '||privilege_type from information_schema.role_table_grants where table_schema in ('public','private') and grantee in ('anon','authenticated','service_role')
 union all select 'rls '||c.relnamespace::regnamespace||'.'||c.relname||' '||c.relrowsecurity from pg_class c where c.relkind='r' and c.relnamespace in ('public'::regnamespace,'private'::regnamespace)
 union all select 'pub '||pubname||' '||schemaname||'.'||tablename from pg_publication_tables
 order by 1`;
const fingerprint = async (db) => (await db.query(FINGERPRINT)).rows.map((r) => r.l);

const pg = await startPostgres();
const all = migrationFiles();
const upgrade = all.filter((f) => f.slice(0, 12) > "202611170012");
const step = (f) => f.slice(0, 12);

async function asUser(db, user, fn, session = "s-" + user.slice(-3)) {
  return pg.asUser(db, user, fn, { session });
}
async function run(db, user, input, session) {
  return asUser(db, user, async (c) => (await c.query("select public.onza_command($1::jsonb) r", [JSON.stringify(input)])).rows[0].r, session);
}
let n = 0;
const createInput = (key) => ({
  action: "create", venueId: V1, items: [{ productId: PRODUCT, quantity: 1, expectedProductVersion: 1 }], idempotencyKey: key,
  termsVersion: "demo-v1", privacyVersion: "demo-v1", adult: true, scenario: "approved",
  tokenHash: createHash("sha256").update(`${key}-${n++}`).digest("hex"), encryptedToken: "x",
});
async function people(db) {
  const users = [staff, admin, ...Array.from({ length: 40 }, (_, i) => customer(i + 1))];
  await db.query(`insert into auth.users(id,email) select x,x||'@t.test' from unnest($1::uuid[]) x`, [users]);
  await db.query(`insert into public.memberships(user_id,venue_id,role) values($1,$3,'bartender'),($2,$3,'admin')`, [staff, admin, V1]);
}

try {
  /* A · Base vacía → 001–022 */
  const a = await pg.database({ label: "empty" });
  check("A Base vacía: 001–022 se aplican sin errores", true);
  const fpA = await fingerprint(a);

  /* B · 001–012 con datos → 013–021 */
  const b = await pg.database({ label: "upgrade", upTo: "202611170012" });
  await b.query(seedSql);
  await people(b);
  // Pedidos reales por el camino de 012 (versión anterior de onza_command) en todos los estados.
  const orders = {};
  for (let i = 1; i <= 8; i++) orders[i] = await run(b, customer(i), createInput(`old-${i}`));
  await run(b, staff, { action: "accept", orderId: orders[2].id, expectedVersion: 1, idempotencyKey: "o-a2" });
  await run(b, staff, { action: "accept", orderId: orders[3].id, expectedVersion: 1, idempotencyKey: "o-a3" });
  await run(b, staff, { action: "ready", orderId: orders[3].id, expectedVersion: 2, idempotencyKey: "o-r3" });
  await run(b, customer(4), { action: "cancel", orderId: orders[4].id, expectedVersion: 1, idempotencyKey: "o-c4", reason: "cambié de idea" });
  await run(b, staff, { action: "accept", orderId: orders[5].id, expectedVersion: 1, idempotencyKey: "o-a5" });
  await run(b, staff, { action: "ready", orderId: orders[5].id, expectedVersion: 2, idempotencyKey: "o-r5" });
  const code5 = createHash("sha256").update(`old-5-${4}`).digest("hex").slice(0, 12);
  const claim = await run(b, staff, { action: "resolve", venueId: V1, code: code5 }, "sess-s");
  await run(b, staff, { action: "capture", orderId: orders[5].id, claimId: claim.claim_id }, "sess-s");
  await run(b, staff, { action: "complete", orderId: orders[5].id, claimId: claim.claim_id, physicalHandoff: true }, "sess-s");
  const before = (await b.query(`select status,count(*)::int n from public.orders group by 1 order by 1`)).rows;
  const beforeMoney = (await b.query(`select coalesce(sum(captured_minor),0)::bigint c,count(*)::int n from private.payments`)).rows[0];
  const beforeEvents = Number((await b.query(`select count(*) n from public.order_events`)).rows[0].n);
  console.log(`  (012 con datos: ${JSON.stringify(before)})`);

  /* Volumen para medir el salto */
  const t0 = Date.now();
  await b.query(
    `insert into auth.users(id,email) select ('77000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'bulk'||g||'@t.test' from generate_series(1,2000) g`,
  );
  await b.query(
    `insert into public.orders(id,venue_id,customer_id,public_code,status,total_minor,deadline,created_at,business_date,version)
     select ('88000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,$1,('77000000-0000-4000-8000-'||lpad((g%2000+1)::text,12,'0'))::uuid,'Z'||g::text,
       case when g%10=0 then 'canceled' when g%7=0 then 'expired' else 'delivered' end,450000,now()-interval '3 days',now()-(g||' minutes')::interval,current_date-(g%90),3
     from generate_series(1,$2) g`,
    [V1, volume],
  );
  await b.query(
    `insert into public.order_items(order_id,venue_id,product_id,name_snapshot,unit_price_minor_snapshot,quantity,line_total_minor)
     select id,venue_id,$1,'Paloma',450000,1,450000 from public.orders where id::text like '88000000%'`,
    [PRODUCT],
  );
  await b.query(
    `insert into private.payments(order_id,merchant_config_ref,status,authorized_minor,captured_minor,provider_reference)
     select id,'mock:'||venue_id,case status when 'delivered' then 'captured' else 'voided' end,450000,case status when 'delivered' then 450000 else 0 end,'mock-'||id from public.orders where id::text like '88000000%'`,
  );
  await b.query(
    `insert into public.order_events(order_id,venue_id,type,to_status,created_at)
     select id,venue_id,'created','queued',created_at from public.orders where id::text like '88000000%'`,
  );
  console.log(`  (volumen sintético: ${volume} pedidos con ítems, pagos y eventos, cargado en ${((Date.now() - t0) / 1000).toFixed(1)} s)`);

  const timings = [];
  for (const file of upgrade) {
    const t = Date.now();
    await b.query(readFileSync(new URL(`../../supabase/migrations/${file}`, import.meta.url), "utf8"));
    timings.push([step(file), Date.now() - t]);
  }
  check(`B Salto 012 → 022 con ${volume} pedidos: aplica sin errores`, true);
  console.log(`  tiempos por migración (ms): ${timings.map(([s, ms]) => `${s.slice(6)}=${ms}`).join(" ")}; total ${timings.reduce((x, [, ms]) => x + ms, 0)} ms`);
  check("B Ninguna migración tarda más de 5 s sobre ese volumen (sin bloqueos largos de tabla)", timings.every(([, ms]) => ms < 5000), JSON.stringify(timings));

  const after = (await b.query(`select status,count(*)::int n from public.orders where id::text not like '88000000%' group by 1 order by 1`)).rows;
  check("B Los pedidos existentes conservan estado y datos", JSON.stringify(after) === JSON.stringify(before), `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
  const afterMoney = (await b.query(`select coalesce(sum(captured_minor),0)::bigint c,count(*)::int n from private.payments where order_id::text not like '88000000%'`)).rows[0];
  check("B Pagos y montos intactos", String(afterMoney.c) === String(beforeMoney.c) && afterMoney.n === beforeMoney.n, JSON.stringify([beforeMoney, afterMoney]));
  check("B Eventos intactos", Number((await b.query(`select count(*) n from public.order_events where order_id::text not like '88000000%'`)).rows[0].n) === beforeEvents);
  const unexpectedQueue = Number((await b.query(`select count(*) n from public.orders where status='queued' and queued_at is null`)).rows[0].n);
  console.log(`  (pedidos en cola sin queued_at tras el salto: ${unexpectedQueue}; la lógica usa coalesce(queued_at,created_at))`);

  /* Esquema final: ambos caminos deben coincidir */
  const fpB = await fingerprint(b);
  const onlyA = fpA.filter((l) => !fpB.includes(l));
  const onlyB = fpB.filter((l) => !fpA.includes(l));
  check("A≡B El esquema final (columnas, restricciones, índices, funciones, políticas, triggers, permisos) es idéntico por ambos caminos", onlyA.length === 0 && onlyB.length === 0, `solo-vacía=${JSON.stringify(onlyA.slice(0, 4))} solo-salto=${JSON.stringify(onlyB.slice(0, 4))}`);
  check("A≡B Mismo conjunto de migraciones (22 archivos)", all.length === 22, String(all.length));

  /* La aplicación sigue funcionando sobre pedidos antiguos y nuevos */
  const old2 = await run(b, staff, { action: "get", orderId: orders[2].id });
  check("B Un pedido anterior a 013 (en preparación) se lee con el esquema nuevo", old2.status === "preparing" && !!old2.server_now, JSON.stringify(old2).slice(0, 120));
  const old1 = await run(b, staff, { action: "accept", orderId: orders[1].id, expectedVersion: 1, idempotencyKey: "post-a1" });
  check("B Un pedido en cola creado antes de 013 se acepta después (usa created_at si falta queued_at)", old1.status === "preparing", JSON.stringify(old1).slice(0, 120));
  const fresh = await run(b, customer(30), { ...createInput("post-new") });
  check("B Un pedido nuevo funciona (cola, ventana de 5 min)", fresh.status === "queued" && !!fresh.queued_at, JSON.stringify(fresh).slice(0, 120));
  const clientView = await asUser(b, customer(30), async (c) => (await c.query(`select public.order_list(null,$1) r`, [fresh.id])).rows[0].r[0]);
  check("B 021 en la base actualizada: el cliente no recibe actor_id ni metadata", clientView.events.every((e) => e.actor_id === null && Object.keys(e.metadata).length === 0), JSON.stringify(clientView.events[0]));
  const staffTry = await run(b, staff, createInput("staff-after")).then(() => "creó", (e) => e.message);
  check("B 021: el empleado no puede crear pedidos tras la actualización", staffTry === "STAFF_CANNOT_ORDER", staffTry);
  const bigCount = Number((await b.query(`select count(*) n from public.orders`)).rows[0].n);
  check("B El volumen sintético sigue completo", bigCount >= volume + 8, String(bigCount));

  /* Rendimiento del barrido con volumen (insumo de la fase de escala) */
  const t1 = Date.now();
  await asUser(b, staff, async (c) => c.query("select public.sweep_orders()"));
  console.log(`  (sweep_orders con ${volume} pedidos históricos: ${Date.now() - t1} ms)`);
  await a.pool.end();
  await b.pool.end();
} catch (error) {
  failed++;
  console.error(`✗ Error inesperado: ${error.stack ?? error}`);
} finally {
  await pg.close();
}
console.log(`\n${total - failed}/${total} comprobaciones superadas${failed ? `, ${failed} fallaron` : ""}.`);
process.exit(failed ? 1 : 0);
