import { describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { actor, command, createInput, database, ids } from "../db/helpers";

type Range = {
  grain: string;
  orders: number;
  delivered_orders: number;
  captured_minor: number;
  refunded_minor: number;
  net_minor: number;
  reserved_now_minor: number;
  active_orders: number;
  preparation_n: number;
  median_preparation_seconds: number | null;
  median_wait_seconds: number | null;
  series: { bucket: string; orders: number; net_minor: number }[];
  products: { name_snapshot: string; units: number; total_minor: number }[];
};
const range = async (db: PGlite, from: string, to = from) =>
  (
    await db.query<{ r: Range }>(
      "select public.venue_summary_range($1,$2,$3) as r",
      [ids.venue, from, to],
    )
  ).rows[0].r;
/** Mueve un pedido (y sus operaciones) a una hora de Costa Rica, para probar cortes con reloj controlado. */
async function at(db: PGlite, orderId: unknown, local: string, prepMinutes = 0) {
  await db.exec("reset role");
  const ts = `'${local}'::timestamp at time zone 'America/Costa_Rica'`;
  await db.query(
    `update public.orders set created_at=${ts},queued_at=${ts},preparing_at=case when preparing_at is null then null else ${ts}+interval '1 minute' end,ready_at=case when ready_at is null then null else ${ts}+interval '1 minute'+$2::interval end where id=$1`,
    [orderId, `${prepMinutes} minutes`],
  );
  await db.query(
    `update private.payment_operations set created_at=${ts}+interval '20 minutes' where payment_id=(select id from private.payments where order_id=$1) and type in ('capture','refund')`,
    [orderId],
  );
}
async function deliver(db: PGlite, key: string) {
  await actor(db);
  const o = await command(db, createInput(key));
  await actor(db, ids.staff, "bar", false);
  await command(db, { action: "accept", orderId: o.id, expectedVersion: 1, idempotencyKey: `${key}-a` });
  await command(db, { action: "ready", orderId: o.id, expectedVersion: 2, idempotencyKey: `${key}-r` });
  await db.exec("reset role");
  await db.query("update private.payments set status='captured',captured_minor=authorized_minor where order_id=$1", [o.id]);
  await db.query(
    "insert into private.payment_operations(payment_id,type,idempotency_key,status,provider_state,amount_minor) select id,'capture','capture:'||order_id,'captured','captured',authorized_minor from private.payments where order_id=$1",
    [o.id],
  );
  await db.query("update public.orders set status='delivered',delivered_at=now() where id=$1", [o.id]);
  return o;
}

describe("resumen por período", () => {
  it("23:45 y 00:30 caen en la misma noche; 06:00 abre la siguiente; ventas netas por hora de la operación", async () => {
    const db = await database();
    try {
      const a = await deliver(db, "late");
      const b = await deliver(db, "after-midnight");
      const c = await deliver(db, "next-night");
      await at(db, a.id, "2026-11-20 23:45", 4);
      await at(db, b.id, "2026-11-21 00:30", 8);
      await at(db, c.id, "2026-11-21 06:00", 2);
      await actor(db, ids.admin, "admin", false);
      const night = await range(db, "2026-11-20");
      expect(night.grain).toBe("hour");
      expect(night.orders).toBe(2);
      expect(night.delivered_orders).toBe(2);
      expect(night.captured_minor).toBe(1800000);
      expect(night.net_minor).toBe(1800000);
      expect(night.median_preparation_seconds).toBe(360);
      expect(night.median_wait_seconds).toBe(60);
      expect(night.series.map((s) => s.bucket).sort()).toEqual(["00", "23"]);
      expect(night.products).toEqual([
        { product_id: ids.product, name_snapshot: "Paloma", units: 4, total_minor: 1800000 },
      ]);
      const next = await range(db, "2026-11-21");
      expect(next.orders).toBe(1);
      const week = await range(db, "2026-11-16", "2026-11-22");
      expect(week.grain).toBe("day");
      expect(week.orders).toBe(3);
      expect(week.series.map((s) => [s.bucket, s.orders])).toEqual([
        ["2026-11-20", 2],
        ["2026-11-21", 1],
      ]);
    } finally {
      await db.close();
    }
  });

  it("devoluciones restan en la noche en que se confirman; reservas son saldo actual aparte", async () => {
    const db = await database();
    try {
      const sold = await deliver(db, "sold");
      await at(db, sold.id, "2026-11-20 22:00");
      await actor(db, ids.admin, "admin", false);
      await command(db, { action: "refund", orderId: sold.id, reason: "Producto equivocado" });
      await db.exec("reset role");
      await db.query(
        "update private.payment_operations set created_at=('2026-11-21 08:00'::timestamp at time zone 'America/Costa_Rica') where type='refund'",
      );
      await actor(db);
      await command(db, createInput("reserved")); // queda reservado: no es venta
      await actor(db, ids.admin, "admin", false);
      const first = await range(db, "2026-11-20");
      expect(first.net_minor).toBe(900000);
      expect(first.refunded_minor).toBe(0);
      const second = await range(db, "2026-11-21");
      expect(second.refunded_minor).toBe(900000);
      expect(second.net_minor).toBe(-900000);
      expect(first.reserved_now_minor).toBe(900000);
      expect(first.active_orders).toBe(1);
    } finally {
      await db.close();
    }
  });

  it("período sin operaciones devuelve ceros y series vacías; solo administración", async () => {
    const db = await database();
    try {
      await actor(db, ids.admin, "admin", false);
      const empty = await range(db, "2025-01-01", "2025-03-31");
      expect(empty).toMatchObject({ grain: "month", orders: 0, net_minor: 0, series: [], products: [], median_preparation_seconds: null });
      await expect(range(db, "2026-01-02", "2026-01-01")).rejects.toThrow("INVALID_INPUT");
      await actor(db, ids.staff, "bar", false);
      await expect(range(db, "2026-01-01")).rejects.toThrow("NOT_AUTHORIZED");
    } finally {
      await db.close();
    }
  });
});
