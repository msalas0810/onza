import { describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { actor, command, createInput, database, ids } from "../db/helpers";

type Row = Record<string, unknown>;
const configure = async (db: PGlite, input: Row) =>
  (
    await db.query<{ r: Row }>("select public.venue_auto_accept($1::jsonb) as r", [
      JSON.stringify({ venueId: ids.venue, ...input }),
    ])
  ).rows[0].r;
const status = async (db: PGlite, id: unknown) => {
  await db.exec("reset role");
  return (
    await db.query<{ status: string }>("select status from public.orders where id=$1", [id])
  ).rows[0].status;
};
const log = async (db: PGlite) => {
  await db.exec("reset role");
  return (
    await db.query<{ outcome: string; reason: string }>(
      "select outcome,reason from private.auto_accept_log order by created_at,reason",
    )
  ).rows;
};
const order = async (db: PGlite, key: string, extra: Row = {}) => {
  await actor(db);
  return command(db, createInput(key, extra));
};

describe("aceptación automática", () => {
  it("apagada por defecto: el pedido espera decisión manual", async () => {
    const db = await database();
    try {
      const o = await order(db, "manual");
      expect(o.status).toBe("queued");
      await db.query("select public.sweep_orders()");
      expect(await status(db, o.id)).toBe("queued");
    } finally {
      await db.close();
    }
  });

  it("solo administración la activa; al activarse acepta lo elegible con la transición común y sin actor humano", async () => {
    const db = await database();
    try {
      const waiting = await order(db, "before");
      await actor(db, ids.staff, "bar", false);
      await expect(configure(db, { enabled: true })).rejects.toThrow("NOT_AUTHORIZED");
      await actor(db, ids.admin, "admin", false);
      expect(await configure(db, { enabled: true, maxPreparing: 3 })).toEqual({ autoAccept: true, maxPreparing: 3 });
      expect(await status(db, waiting.id)).toBe("preparing");
      const fresh = await order(db, "after");
      expect(fresh.status).toBe("preparing");
      expect(fresh.queued_at).toBeTruthy();
      await db.exec("reset role");
      const { rows } = await db.query<{ actor_id: string | null; metadata: Row }>(
        "select actor_id,metadata from public.order_events where order_id=$1 and type='accept'",
        [fresh.id],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].actor_id).toBeNull();
      expect(rows[0].metadata).toMatchObject({ automatic: true, reason: "auto_accept" });
    } finally {
      await db.close();
    }
  });

  it("respeta el máximo en preparación; al marcar listo, el siguiente barrido acepta al que esperaba", async () => {
    const db = await database();
    try {
      await actor(db, ids.admin, "admin", false);
      await configure(db, { enabled: true, maxPreparing: 1 });
      const a = await order(db, "a");
      const b = await order(db, "b");
      expect(a.status).toBe("preparing");
      expect(b.status).toBe("queued");
      expect(await log(db)).toContainEqual({ outcome: "held", reason: "preparing_full" });
      await actor(db, ids.staff, "bar", false);
      await command(db, { action: "ready", orderId: a.id, expectedVersion: 2, idempotencyKey: "ready-a" });
      await actor(db);
      await db.query("select public.sweep_orders()");
      expect(await status(db, b.id)).toBe("preparing");
    } finally {
      await db.close();
    }
  });

  it("sin stock queda manual con el motivo registrado; la barra puede decidir", async () => {
    const db = await database();
    try {
      const o = await order(db, "soldout");
      await actor(db, ids.admin, "admin", false);
      await command(db, { action: "product_availability", venueId: ids.venue, productId: ids.product, available: false });
      await configure(db, { enabled: true });
      expect(await status(db, o.id)).toBe("queued");
      expect(await log(db)).toEqual([{ outcome: "held", reason: "out_of_stock" }]);
      await actor(db, ids.staff, "bar", false);
      expect((await command(db, { action: "accept", orderId: o.id, expectedVersion: 1, idempotencyKey: "m" })).status).toBe("preparing");
    } finally {
      await db.close();
    }
  });

  it("la pausa corta la automatización; el equipo puede volver a manual sin ser admin", async () => {
    const db = await database();
    try {
      const o = await order(db, "paused");
      await db.exec("reset role");
      await db.exec(`update public.venues set paused=true where id='${ids.venue}'`);
      await actor(db, ids.admin, "admin", false);
      await configure(db, { enabled: true });
      await db.query("select public.sweep_orders()");
      expect(await status(db, o.id)).toBe("queued");
      await actor(db, ids.staff, "bar", false);
      expect(await configure(db, { enabled: false })).toMatchObject({ autoAccept: false });
      await db.exec("reset role");
      await db.exec(`update public.venues set paused=false where id='${ids.venue}'`);
      await actor(db);
      await db.query("select public.sweep_orders()");
      expect(await status(db, o.id)).toBe("queued");
    } finally {
      await db.close();
    }
  });

  it("nunca duplica: la aceptación manual tras la automática pierde y las corridas repetidas no vuelven a aceptar", async () => {
    const db = await database();
    try {
      await actor(db, ids.admin, "admin", false);
      await configure(db, { enabled: true });
      const o = await order(db, "once");
      expect(o.status).toBe("preparing");
      await actor(db, ids.staff, "bar", false);
      await expect(
        command(db, { action: "accept", orderId: o.id, expectedVersion: 1, idempotencyKey: "late" }),
      ).rejects.toThrow("VERSION_CONFLICT");
      await db.exec("reset role");
      await db.query("select public.auto_accept_tick()");
      await db.query("select public.auto_accept_tick()");
      const { rows } = await db.query<{ n: number }>(
        "select count(*)::int n from public.order_events where order_id=$1 and type='accept'",
        [o.id],
      );
      expect(rows[0].n).toBe(1);
    } finally {
      await db.close();
    }
  });

  it("un pedido vencido no se acepta solo; el tick es solo para el servidor", async () => {
    const db = await database();
    try {
      const o = await order(db, "late");
      await db.exec("reset role");
      await db.query("update public.orders set deadline=now()-interval '1 second' where id=$1", [o.id]);
      await db.exec(`update public.venues set auto_accept=true where id='${ids.venue}'`);
      await db.query("select public.auto_accept_tick()");
      expect(await status(db, o.id)).toBe("expired");
      await actor(db, ids.admin, "admin", false);
      await expect(db.query("select public.auto_accept_tick()")).rejects.toThrow(/permission denied/);
    } finally {
      await db.close();
    }
  });

  it("deja lista la medición de espera y preparación por hora y tamaño", async () => {
    const db = await database();
    try {
      await actor(db, ids.admin, "admin", false);
      await configure(db, { enabled: true });
      const o = await order(db, "timed");
      await actor(db, ids.staff, "bar", false);
      await command(db, { action: "ready", orderId: o.id, expectedVersion: 2, idempotencyKey: "r" });
      await actor(db, ids.admin, "admin", false);
      const { rows } = await db.query<{ r: Row[] }>("select public.venue_timing_stats($1,$2,$2) as r", [ids.venue, o.business_date]);
      expect(rows[0].r).toHaveLength(1);
      expect(rows[0].r[0]).toMatchObject({ size: "1-2", n: 1, prep_n: 1 });
    } finally {
      await db.close();
    }
  });
});
