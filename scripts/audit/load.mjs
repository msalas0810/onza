// Carga sintética de los recorridos críticos sobre Postgres 17 REAL y aislado (embedded-postgres), pagos MOCK, datos ficticios.
// Mide la capa de base de datos tal como la usa la app: cada operación es una transacción con el JWT simulado del usuario
// (como PostgREST) sobre un pool acotado de conexiones. NO mide Next.js, Supabase Auth, PostgREST, Realtime ni la red, y el
// hardware (esta máquina) no es el de un proyecto Supabase: sirve para comparar versiones y encontrar el primer cuello de
// botella, no para prometer capacidad desplegada.
//
// Uso: node scripts/audit/load.mjs [--sessions=100] [--checkouts=30] [--minutes=3] [--burst=60 --burst-minutes=1]
//        [--pool=20] [--history=5000] [--label=base] [--json=ruta.json] [--staff-devices=3]
// Modelo (--life=6 ≈ 2 min de vida por pedido, ~60 pedidos activos a 30/min; compresible con --minutes): sesiones de clientes que exploran el catálogo cada 20–40 s; checkouts de Poisson a la tasa pedida,
// cada uno con su ciclo completo (aceptar → listo → validar retiro → cobro mock → entrega) y, tras cada cambio, el refetch que haría
// la app (barrido + listado) en el dispositivo del cliente y en cada dispositivo de barra; un informe del administrador cada 30 s.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { startPostgres } from "./pg.mjs";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : fallback;
};
const text = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const cfg = {
  sessions: arg("sessions", 100),
  checkouts: arg("checkouts", 30),
  minutes: arg("minutes", 3),
  burst: arg("burst", 60),
  burstMinutes: arg("burst-minutes", 1),
  pool: arg("pool", 20),
  history: arg("history", 5000),
  devices: arg("staff-devices", 3),
  label: text("label", "base"),
  json: text("json", ""),
  warm: arg("warm", 20),
  life: arg("life", 6),
};
const id = (n, k) => `${n}0000000-0000-4000-8000-${String(k).padStart(12, "0")}`;
const V1 = "20000000-0000-4000-8000-000000000001";
const customers = Array.from({ length: 2000 }, (_, i) => id(1, i + 1));
const staff = [id(5, 1), id(5, 2), id(5, 3)];
const admin = id(5, 9);
const rnd = (a, b) => a + Math.random() * (b - a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const expo = (ratePerSec) => -Math.log(1 - Math.random()) / ratePerSec;

const pg = await startPostgres();
// --skip=202611210023 reproduce la versión anterior a esa migración (línea base «antes»).
const db = await pg.database({ label: "load", skip: (text("skip", "") || "").split(",").filter(Boolean) });
const seed = readFileSync(new URL("../../supabase/seed.sql", import.meta.url), "utf8");
await db.query(seed);
// Fixtures: 4 locales con 40 productos; el local caliente (V1) con capacidad alta.
await db.query(`
 insert into public.venues(slug,name,zone,open_state,capacity) values ('l4','Local 4','SJ','open',100),('l5','Local 5','SJ','open',100) on conflict do nothing;
 update public.venues set capacity=100 where id='${V1}';
 insert into public.categories(venue_id,label,position) select v.id,'Carta '||g,g from public.venues v, generate_series(1,3) g on conflict do nothing;
 insert into public.products(venue_id,category_id,name,description,price_minor,available)
  select c.venue_id,c.id,'Trago '||c.label||'-'||g,'Descripción de prueba',300000+g*5000,true from public.categories c, generate_series(1,14) g;
 insert into auth.users(id,email) select x,x||'@t.test' from unnest(array['${[...staff, admin].join("','")}']::uuid[]) x;
 insert into public.memberships(user_id,venue_id,role) values ('${staff[0]}','${V1}','bartender'),('${staff[1]}','${V1}','bartender'),('${staff[2]}','${V1}','bartender'),('${admin}','${V1}','admin');
`);
await db.query(`insert into auth.users(id,email) select x,x||'@t.test' from unnest($1::uuid[]) x`, [customers]);
// Historia: pedidos entregados de esta noche (dato del reporte) y de los últimos 60 días.
const t0 = Date.now();
await db.query(
  `insert into public.orders(id,venue_id,customer_id,public_code,status,total_minor,deadline,created_at,queued_at,preparing_at,ready_at,delivered_at,business_date,version)
   select ('99000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,$1,('10000000-0000-4000-8000-'||lpad((g%2000+1)::text,12,'0'))::uuid,'H'||g::text,'delivered',450000,now(),
     case when g<=$2 then now()-((g%300)||' minutes')::interval else now()-(((g%58)+2)||' days')::interval-((g%600)||' minutes')::interval end as c,
     now()-((g%300)||' minutes')::interval,now()-((g%300)||' minutes')::interval+interval '40 seconds',now()-((g%300)||' minutes')::interval+interval '3 minutes',now()-((g%300)||' minutes')::interval+interval '4 minutes',
     public.business_date_at(case when g<=$2 then now() else now()-(((g%58)+2)||' days')::interval end),4
   from generate_series(1,$2+20000) g`,
  [V1, cfg.history],
);
await db.query(`insert into public.order_items(order_id,venue_id,product_id,name_snapshot,unit_price_minor_snapshot,quantity,line_total_minor)
  select o.id,o.venue_id,(select id from public.products where venue_id=o.venue_id order by id limit 1),'Trago',450000,1,450000 from public.orders o where o.id::text like '99000000%'`);
await db.query(`update private.configuration set allow_scenarios=true`); // carga de historia ya cobrada (los triggers de 021 solo admiten altas nuevas)
await db.query(`insert into private.payments(order_id,merchant_config_ref,status,authorized_minor,captured_minor,provider_reference)
  select id,'mock:'||venue_id,'captured',450000,450000,'mock-'||id from public.orders where id::text like '99000000%'`);
await db.query(`insert into public.order_events(order_id,venue_id,type,to_status,created_at)
  select id,venue_id,'created','queued',created_at from public.orders where id::text like '99000000%'`);
await db.query(`update private.configuration set allow_scenarios=false`);
await db.query("analyze");
console.log(`Fixtures: ${cfg.history + 20000} pedidos históricos (${cfg.history} de esta noche) en ${((Date.now() - t0) / 1000).toFixed(1)} s; pool=${cfg.pool}; etiqueta=${cfg.label}`);

// ---------- instrumentación ----------
const pool = new pg.pg.Pool({ host: "127.0.0.1", port: pg.port, user: "postgres", password: "audit", database: db.name, max: cfg.pool });
pool.on("error", () => undefined);
const stats = new Map();
const errors = new Map();
const record = (label, ms, wait) => {
  const s = stats.get(label) ?? { ms: [], wait: [], n: 0 };
  s.ms.push(ms);
  s.wait.push(wait);
  s.n++;
  stats.set(label, s);
};
const pct = (arr, p) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};
const EXPECTED = new Set(["VENUE_CAPACITY", "RATE_LIMITED", "OUT_OF_STOCK"]);
let phase = "warm";
async function op(label, user, fn, { session } = {}) {
  const t = performance.now();
  const client = await pool.connect();
  const acquired = performance.now();
  try {
    await client.query("begin");
    await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: user, session_id: session ?? "s-" + user.slice(-4), is_anonymous: false })]);
    await client.query("set local role authenticated");
    const value = await fn(client);
    await client.query("commit");
    record(`${phase}:${label}`, performance.now() - acquired, acquired - t);
    return { ok: true, value };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    const code = error.code === "40P01" ? "DEADLOCK" : String(error.message).split("\n")[0].slice(0, 60);
    const key = `${phase}:${label}:${code}`;
    errors.set(key, (errors.get(key) ?? 0) + 1);
    record(`${phase}:${label}`, performance.now() - acquired, acquired - t);
    return { ok: false, code };
  } finally {
    client.release();
  }
}
const cmd = (label, user, input, options) =>
  op(label, user, async (c) => {
    const r = (await c.query("select public.onza_command($1::jsonb) r", [JSON.stringify(input)])).rows[0].r;
    if (r && typeof r === "object" && "error" in r) throw new Error(String(r.error));
    return r;
  }, options);
const venueProducts = (await db.query(`select id,version from public.products where venue_id='${V1}' and available limit 14`)).rows;
let tokenSeq = 0;
const createInput = (key) => {
  const items = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, (_, i) => venueProducts[(tokenSeq + i) % venueProducts.length]);
  return {
    action: "create", venueId: V1,
    items: items.map((p) => ({ productId: p.id, quantity: 1 + Math.floor(Math.random() * 2), expectedProductVersion: p.version })),
    idempotencyKey: key, termsVersion: "demo-v1", privacyVersion: "demo-v1", adult: true, scenario: "approved",
    tokenHash: createHash("sha256").update(`${key}-${tokenSeq++}`).digest("hex"), encryptedToken: "x",
  };
};

// ---------- recorridos ----------
const read = (label, user, sql, params = []) => op(label, user, (c) => c.query(sql, params));
// El refetch de la app (GET /api/orders): barrido + listado, dos RPC.
async function refetchVenue(user) {
  await op("refetch.sweep", user, (c) => c.query("select public.sweep_orders()"));
  await op("refetch.order_list(venue)", user, (c) => c.query("select public.order_list($1)", [V1]));
}
async function refetchCustomer(user, orderId) {
  await op("refetch.sweep", user, (c) => c.query("select public.sweep_orders()"));
  await op("refetch.order_list(customer)", user, (c) => c.query("select public.order_list(null,$1)", [orderId]));
}
const fanout = (customer, orderId) => {
  setTimeout(() => {
    void refetchCustomer(customer, orderId);
    for (let d = 0; d < cfg.devices; d++) void refetchVenue(staff[d % staff.length]);
  }, 100 + Math.random() * 200);
};
let completed = 0;
async function lifecycle(customer, order, scale) {
  const device = staff[Math.floor(Math.random() * staff.length)];
  const session = "bar-" + device.slice(-4);
  await sleep(rnd(3000, 8000) * scale);
  const acc = await cmd("accept", device, { action: "accept", orderId: order.id, expectedVersion: order.version, idempotencyKey: `acc-${order.id}` }, { session });
  if (!acc.ok) return;
  fanout(customer, order.id);
  await sleep(rnd(5000, 12000) * scale);
  const rdy = await cmd("ready", device, { action: "ready", orderId: order.id, expectedVersion: acc.value.version, idempotencyKey: `rdy-${order.id}` }, { session });
  if (!rdy.ok) return;
  fanout(customer, order.id);
  await sleep(rnd(3000, 8000) * scale);
  const code = (await pool.query("select left(token_hash,12) c from private.pickup_tokens where order_id=$1", [order.id])).rows[0].c;
  const claim = await cmd("resolve", device, { action: "resolve", venueId: V1, code }, { session });
  if (!claim.ok) return;
  const capture = await cmd("capture", device, { action: "capture", orderId: order.id, claimId: claim.value.claim_id }, { session });
  if (!capture.ok) return;
  const done = await cmd("complete", device, { action: "complete", orderId: order.id, claimId: claim.value.claim_id, physicalHandoff: true }, { session });
  if (done.ok) completed++;
  fanout(customer, order.id);
}
async function checkout(scale) {
  const customer = customers[Math.floor(Math.random() * customers.length)];
  const input = createInput(`co-${tokenSeq}-${Date.now()}`);
  const result = await cmd("checkout(create)", customer, input);
  if (!result.ok) return;
  // La app lee el pedido recién creado y la lista del cliente.
  void refetchCustomer(customer, result.value.id);
  for (let d = 0; d < cfg.devices; d++) void refetchVenue(staff[d % staff.length]);
  void lifecycle(customer, result.value, scale).catch(() => undefined);
}
async function browse(stopAt) {
  const customer = customers[Math.floor(Math.random() * customers.length)];
  await sleep(rnd(0, 20000));
  while (Date.now() < stopAt) {
    await read("catalog.venues", customer, "select * from public.venues where open_state='open' order by name");
    await read("catalog.menu", customer, "select c.label,p.* from public.products p join public.categories c on c.id=p.category_id where p.venue_id=$1 and not p.archived order by c.position,p.name", [V1]);
    await sleep(rnd(20000, 40000));
  }
}
async function reports(stopAt) {
  while (Date.now() < stopAt) {
    await sleep(30000);
    await op("report.summary_range(night)", admin, (c) => c.query("select public.venue_summary_range($1,public.business_date_at(now()),public.business_date_at(now()))", [V1]));
    await op("report.timing_stats", admin, (c) => c.query("select public.venue_timing_stats($1,public.business_date_at(now()),public.business_date_at(now()))", [V1]));
  }
}
// Muestreo de esperas de Postgres (bloqueos, E/S) y CPU del servidor cada segundo.
const waits = new Map();
const cpu = [];
const sampler = pg.pg && new pg.pg.Client({ host: "127.0.0.1", port: pg.port, user: "postgres", password: "audit", database: "postgres" });
await sampler.connect();
let sampling = true;
const samplePid = (() => {
  try { return Number(readFileSync(`${pg.dir}/postmaster.pid`, "utf8").split("\n")[0]); } catch { return 0; }
})();
void (async () => {
  while (sampling) {
    const { rows } = await sampler.query(`select coalesce(wait_event_type||':'||wait_event,'cpu/idle-in-tx') w,count(*)::int n from pg_stat_activity where datname=$1 and state='active' and pid<>pg_backend_pid() group by 1`, [db.name]).catch(() => ({ rows: [] }));
    for (const r of rows) waits.set(r.w, (waits.get(r.w) ?? 0) + r.n);
    try {
      const out = execFileSync("ps", ["-axo", "ppid=,%cpu="], { encoding: "utf8" });
      const total = out.split("\n").map((l) => l.trim().split(/\s+/)).filter((p) => Number(p[0]) === samplePid).reduce((s, p) => s + Number(p[1]), 0);
      cpu.push(total);
    } catch { /* sin ps */ }
    await sleep(1000);
  }
})();

async function runPhase(name, { minutes, ratePerMin, sessions, scale = 1 }) {
  phase = name;
  const stopAt = Date.now() + minutes * 60000;
  const browsers = Array.from({ length: sessions }, () => browse(stopAt));
  const rep = reports(stopAt);
  let inFlight = 0;
  while (Date.now() < stopAt) {
    await sleep(expo(ratePerMin / 60) * 1000);
    if (Date.now() >= stopAt) break;
    inFlight++;
    void checkout(scale).catch(() => undefined).finally(() => inFlight--);
  }
  await Promise.all(browsers);
  await rep;
  await sleep(2000);
}

const queueDepth = async () => Number((await pool.query(`select count(*) n from public.orders where status in ('queued','preparing','ready')`)).rows[0].n);
console.log(`Fase corta: ${cfg.warm} sesiones, ${cfg.checkouts} checkouts/min, 1 min`);
await runPhase("p1-corta", { minutes: 1, ratePerMin: cfg.checkouts, sessions: cfg.warm, scale: cfg.life });
console.log(`Fase sostenida: ${cfg.sessions} sesiones, ${cfg.checkouts} checkouts/min, ${cfg.minutes} min`);
await runPhase("p2-sostenida", { minutes: cfg.minutes, ratePerMin: cfg.checkouts, sessions: cfg.sessions, scale: cfg.life });
const activeAfterSustained = await queueDepth();
console.log(`Fase ráfaga: ${cfg.burst} checkouts/min, ${cfg.burstMinutes} min`);
await runPhase("p3-rafaga", { minutes: cfg.burstMinutes, ratePerMin: cfg.burst, sessions: cfg.sessions, scale: cfg.life });
await sleep(20000); // deja terminar los ciclos de vida en vuelo
sampling = false;

// ---------- reporte ----------
const rows = [...stats.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, s]) => ({
  label, n: s.n, p50: +pct(s.ms, 50).toFixed(1), p95: +pct(s.ms, 95).toFixed(1), p99: +pct(s.ms, 99).toFixed(1), max: +Math.max(...s.ms).toFixed(1),
  waitP95: +pct(s.wait, 95).toFixed(1),
}));
console.log("\nfase:operación                              n     p50    p95    p99    max   espera-pool-p95 (ms)");
for (const r of rows) console.log(`${r.label.padEnd(42)} ${String(r.n).padStart(5)} ${String(r.p50).padStart(6)} ${String(r.p95).padStart(6)} ${String(r.p99).padStart(6)} ${String(r.max).padStart(6)} ${String(r.waitP95).padStart(8)}`);
const errList = [...errors.entries()].map(([k, n]) => ({ k, n, expected: EXPECTED.has(k.split(":")[2]) }));
console.log("\nErrores:", errList.length ? "" : "ninguno");
for (const e of errList) console.log(`  ${e.expected ? "[esperado]  " : "[INESPERADO]"} ${e.k} × ${e.n}`);
const totalWaits = [...waits.values()].reduce((a, b) => a + b, 0) || 1;
console.log("\nEsperas de Postgres (muestras de sesiones activas):", [...waits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `${k} ${((n / totalWaits) * 100).toFixed(0)}%`).join(" · "));
if (cpu.length) console.log(`CPU del servidor Postgres (suma de procesos, 1 núcleo = 100): p50=${pct(cpu, 50).toFixed(0)} p95=${pct(cpu, 95).toFixed(0)} máx=${Math.max(...cpu).toFixed(0)}`);
const finals = (await pool.query(`select (select count(*) from public.orders where id::text not like '99000000%')::int orders,(select count(*) from public.orders where status='delivered' and id::text not like '99000000%')::int delivered`)).rows[0];
console.log(`Pedidos creados en la prueba: ${finals.orders} (entregados ${finals.delivered}); ciclos completos ${completed}; activos tras la fase sostenida ${activeAfterSustained}`);
// Integridad bajo carga: nada duplicado ni sobrevendido.
const bad = [];
for (const [name, sql] of [
  ["eventos duplicados", `select count(*)::int n from (select order_id,type from public.order_events where type in ('accept','delivered','created','ready') group by 1,2 having count(*)>1) x`],
  ["operaciones de pago duplicadas", `select count(*)::int n from (select payment_id,type from private.payment_operations group by 1,2 having count(*)>1) x`],
  ["capacidad superada", `select count(*)::int n from public.venues v where private.active_order_count(v.id)>v.capacity`],
  ["entregados sin cobro", `select count(*)::int n from public.orders o join private.payments p on p.order_id=o.id where o.status='delivered' and p.status not in ('captured','refunded')`],
]) {
  const n = Number((await pool.query(sql)).rows[0].n);
  if (n) bad.push(`${name}: ${n}`);
}
console.log(`Integridad tras la carga: ${bad.length ? "FALLA — " + bad.join("; ") : "sin duplicados, sobreventas ni cobros inconsistentes"}`);
if (cfg.json) writeFileSync(cfg.json, JSON.stringify({ cfg, rows, errors: errList, waits: Object.fromEntries(waits), cpu: { p50: pct(cpu, 50), p95: pct(cpu, 95), max: Math.max(0, ...cpu) }, finals, integrity: bad }, null, 2));
pool.on("error", () => undefined);
await Promise.race([pool.end(), sleep(5000)]).catch(() => undefined);
await sampler.end().catch(() => undefined);
await pg.close();
process.exit(bad.length ? 1 : 0);
