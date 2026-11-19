// Mide la consulta crítica del Resumen de administración (`venue_summary_range`) con volumen: N pedidos por local en
// 60 noches, sobre las migraciones reales en PGlite. Solo sirve para comparar antes/después con el mismo entorno
// (PGlite en memoria, no es Postgres de producción). Uso: node scripts/measure-summary-query.mjs [pedidos-por-local]
import { createDatabase, people } from "./local-shim/index.mjs";
import { stableId } from "./lib/real-venues-seed.mjs";
const perVenue = Number(process.argv[2] ?? 20000);
const db = await createDatabase();
const mil = stableId("onza-real-venue", "mil948");
const venues = (await db.query("select id from public.venues where slug in ('mil948','stiefel-pub','apotecario')")).rows.map((r) => r.id);
await db.exec(`set session_replication_role = replica`);
for (const venue of venues) {
  await db.exec(`
    with gen as (
      select gen_random_uuid() as id, n, now() - (random()*60||' days')::interval as t from generate_series(1,${perVenue}) n
    ), ins as (
      insert into public.orders(id,venue_id,customer_id,public_code,status,total_minor,deadline,created_at,queued_at,preparing_at,ready_at,delivered_at)
      select id,'${venue}','${people.maria.id}','M'||substr(md5(id::text),1,20),'delivered',6200,t+interval '5 minutes',t,t,t+interval '1 minute',t+interval '6 minutes',t+interval '8 minutes' from gen
      returning id
    ), pay as (
      insert into private.payments(id,order_id,merchant_config_ref,status,authorized_minor,captured_minor)
      select gen_random_uuid(),id,'mock','captured',6200,6200 from ins returning id,order_id
    )
    insert into private.payment_operations(payment_id,type,idempotency_key,status,provider_state,amount_minor,created_at)
    select pay.id,'capture','k-'||pay.id,'captured','captured',6200,now()-(random()*60||' days')::interval from pay;
  `);
}
await db.exec(`reset role; set session_replication_role = origin;`);
// Experimento (no es una migración): MEASURE_INDEX=1 prueba un índice por hora de entrada antes de decidir si hace falta.
if (process.env.MEASURE_INDEX) await db.exec("create index orders_entered on public.orders(venue_id,(coalesce(queued_at,created_at)))");
await db.exec("analyze");
await db.exec(`select set_config('request.jwt.claims','{"sub":"${people.ana.id}","is_anonymous":false}',false); set role authenticated`);
const run = async (label, from, to) => {
  const times = [];
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    await db.query("select public.venue_summary_range($1,(current_date - $2::int),(current_date - $3::int))", [mil, from, to]);
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  console.log(`${label}: mediana ${times[2].toFixed(0)} ms (mín ${times[0].toFixed(0)}, máx ${times[4].toFixed(0)})`);
};
console.log(`pedidos por local: ${perVenue}; locales: ${venues.length}`);
await run("noche (1 día)", 1, 1);
await run("semana (7 días)", 7, 0);
await run("mes (30 días)", 30, 0);
await db.exec("reset role");
const plan = await db.query(
  `explain (analyze, buffers off, summary off) select count(*) from public.orders x where x.venue_id='${mil}' and coalesce(x.queued_at,x.created_at) >= now()-interval '1 day' and coalesce(x.queued_at,x.created_at) < now()`,
);
console.log(plan.rows.map((r) => r["QUERY PLAN"]).join("\n"));
await db.close();
