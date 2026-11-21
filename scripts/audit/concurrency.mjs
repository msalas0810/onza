// Pruebas de concurrencia de pedidos sobre Postgres 17 REAL y aislado (embedded-postgres), con la cadena de migraciones
// completa, pagos MOCK y datos ficticios. Cada operación corre en su propia conexión/transacción con la identidad (JWT)
// simulada de un usuario, igual que PostgREST: así los bloqueos de fila, los advisory locks y los deadlocks son reales.
// No toca onza-dev ni ningún servicio público.
//
// Uso: node scripts/audit/concurrency.mjs        (ver requisitos en scripts/audit/pg.mjs)
import { createHash } from "node:crypto";
import { startPostgres } from "./pg.mjs";

const id = (n, k = 1) => `${n}0000000-0000-4000-8000-${String(k).padStart(12, "0")}`;
const V1 = "20000000-0000-4000-8000-000000000001";
const PRODUCT = "30000000-0000-4000-8000-000000000001";
const staffA = id(5, 1);
const staffB = id(5, 2);
const admin = id(5, 3);
const customer = (k) => id(1, k);

const only = process.env.ONLY?.split(",");
const want = (n) => !only || only.includes(n);
let total = 0;
let failed = 0;
const check = (name, ok, detail = "") => {
  total++;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${detail}`}`);
};

const pg = await startPostgres();
const world = async (label) => {
  const db = await pg.database({ label });
  await db.query(`update private.configuration set demo_enabled=true,allow_scenarios=true where id`).catch(async () =>
    db.query(`update private.configuration set demo_enabled=true where id`),
  );
  const seed = (await import("node:fs")).readFileSync(new URL("../../supabase/seed.sql", import.meta.url), "utf8");
  await db.query(seed);
  const users = [staffA, staffB, admin, ...Array.from({ length: 80 }, (_, i) => customer(i + 1))];
  await db.query(`insert into auth.users(id,email) select x,x||'@t.test' from unnest($1::uuid[]) x`, [users]);
  await db.query(
    `insert into public.memberships(user_id,venue_id,role) values($1,$4,'bartender'),($2,$4,'bartender'),($3,$4,'admin')`,
    [staffA, staffB, admin, V1],
  );
  return db;
};

/** Ejecuta una acción y la clasifica: { ok, value } o { ok:false, code }. */
async function act(db, user, input, options) {
  try {
    const value = await pg.asUser(
      db,
      user,
      async (c) => (await c.query("select public.onza_command($1::jsonb) as r", [JSON.stringify(input)])).rows[0].r,
      options,
    );
    if (value && typeof value === "object" && "error" in value) return { ok: false, code: String(value.error) };
    return { ok: true, value };
  } catch (error) {
    return { ok: false, code: error.code === "40P01" ? "DEADLOCK" : error.code === "40001" ? "SERIALIZATION" : String(error.message) };
  }
}
let seq = 0;
const createInput = (key, extra = {}) => {
  const token = createHash("sha256").update(`${key}-${seq++}`).digest("hex");
  return {
    action: "create", venueId: V1,
    items: [{ productId: PRODUCT, quantity: 1, expectedProductVersion: 1 }],
    idempotencyKey: key, termsVersion: "demo-v1", privacyVersion: "demo-v1", adult: true,
    scenario: "approved", tokenHash: token, encryptedToken: "x", ...extra,
  };
};
const count = async (db, sql, params = []) => Number((await db.query(sql, params)).rows[0].n);

/** Invariantes globales después de cada escenario. */
async function invariants(db, label) {
  const problems = [];
  const q = async (sql) => (await db.query(sql)).rows;
  const dup = await q(`select order_id,type,count(*) n from public.order_events where type in ('accept','delivered','created','ready') group by 1,2 having count(*)>1`);
  if (dup.length) problems.push(`eventos duplicados: ${JSON.stringify(dup.slice(0, 3))}`);
  const money = await q(`select o.id,o.status,p.status ps,p.captured_minor,o.total_minor from public.orders o join private.payments p on p.order_id=o.id where (o.status='delivered' and p.status not in ('captured','refunded')) or p.captured_minor>o.total_minor or p.refunded_minor>p.captured_minor`);
  if (money.length) problems.push(`pagos inconsistentes: ${JSON.stringify(money.slice(0, 3))}`);
  const ops = await q(`select payment_id,type,count(*) n from private.payment_operations group by 1,2 having count(*)>1`);
  if (ops.length) problems.push(`operaciones de pago duplicadas: ${JSON.stringify(ops.slice(0, 3))}`);
  const over = await q(`select v.id,v.capacity,private.active_order_count(v.id) n from public.venues v where private.active_order_count(v.id)>v.capacity`);
  if (over.length) problems.push(`capacidad superada: ${JSON.stringify(over)}`);
  const noPay = await q(`select o.id from public.orders o left join private.payments p on p.order_id=o.id where p.id is null`);
  if (noPay.length) problems.push(`pedidos sin pago: ${noPay.length}`);
  check(`Invariantes (${label}): sin duplicados, sobreventa, montos ni pedidos huérfanos`, problems.length === 0, problems.join(" | "));
}

try {
  /* C1 · Dos operadores aceptan el mismo pedido a la vez */
  if (want("C1")) {
    const db = await world("c1");
    const made = await act(db, customer(1), createInput("c1-order"));
    const order = made.value;
    const results = await Promise.all([
      act(db, staffA, { action: "accept", orderId: order.id, expectedVersion: order.version, idempotencyKey: "a-1" }, { session: "sa" }),
      act(db, staffB, { action: "accept", orderId: order.id, expectedVersion: order.version, idempotencyKey: "b-1" }, { session: "sb" }),
    ]);
    const wins = results.filter((r) => r.ok).length;
    check("C1 Dos operadores aceptan a la vez: exactamente una aceptación", wins === 1, JSON.stringify(results.map((r) => r.code ?? "ok")));
    check("C1 La otra recibe un conflicto limpio (VERSION_CONFLICT/INVALID_TRANSITION), no un error interno", results.filter((r) => !r.ok).every((r) => /VERSION_CONFLICT|INVALID_TRANSITION/.test(r.code)), JSON.stringify(results.map((r) => r.code)));
    check("C1 Un solo evento 'accept' y versión 2", (await count(db, `select count(*) n from public.order_events where order_id=$1 and type='accept'`, [order.id])) === 1 && (await count(db, `select version n from public.orders where id=$1`, [order.id])) === 2);
    await invariants(db, "C1");
    await db.pool.end();
  }

  /* C2 · Doble clic: misma clave de idempotencia, cinco envíos simultáneos */
  if (want("C2")) {
    const db = await world("c2");
    const order = (await act(db, customer(1), createInput("c2-order"))).value;
    const same = { action: "accept", orderId: order.id, expectedVersion: order.version, idempotencyKey: "dbl" };
    const results = await Promise.all(Array.from({ length: 5 }, () => act(db, staffA, same, { session: "sa" })));
    check("C2 Doble clic ×5 con la misma clave: todas responden bien", results.every((r) => r.ok), JSON.stringify(results.map((r) => r.code ?? "ok")));
    check("C2 Un solo 'accept' (la repetición devuelve el mismo pedido)", (await count(db, `select count(*) n from public.order_events where order_id=$1 and type='accept'`, [order.id])) === 1);
    await invariants(db, "C2");
    await db.pool.end();
  }

  /* C3 · Aceptar vs cancelar (cliente), 40 rondas con interleavings distintos */
  if (want("C3")) {
    const db = await world("c3");
    let bothWon = 0;
    let weird = [];
    for (let i = 0; i < 40; i++) {
      const c = customer(i + 1);
      const order = (await act(db, c, createInput(`c3-${i}`))).value;
      const [acc, can] = await Promise.all([
        act(db, staffA, { action: "accept", orderId: order.id, expectedVersion: order.version, idempotencyKey: `c3a-${i}` }, { session: "sa" }),
        act(db, c, { action: "cancel", orderId: order.id, expectedVersion: order.version, idempotencyKey: `c3c-${i}`, reason: "cambié de idea" }),
      ]);
      if (acc.ok && can.ok) bothWon++;
      const final = (await db.query(`select o.status,p.status ps,(select count(*) from private.payment_operations x where x.payment_id=p.id and x.type='void') voids from public.orders o join private.payments p on p.order_id=o.id where o.id=$1`, [order.id])).rows[0];
      const consistent = (final.status === "preparing" && final.ps === "authorized" && Number(final.voids) === 0) || (final.status === "canceled" && final.ps === "voided" && Number(final.voids) === 1);
      if (!consistent) weird.push(`${i}:${JSON.stringify(final)} acc=${acc.code ?? "ok"} can=${can.code ?? "ok"}`);
    }
    check("C3 Aceptar vs cancelar ×40: nunca ganan los dos", bothWon === 0, `${bothWon} rondas`);
    check("C3 Estado final siempre coherente (preparando+autorizado, o cancelado+anulado una sola vez)", weird.length === 0, weird.slice(0, 3).join(" | "));
    await invariants(db, "C3");
    await db.pool.end();
  }

  /* C4 · Aceptar vs vencimiento (barrido) */
  if (want("C4")) {
    const db = await world("c4");
    const bad = [];
    for (let i = 0; i < 20; i++) {
      const order = (await act(db, customer(i + 1), createInput(`c4-${i}`))).value;
      await db.query(`update public.orders set deadline=now()-interval '1 second' where id=$1`, [order.id]);
      const [acc, sweep] = await Promise.all([
        act(db, staffA, { action: "accept", orderId: order.id, expectedVersion: order.version, idempotencyKey: `c4a-${i}` }, { session: "sa" }),
        pg.asUser(db, staffB, async (c) => (await c.query("select public.sweep_orders() n")).rows[0].n).then((n) => ({ ok: true, n }), (e) => ({ ok: false, code: e.code === "40P01" ? "DEADLOCK" : e.message })),
      ]);
      const final = (await db.query(`select o.status,(select count(*) from public.order_events e where e.order_id=o.id and e.type='accept') accepts,(select count(*) from private.payment_operations x join private.payments p on p.id=x.payment_id where p.order_id=o.id and x.type='void') voids from public.orders o where o.id=$1`, [order.id])).rows[0];
      if (final.status !== "expired" || Number(final.accepts) !== 0 || Number(final.voids) !== 1 || !sweep.ok) bad.push(`${i}:${JSON.stringify(final)} acc=${acc.code ?? "ok"} sweep=${sweep.code ?? "ok"}`);
    }
    check("C4 Aceptar un pedido vencido mientras corre el barrido: queda vencido, una anulación, ninguna aceptación, sin deadlocks", bad.length === 0, bad.slice(0, 3).join(" | "));
    await invariants(db, "C4");
    await db.pool.end();
  }

  /* C5 · Último cupo: 10 clientes compiten por 1 lugar */
  if (want("C5")) {
    const db = await world("c5");
    await db.query(`update public.venues set capacity=3 where id=$1`, [V1]);
    await act(db, customer(1), createInput("c5-1"));
    await act(db, customer(2), createInput("c5-2"));
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => act(db, customer(10 + i), createInput(`c5-race-${i}`))));
    const wins = results.filter((r) => r.ok).length;
    check("C5 Último cupo con 10 competidores: exactamente 1 pedido", wins === 1, `${wins} ganaron; ${JSON.stringify(results.map((r) => r.code ?? "ok"))}`);
    check("C5 Los demás reciben VENUE_CAPACITY (no errores internos ni deadlocks)", results.filter((r) => !r.ok).every((r) => r.code === "VENUE_CAPACITY"), JSON.stringify(results.map((r) => r.code ?? "ok")));
    check("C5 Pedidos activos == capacidad", (await count(db, `select private.active_order_count($1) n`, [V1])) === 3);
    await invariants(db, "C5");
    await db.pool.end();
  }

  /* C6 · Doble envío del checkout: misma clave, 8 simultáneos */
  if (want("C6")) {
    const db = await world("c6");
    const input = createInput("c6-same");
    const results = await Promise.all(Array.from({ length: 8 }, () => act(db, customer(1), input)));
    const ids = new Set(results.filter((r) => r.ok).map((r) => r.value.id));
    check("C6 Mismo envío ×8: un solo pedido y todas las respuestas devuelven ese pedido", results.every((r) => r.ok) && ids.size === 1, JSON.stringify(results.map((r) => r.code ?? "ok")));
    check("C6 Un solo pedido en la base, un solo cobro mock autorizado", (await count(db, `select count(*) n from public.orders`)) === 1 && (await count(db, `select count(*) n from private.payment_operations where type='authorize'`)) === 1);
    await invariants(db, "C6");
    await db.pool.end();
  }

  /* C7 · Retiro: dueño único, una captura, una entrega */
  if (want("C7")) {
    const db = await world("c7");
    const order = (await act(db, customer(1), createInput("c7-order"))).value;
    await act(db, staffA, { action: "accept", orderId: order.id, expectedVersion: 1, idempotencyKey: "c7-acc" }, { session: "sa" });
    await act(db, staffA, { action: "ready", orderId: order.id, expectedVersion: 2, idempotencyKey: "c7-rdy" }, { session: "sa" });
    const code = (await db.query(`select left(token_hash,12) c from private.pickup_tokens where order_id=$1`, [order.id])).rows[0].c;
    const claims = await Promise.all([
      act(db, staffA, { action: "resolve", venueId: V1, code }, { session: "sa" }),
      act(db, staffB, { action: "resolve", venueId: V1, code }, { session: "sb" }),
    ]);
    const owners = claims.filter((r) => r.ok && r.value.claim_id).length;
    check("C8 Dos operadores validan el mismo retiro a la vez: un solo dueño del retiro", owners === 1, JSON.stringify(claims.map((r) => r.ok ? { claim: !!r.value.claim_id, elsewhere: r.value.claimed_elsewhere } : r.code)));
    const ownerIsA = claims[0].ok && claims[0].value.claim_id;
    const [owner, ownerSession, other, otherSession] = ownerIsA ? [staffA, "sa", staffB, "sb"] : [staffB, "sb", staffA, "sa"];
    const claimId = (ownerIsA ? claims[0] : claims[1]).value.claim_id;
    const caps = await Promise.all(Array.from({ length: 4 }, () => act(db, owner, { action: "capture", orderId: order.id, claimId }, { session: ownerSession })));
    check("C7 Captura ×4 simultánea: todas bien y un solo cobro", caps.every((r) => r.ok) && (await count(db, `select count(*) n from private.payment_operations where type='capture'`)) === 1 && (await count(db, `select captured_minor n from private.payments`)) === Number(order.total_minor), JSON.stringify(caps.map((r) => r.code ?? "ok")));
    const wrong = await act(db, other, { action: "capture", orderId: order.id, claimId }, { session: otherSession });
    check("C7 Otro operador no puede capturar ni entregar el retiro ajeno (CLAIM_OWNED_ELSEWHERE)", !wrong.ok && wrong.code === "CLAIM_OWNED_ELSEWHERE", JSON.stringify(wrong));
    const done = await Promise.all(Array.from({ length: 4 }, () => act(db, owner, { action: "complete", orderId: order.id, claimId, physicalHandoff: true }, { session: ownerSession })));
    check("C7 Entrega ×4 simultánea: todas bien y un solo evento 'delivered'", done.every((r) => r.ok) && (await count(db, `select count(*) n from public.order_events where order_id=$1 and type='delivered'`, [order.id])) === 1, JSON.stringify(done.map((r) => r.code ?? "ok")));
    const refunds = await Promise.all([
      act(db, admin, { action: "refund", orderId: order.id, reason: "devolución de prueba" }, { session: "sad" }),
      act(db, admin, { action: "refund", orderId: order.id, reason: "devolución de prueba" }, { session: "sad2" }),
    ]);
    check("C9 Reembolso ×2 simultáneo: un solo reembolso", refunds.every((r) => r.ok) && (await count(db, `select count(*) n from private.payment_operations where type='refund'`)) === 1, JSON.stringify(refunds.map((r) => r.code ?? "ok")));
    await invariants(db, "C7–C9");
    await db.pool.end();
  }

  /* C10 · Aceptación automática vs aceptación manual vs barrido */
  if (want("C10")) {
    const db = await world("c10");
    const bad = [];
    for (let i = 0; i < 15; i++) {
      const order = (await act(db, customer(i + 1), createInput(`c10-${i}`))).value;
      await db.query(`update public.venues set auto_accept=true,auto_accept_max_preparing=50 where id=$1`, [V1]);
      const tick = () => pg.asUser(db, staffB, async (c) => (await c.query("select public.sweep_orders() n")).rows[0].n, {}).then(() => ({ ok: true }), (e) => ({ ok: false, code: e.code === "40P01" ? "DEADLOCK" : e.message }));
      const direct = () => db.pool.query(`select public.auto_accept_tick() n`).then(() => ({ ok: true }), (e) => ({ ok: false, code: e.code === "40P01" ? "DEADLOCK" : e.message }));
      const results = await Promise.all([
        act(db, staffA, { action: "accept", orderId: order.id, expectedVersion: order.version, idempotencyKey: `c10a-${i}` }, { session: "sa" }),
        tick(), direct(), direct(),
      ]);
      await db.query(`update public.venues set auto_accept=false where id=$1`, [V1]);
      const final = (await db.query(`select o.status,o.version,(select count(*) from public.order_events e where e.order_id=o.id and e.type='accept') accepts from public.orders o where o.id=$1`, [order.id])).rows[0];
      const deadlocks = results.filter((r) => r.code === "DEADLOCK").length;
      if (final.status !== "preparing" || Number(final.accepts) !== 1 || Number(final.version) !== 2 || deadlocks) bad.push(`${i}:${JSON.stringify(final)} ${JSON.stringify(results.map((r) => r.code ?? "ok"))}`);
    }
    check("C10 Aceptación manual + automática + dos ticks a la vez ×15: una sola aceptación por pedido, sin deadlocks", bad.length === 0, bad.slice(0, 3).join(" | "));
    await invariants(db, "C10");
    await db.pool.end();
  }

  /* C11 · Stock: agotar un producto bloquea las creaciones concurrentes */
  if (want("C11")) {
    const db = await world("c11");
    const holder = await db.pool.connect();
    holder.on("error", () => undefined);
    await holder.query("begin");
    await holder.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: admin, session_id: "sad", is_anonymous: false })]);
    await holder.query("set local role authenticated");
    await holder.query("select public.onza_command($1::jsonb)", [JSON.stringify({ action: "product_availability", venueId: V1, productId: PRODUCT, available: false })]);
    const create = act(db, customer(1), createInput("c11-order"));
    await new Promise((r) => setTimeout(r, 300));
    await holder.query("commit");
    holder.release();
    const result = await create;
    check("C11 Producto agotado mientras alguien pide: el pedido se rechaza como OUT_OF_STOCK (no se vende)", !result.ok && result.code === "OUT_OF_STOCK", JSON.stringify(result).slice(0, 200));
    await invariants(db, "C11");
    await db.pool.end();
  }

  /* C12 · Lista de espera: un cupo liberado, dos esperando, creación simultánea */
  if (want("C12")) {
    const db = await world("c12");
    await db.query(`update public.venues set capacity=1 where id=$1`, [V1]);
    await db.query(`update private.configuration set waitlist_enabled=true`);
    const holder = (await act(db, customer(1), createInput("c12-holder"))).value;
    const joins = await Promise.all([2, 3].map((k) => pg.asUser(db, customer(k), async (c) => (await c.query("select public.waitlist_command($1::jsonb) r", [JSON.stringify({ action: "join", venueId: V1 })])).rows[0].r, { anonymous: false })));
    void joins;
    await act(db, customer(1), { action: "cancel", orderId: holder.id, expectedVersion: holder.version, idempotencyKey: "c12-cancel", reason: "libero el cupo" });
    const results = await Promise.all([2, 3].map((k) => act(db, customer(k), createInput(`c12-${k}`))));
    check("C12 Un cupo liberado con dos en espera: solo el ofertado crea pedido", results.filter((r) => r.ok).length === 1, JSON.stringify(results.map((r) => r.code ?? "ok")));
    await invariants(db, "C12");
    await db.pool.end();
  }
} catch (error) {
  failed++;
  console.error(`✗ Error inesperado en el recorrido: ${error.stack ?? error}`);
} finally {
  await pg.close();
}
console.log(`\n${total - failed}/${total} comprobaciones superadas${failed ? `, ${failed} fallaron` : ""}.`);
process.exit(failed ? 1 : 0);
