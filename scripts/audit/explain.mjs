// Planes y tiempos de las consultas calientes con un volumen de historia dado (Postgres real, aislado).
// Uso: node scripts/audit/explain.mjs [--history=20000] [--apply=ruta.sql]   (--apply aplica ese SQL antes de medir)
import { readFileSync } from "node:fs";
import { startPostgres } from "./pg.mjs";
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? f;
const history = Number(arg("history", 20000));
const apply = arg("apply", "");
const V1 = "20000000-0000-4000-8000-000000000001";
const staff = "50000000-0000-4000-8000-000000000001";
const admin = "50000000-0000-4000-8000-000000000009";
const pg = await startPostgres();
const db = await pg.database({ label: "explain" });
await db.query(readFileSync(new URL("../../supabase/seed.sql", import.meta.url), "utf8"));
await db.query(`insert into auth.users(id,email) values('${staff}','s@t'),('${admin}','a@t'); insert into public.memberships values('${staff}','${V1}','bartender'),('${admin}','${V1}','admin');`);
await db.query(`insert into auth.users(id,email) select ('10000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'c'||g||'@t' from generate_series(1,2000) g`);
await db.query(`update private.configuration set allow_scenarios=true`);
await db.query(`insert into public.orders(id,venue_id,customer_id,public_code,status,total_minor,deadline,created_at,queued_at,preparing_at,ready_at,delivered_at,business_date,version)
  select ('99000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,$1,('10000000-0000-4000-8000-'||lpad((g%2000+1)::text,12,'0'))::uuid,'H'||g::text,'delivered',450000,now(),
   now()-(g||' minutes')::interval,now()-(g||' minutes')::interval,now()-(g||' minutes')::interval+interval '40 seconds',now()-(g||' minutes')::interval+interval '3 minutes',now()-(g||' minutes')::interval+interval '4 minutes',public.business_date_at(now()-(g||' minutes')::interval),4
  from generate_series(1,$2) g`, [V1, history]);
await db.query(`insert into public.order_items(order_id,venue_id,product_id,name_snapshot,unit_price_minor_snapshot,quantity,line_total_minor) select o.id,o.venue_id,'30000000-0000-4000-8000-000000000001','Paloma',450000,1,450000 from public.orders o`);
await db.query(`insert into private.payments(order_id,merchant_config_ref,status,authorized_minor,captured_minor,provider_reference) select id,'mock','captured',450000,450000,'m-'||id from public.orders`);
await db.query(`insert into public.order_events(order_id,venue_id,type,to_status,created_at) select id,venue_id,'created','queued',created_at from public.orders`);
await db.query("analyze");
if (apply) await db.query(readFileSync(apply, "utf8"));
const timed = async (label, user, sql, params = []) => {
  const client = await db.pool.connect();
  await client.query("begin");
  await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: user, session_id: "s", is_anonymous: false })]);
  await client.query("set local role authenticated");
  const runs = [];
  for (let i = 0; i < 3; i++) { const t = performance.now(); await client.query(sql, params); runs.push(performance.now() - t); }
  await client.query("rollback"); client.release();
  console.log(`${label.padEnd(34)} ${runs.map((x) => x.toFixed(1).padStart(9)).join(" ")} ms`);
};
console.log(`Historia: ${history} pedidos del local caliente`);
await timed("sweep_orders()", staff, "select public.sweep_orders()");
await timed("order_list(venue) [barra]", staff, "select public.order_list($1)", [V1]);
await timed("order_list(null,order) [cliente]", "10000000-0000-4000-8000-000000000001", "select public.order_list(null,$1)", ["99000000-0000-4000-8000-000000000001"]);
await timed("venue_summary_range(hoy)", admin, "select public.venue_summary_range($1,public.business_date_at(now()),public.business_date_at(now()))", [V1]);
await timed("venue_summary_range(30 días)", admin, "select public.venue_summary_range($1,public.business_date_at(now())-30,public.business_date_at(now()))", [V1]).catch((e) => console.log("venue_summary_range(30 días) ERROR", e.message));
await timed("venue_timing_stats(hoy)", admin, "select public.venue_timing_stats($1,public.business_date_at(now()),public.business_date_at(now()))", [V1]);
if (process.argv.includes("--plans")) {
  const client = await db.pool.connect();
  await client.query("begin");
  await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: staff, session_id: "s", is_anonymous: false })]);
  for (const [label, sql] of [
    ["sweep (consulta de vencidos)", "explain (analyze, buffers, costs off) select * from public.orders where deadline<=now() and status in ('queued','ready','pending_authorization') order by created_at limit 100 for update skip locked"],
    ["order_list (selección de filas)", `explain (analyze, buffers, costs off) select id,created_at,status in ('pending_authorization','queued','preparing','ready') as active from public.orders where (venue_id='${V1}') and (customer_id=auth.uid() or private.is_staff(venue_id)) order by (status in ('pending_authorization','queued','preparing','ready')) desc,created_at desc limit 100`],
  ]) {
    const { rows } = await client.query(sql);
    console.log(`\n--- ${label}\n${rows.map((r) => r["QUERY PLAN"]).join("\n")}`);
  }
  await client.query("rollback"); client.release();
}
await db.pool.end();
await pg.close();
