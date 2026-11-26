import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { database, actor, command, createInput, ids } from "../db/helpers";

let db: PGlite;
beforeAll(async () => {
  db = await database();
});
afterAll(async () => {
  await db?.close();
});

const as = (user: string, anonymous = false) => actor(db, user, `${user}-s`, anonymous);
const asCustomer = () => as(ids.customer);
const asAdmin = () => as(ids.admin);
const asBartender = () => as(ids.staff);

async function rpc<T = Record<string, unknown>>(name: string, input: Record<string, unknown>) {
  const result = await db.query<{ r: T }>(`select public.${name}($1::jsonb) as r`, [JSON.stringify(input)]);
  return result.rows[0].r;
}
const save = (input: Record<string, unknown>) => rpc("venue_spot_save", { venueId: ids.venue, ...input });
const place = (key: string, delivery?: Record<string, unknown>) =>
  command(db, createInput(key, delivery ? { delivery } : {}));
const hashOf = (key: string) => createHash("sha256").update(key).digest("hex");

describe("configuración: solo administración del local", () => {
  it("un local nuevo sigue siendo solo barra y rechaza la entrega en el lugar", async () => {
    await asCustomer();
    await expect(place("bar-default")).resolves.toMatchObject({ fulfillment: "bar", spot_id: null });
    await expect(place("no-delivery", { mode: "location", spotId: ids.product })).rejects.toThrow(
      "DELIVERY_UNAVAILABLE",
    );
    await expect(place("bar-with-spot", { mode: "bar", spotId: ids.product })).rejects.toThrow("INVALID_INPUT");
  });

  it("empleado, cliente y administración de otro local no configuran ni crean lugares", async () => {
    for (const run of [asBartender, asCustomer, () => as(ids.other)]) {
      await run();
      await expect(save({ label: "Mesa 1" })).rejects.toThrow("NOT_AUTHORIZED");
      await expect(rpc("venue_delivery_config", { venueId: ids.venue, mode: "both" })).rejects.toThrow(
        "NOT_AUTHORIZED",
      );
      await expect(
        rpc("venue_spot_bulk", { venueId: ids.venue, prefix: "Mesa", from: 1, to: 3 }),
      ).rejects.toThrow("NOT_AUTHORIZED");
    }
    // Administrador de otro local: tiene membresía, pero no en este.
    await db.exec("reset role");
    await db.exec(
      `insert into public.memberships(user_id,venue_id,role) values('${ids.other}','${ids.patio}','admin')`,
    );
    await as(ids.other);
    await expect(save({ label: "Mesa 1" })).rejects.toThrow("NOT_AUTHORIZED");
    await db.exec("reset role");
    await db.exec(`delete from public.memberships where user_id='${ids.other}'`);
  });

  it("no se activa la entrega sin al menos un lugar habilitado; las altas por rango omiten duplicados", async () => {
    await asAdmin();
    await expect(rpc("venue_delivery_config", { venueId: ids.venue, mode: "both" })).rejects.toThrow("NO_SPOTS");
    await expect(
      rpc("venue_spot_bulk", { venueId: ids.venue, prefix: "Mesa", from: 5, to: 1 }),
    ).rejects.toThrow("INVALID_INPUT");
    await expect(
      rpc("venue_spot_bulk", { venueId: ids.venue, prefix: "Mesa", from: 1, to: 500 }),
    ).rejects.toThrow("INVALID_INPUT");
    await save({ label: "Mesa 2", area: "Terraza" });
    await expect(save({ label: "mesa 2" })).rejects.toThrow("SPOT_DUPLICATE");
    const bulk = await rpc("venue_spot_bulk", { venueId: ids.venue, prefix: "Mesa", from: 1, to: 4, area: "Terraza" });
    expect(bulk).toEqual({ created: 3, skipped: 1 });
    await expect(
      rpc("venue_delivery_config", { venueId: ids.venue, mode: "both", noun: "Mesa" }),
    ).resolves.toEqual({ mode: "both", noun: "Mesa" });
  });
});

describe("crear el pedido: el servidor valida el lugar", () => {
  let mesa1: string;
  let mesa2: string;
  let patioSpot: string;
  beforeAll(async () => {
    await db.exec("reset role");
    mesa1 = (await db.query<{ id: string }>(`select id from public.delivery_spots where label='Mesa 1' and venue_id='${ids.venue}'`)).rows[0].id;
    mesa2 = (await db.query<{ id: string }>(`select id from public.delivery_spots where label='Mesa 2' and venue_id='${ids.venue}'`)).rows[0].id;
    await db.exec(`insert into public.delivery_spots(venue_id,label) values('${ids.patio}','Patio 1')`);
    patioSpot = (await db.query<{ id: string }>(`select id from public.delivery_spots where label='Patio 1'`)).rows[0].id;
  });

  it("guarda el lugar con una copia de su nombre y reutiliza el pedido en un reintento", async () => {
    await asCustomer();
    const a = await place("loc-1", { mode: "location", spotId: mesa1 });
    expect(a).toMatchObject({ fulfillment: "location", spot_id: mesa1, spot_label: "Mesa 1", spot_area: "Terraza" });
    expect(a.status).toBe("queued");
    const b = await place("loc-1", { mode: "location", spotId: mesa1 });
    expect(b.id).toBe(a.id);
    await expect(place("loc-1", { mode: "location", spotId: mesa2 })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    await db.exec("reset role");
    const rows = await db.query(`select id from public.orders where spot_id='${mesa1}'`);
    expect(rows.rows).toHaveLength(1);
  });

  it("rechaza un lugar de otro local, uno inexistente, uno deshabilitado y la falta de lugar", async () => {
    await asCustomer();
    await expect(place("loc-other", { mode: "location", spotId: patioSpot })).rejects.toThrow("SPOT_INVALID");
    await expect(
      place("loc-missing", { mode: "location", spotId: "00000000-0000-4000-8000-00000000dead" }),
    ).rejects.toThrow("SPOT_INVALID");
    await expect(place("loc-none", { mode: "location" })).rejects.toThrow("SPOT_INVALID");
    await expect(place("loc-garbage", { mode: "location", spotId: "no-es-un-id" })).rejects.toThrow("SPOT_INVALID");
    await asAdmin();
    await save({ spotId: mesa2, label: "Mesa 2", area: "Terraza", enabled: false });
    await asCustomer();
    await expect(place("loc-disabled", { mode: "location", spotId: mesa2 })).rejects.toThrow("SPOT_INVALID");
    await asAdmin();
    await save({ spotId: mesa2, label: "Mesa 2", area: "Terraza", enabled: true });
    await db.exec("reset role");
    // Ningún intento fallido dejó un pedido a medias.
    const failed = await db.query(`select 1 from public.orders where spot_id is not null`);
    expect(failed.rows).toHaveLength(1);
  });

  it("renombrar o deshabilitar un lugar no cambia el historial de sus pedidos", async () => {
    await asAdmin();
    await save({ spotId: mesa1, label: "Mesa uno", area: "Terraza" });
    await save({ spotId: mesa1, label: "Mesa uno", area: "Terraza", enabled: false });
    await db.exec("reset role");
    const row = (await db.query<{ spot_label: string }>(`select spot_label from public.orders where spot_id='${mesa1}'`)).rows[0];
    expect(row.spot_label).toBe("Mesa 1");
    await asAdmin();
    await save({ spotId: mesa1, label: "Mesa 1", area: "Terraza", enabled: true });
  });

  it("con solo-lugar el pedido de barra se rechaza; no se deshabilita ni borra el último lugar con la entrega activa", async () => {
    await asAdmin();
    await rpc("venue_delivery_config", { venueId: ids.venue, mode: "location" });
    await asCustomer();
    await expect(place("only-loc-bar")).rejects.toThrow("SPOT_REQUIRED");
    await expect(place("only-loc-bar2", { mode: "bar" })).rejects.toThrow("SPOT_REQUIRED");
    await expect(place("only-loc-ok", { mode: "location", spotId: mesa2 })).resolves.toMatchObject({
      spot_label: "Mesa 2",
    });
    await asAdmin();
    await db.exec("reset role");
    await db.exec(`update public.delivery_spots set enabled=false where venue_id='${ids.venue}' and id<>'${mesa2}'`);
    await asAdmin();
    await expect(save({ spotId: mesa2, label: "Mesa 2", area: "Terraza", enabled: false })).rejects.toThrow(
      "LAST_SPOT",
    );
    await db.exec("reset role");
    await db.exec(`update public.delivery_spots set enabled=true where venue_id='${ids.venue}'`);
    await asAdmin();
    await rpc("venue_delivery_config", { venueId: ids.venue, mode: "both" });
  });

  it("un lugar con pedidos no se borra; uno sin uso sí", async () => {
    await asAdmin();
    await expect(rpc("venue_spot_delete", { venueId: ids.venue, spotId: mesa1 })).rejects.toThrow("SPOT_IN_USE");
    const created = await save({ label: "Temporal" });
    await expect(
      rpc("venue_spot_delete", { venueId: ids.venue, spotId: (created as { id: string }).id }),
    ).resolves.toEqual({ deleted: true });
  });
});

describe("cambiar el lugar y entregar", () => {
  let spotA: string;
  let spotB: string;
  beforeAll(async () => {
    await db.exec("reset role");
    spotA = (await db.query<{ id: string }>(`select id from public.delivery_spots where label='Mesa 3' and venue_id='${ids.venue}'`)).rows[0].id;
    spotB = (await db.query<{ id: string }>(`select id from public.delivery_spots where label='Mesa 4' and venue_id='${ids.venue}'`)).rows[0].id;
  });

  it("el dueño cambia su lugar antes de la entrega; otro cliente no; un lugar ajeno no sirve", async () => {
    await asCustomer();
    const order = await place("change-1", { mode: "location", spotId: spotA });
    const changed = await rpc<Record<string, unknown>>("order_change_spot", { orderId: order.id, spotId: spotB });
    expect(changed).toMatchObject({ spot_label: "Mesa 4", version: order.version });
    expect(changed.spot_changed_at).toBeTruthy();
    // Mismo lugar: sin efecto y sin evento nuevo.
    await rpc("order_change_spot", { orderId: order.id, spotId: spotB });
    await as(ids.other, false);
    await expect(rpc("order_change_spot", { orderId: order.id, spotId: spotA })).rejects.toThrow("NOT_AUTHORIZED");
    await asCustomer();
    await expect(
      rpc("order_change_spot", { orderId: order.id, spotId: "00000000-0000-4000-8000-00000000dead" }),
    ).rejects.toThrow("SPOT_INVALID");
    await db.exec("reset role");
    const events = (await db.query<{ n: number }>(
      `select count(*)::int as n from public.order_events where order_id='${order.id}' and type='spot_changed'`,
    )).rows[0].n;
    expect(events).toBe(1);
    // El cliente no ve quién ni por qué; el equipo sí ve el cambio.
    await asCustomer();
    const customerView = (await command(db, { action: "get", orderId: order.id })) as { events: { metadata: unknown; actor_id: unknown }[] };
    expect(customerView.events.every((e) => e.actor_id == null && JSON.stringify(e.metadata) === "{}")).toBe(true);
    await asBartender();
    const staffView = (await command(db, { action: "get", orderId: order.id })) as { events: { type: string; metadata: { to?: string } }[] };
    expect(staffView.events.find((e) => e.type === "spot_changed")?.metadata.to).toBe("Mesa 4");
  });

  it("un pedido de barra no se convierte en entrega en el lugar", async () => {
    await asCustomer();
    const order = await command(db, createInput("bar-then", { delivery: { mode: "bar" } }));
    await expect(rpc("order_change_spot", { orderId: order.id, spotId: spotA })).rejects.toThrow("INVALID_TRANSITION");
  });

  it("recorrido completo: el mismo QR o código del retiro entrega en el lugar y queda quién y cuándo", async () => {
    await db.exec("reset role");
    await db.exec(`insert into auth.users values('${ids.staff}') on conflict do nothing`);
    await db.exec(
      `insert into public.staff_accounts(user_id,display_name) values('${ids.staff}','Jorge Mora') on conflict do nothing`,
    );
    await asCustomer();
    const order = await place("full-1", { mode: "location", spotId: spotA });
    await asBartender();
    await command(db, { action: "accept", orderId: order.id, expectedVersion: order.version, idempotencyKey: "full-accept" });
    const ready = await command(db, { action: "ready", orderId: order.id, expectedVersion: Number(order.version) + 1, idempotencyKey: "full-ready" });
    expect(ready.spot_label).toBe("Mesa 3");
    const resolved = await command(db, { action: "resolve", venueId: ids.venue, tokenHash: hashOf("full-1") });
    expect(resolved).toMatchObject({ id: order.id, spot_label: "Mesa 3", fulfillment: "location" });
    const claim = String(resolved.claim_id);
    await command(db, { action: "capture", orderId: order.id, claimId: claim });
    const done = await command(db, { action: "complete", orderId: order.id, claimId: claim, physicalHandoff: true });
    expect(done).toMatchObject({ status: "delivered", spot_label: "Mesa 3", delivered_by_name: "Jorge Mora" });
    expect(done.delivered_at).toBeTruthy();
    // El cliente ve dónde y cuándo, pero no el nombre del empleado.
    await asCustomer();
    const customerView = await command(db, { action: "get", orderId: order.id });
    expect(customerView).toMatchObject({ status: "delivered", spot_label: "Mesa 3", delivered_by_name: null });
  });

  it("el código del cliente de otro local no entrega un pedido de este", async () => {
    await asCustomer();
    await place("cross-token", { mode: "location", spotId: spotA });
    await as(ids.admin);
    await expect(command(db, { action: "resolve", venueId: ids.patio, tokenHash: hashOf("cross-token") })).rejects.toThrow(
      "INVALID_PICKUP",
    );
  });
});

describe("lectura y escritura directa de las tablas", () => {
  it("el público solo lee lugares habilitados; la administración ve todos; nadie escribe directo", async () => {
    await db.exec("reset role");
    await db.exec(`update public.delivery_spots set enabled=false where label='Mesa 4' and venue_id='${ids.venue}'`);
    await asCustomer();
    const visible = (await db.query<{ label: string }>(`select label from public.delivery_spots where venue_id='${ids.venue}'`)).rows.map((r) => r.label);
    expect(visible).not.toContain("Mesa 4");
    expect(visible).toContain("Mesa 3");
    await asAdmin();
    const all = (await db.query<{ label: string }>(`select label from public.delivery_spots where venue_id='${ids.venue}'`)).rows.map((r) => r.label);
    expect(all).toContain("Mesa 4");
    for (const run of [asCustomer, asAdmin]) {
      await run();
      await expect(
        db.query(`insert into public.delivery_spots(venue_id,label) values('${ids.venue}','Hack')`),
      ).rejects.toThrow(/permission denied/i);
      await expect(db.query(`update public.delivery_spots set enabled=true`)).rejects.toThrow(/permission denied/i);
      await expect(db.query(`delete from public.delivery_spots`)).rejects.toThrow(/permission denied/i);
      await expect(db.query(`update public.orders set spot_label='Hack'`)).rejects.toThrow(/permission denied/i);
    }
    await db.exec("reset role");
    await db.exec(`update public.delivery_spots set enabled=true where label='Mesa 4' and venue_id='${ids.venue}'`);
  });

  it("la base no admite un pedido en el lugar sin lugar, ni un lugar de otro local", async () => {
    await db.exec("reset role");
    const patio = (await db.query<{ id: string }>(`select id from public.delivery_spots where venue_id='${ids.patio}' limit 1`)).rows[0].id;
    const orderId = (await db.query<{ id: string }>(`select id from public.orders where venue_id='${ids.venue}' and fulfillment='bar' limit 1`)).rows[0].id;
    await expect(db.query(`update public.orders set fulfillment='location' where id='${orderId}'`)).rejects.toThrow();
    await expect(
      db.query(`update public.orders set fulfillment='location',spot_id='${patio}',spot_label='x' where id='${orderId}'`),
    ).rejects.toThrow();
  });
});

describe("exportación del período", () => {
  it("la administración exporta los pedidos con su lugar; el equipo y los clientes no", async () => {
    await db.exec("reset role");
    const today = (await db.query<{ d: string }>(`select business_date::text as d from public.orders limit 1`)).rows[0].d;
    await asAdmin();
    const result = await db.query<{ r: { spot_label: string | null; items: string; fulfillment: string; public_code: string }[] }>(
      `select public.venue_orders_export($1::uuid,$2::date,$3::date) as r`,
      [ids.venue, today, today],
    );
    const exported = result.rows[0].r;
    expect(exported.length).toBeGreaterThan(3);
    expect(exported.some((r) => r.fulfillment === "location" && r.spot_label)).toBe(true);
    expect(exported[0]).not.toHaveProperty("customer_id");
    await asBartender();
    await expect(
      db.query(`select public.venue_orders_export($1::uuid,$2::date,$3::date)`, [ids.venue, today, today]),
    ).rejects.toThrow("NOT_AUTHORIZED");
    await asCustomer();
    await expect(
      db.query(`select public.venue_orders_export($1::uuid,$2::date,$3::date)`, [ids.venue, today, today]),
    ).rejects.toThrow("NOT_AUTHORIZED");
    await asAdmin();
    await expect(
      db.query(`select public.venue_orders_export($1::uuid,$2::date,$3::date)`, [ids.venue, today, "2030-01-01"]),
    ).rejects.toThrow("INVALID_INPUT");
  });
});
