import { describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { actor, command, createInput, database, ids } from "../db/helpers";

const third = "10000000-0000-4000-8000-000000000007";
type Row = Record<string, unknown>;
const raw = async (db: PGlite, input: Row) =>
  (
    await db.query<{ r: Row }>("select public.onza_command($1::jsonb) as r", [
      JSON.stringify(input),
    ])
  ).rows[0].r;
const waitlist = async (db: PGlite, action: string, venueId = ids.venue) =>
  (
    await db.query<{ r: Row }>("select public.waitlist_command($1::jsonb) as r", [
      JSON.stringify({ action, venueId }),
    ])
  ).rows[0].r;
const asCustomer = (db: PGlite, user = ids.customer) => actor(db, user, `${user}-phone`, false);
async function setup(extra = "") {
  const db = await database();
  await db.exec(`insert into auth.users values('${third}');${extra}`);
  return db;
}
const cancel = (orderId: unknown, version = 1, key = `c-${String(orderId)}`) => ({
  action: "cancel",
  orderId,
  expectedVersion: version,
  idempotencyKey: key,
  reason: "Cambio de opinión",
});

describe("límite por cancelaciones del cliente", () => {
  async function cancelThree(db: PGlite) {
    await asCustomer(db);
    for (const n of [1, 2, 3]) {
      const o = await command(db, createInput(`k${n}`));
      await command(db, cancel(o.id));
    }
  }

  it("por defecto solo observa: registra para soporte y deja pedir", async () => {
    const db = await setup();
    try {
      await cancelThree(db);
      expect((await command(db, createInput("k4"))).status).toBe("queued");
      await db.exec("reset role");
      const { rows } = await db.query<{ kind: string; cancels: number }>(
        "select kind,cancels from private.abuse_events",
      );
      expect(rows).toEqual([{ kind: "cancel_cooldown_observed", cancels: 3 }]);
    } finally {
      await db.close();
    }
  });

  it("aplicado: 3 en 10 min pausan 5 min la creación; ver y cancelar siguen; vence la pausa", async () => {
    const db = await setup("update private.configuration set cancel_limit_mode='enforce';");
    try {
      await asCustomer(db);
      const kept = await command(db, createInput("kept"));
      await cancelThree(db);
      const blocked = await raw(db, createInput("k4"));
      expect(blocked.error).toBe("CANCEL_COOLDOWN");
      const retry = Date.parse(String(blocked.retryAt));
      expect(retry - Date.now()).toBeGreaterThan(4 * 60 * 1000);
      expect(retry - Date.now()).toBeLessThanOrEqual(5 * 60 * 1000);
      expect((await command(db, { action: "get", orderId: kept.id })).status).toBe("queued");
      expect((await command(db, cancel(kept.id))).status).toBe("canceled");
      expect((await waitlist(db, "join")).error).toBe("CANCEL_COOLDOWN");
      // El reintento de la misma operación no suma: la clave idempotente devuelve el mismo resultado.
      await command(db, cancel(kept.id));
      await db.exec("reset role");
      await db.exec("update public.order_events set created_at=created_at-interval '6 minutes' where type='cancel'");
      await asCustomer(db);
      expect((await command(db, createInput("after"))).status).toBe("queued");
    } finally {
      await db.close();
    }
  });

  it("no cuentan rechazos del local, vencimientos ni reservas rechazadas al crear", async () => {
    const db = await setup("update private.configuration set cancel_limit_mode='enforce';");
    try {
      for (const n of [1, 2, 3]) {
        await asCustomer(db);
        const o = await command(db, createInput(`staff-${n}`));
        await actor(db, ids.staff, "bar", false);
        await command(db, { ...cancel(o.id), reason: "Sin stock" });
      }
      await asCustomer(db);
      await command(db, createInput("declined", { scenario: "declined" }));
      const late = await command(db, createInput("late"));
      await db.exec("reset role");
      await db.query("update public.orders set deadline=now()-interval '1 second' where id=$1", [late.id]);
      await asCustomer(db);
      await db.query("select public.sweep_orders()");
      expect((await command(db, createInput("ok"))).status).toBe("queued");
    } finally {
      await db.close();
    }
  });
});

describe("lista de espera", () => {
  const full = "update public.venues set capacity=1 where id='20000000-0000-4000-8000-000000000001';";

  it("barra llena: fila por orden de llegada, el cupo liberado se ofrece una sola vez y nadie se adelanta", async () => {
    const db = await setup(full);
    try {
      await asCustomer(db);
      const first = await command(db, createInput("first"));
      await asCustomer(db, ids.other);
      expect(await raw(db, createInput("other-direct"))).toEqual({ error: "VENUE_CAPACITY", waitlist: true });
      const b = await waitlist(db, "join");
      expect(b).toMatchObject({ status: "waiting", position: 1 });
      expect((await waitlist(db, "join")).id).toBe(b.id); // un lugar por cuenta y local
      await asCustomer(db, third);
      expect(await waitlist(db, "join")).toMatchObject({ status: "waiting", position: 2 });
      // Se libera el cupo: se ofrece al primero de la fila y queda retenido.
      await asCustomer(db);
      await command(db, cancel(first.id));
      await asCustomer(db, ids.other);
      const offered = await waitlist(db, "status");
      expect(offered.status).toBe("offered");
      expect(Date.parse(String(offered.offer_expires_at)) - Date.now()).toBeGreaterThan(100 * 1000);
      await asCustomer(db, third);
      expect(await waitlist(db, "status")).toMatchObject({ status: "waiting", position: 1 });
      expect((await raw(db, createInput("third-direct"))).error).toBe("VENUE_CAPACITY");
      // Confirmar la oferta crea el pedido (y recién ahí la reserva), revalidando todo.
      await asCustomer(db, ids.other);
      const order = await command(db, createInput("other-confirm"));
      expect(order.status).toBe("queued");
      expect(await waitlist(db, "status")).toMatchObject({ status: "claimed", order_id: order.id });
      await db.exec("reset role");
      expect(
        (await db.query<{ n: number }>("select count(*)::int n from private.payments")).rows[0].n,
      ).toBe(2);
    } finally {
      await db.close();
    }
  });

  it("dos checkouts por el último cupo: uno gana, el otro ve la barra llena", async () => {
    const db = await setup(full);
    try {
      await asCustomer(db);
      expect((await command(db, createInput("a"))).status).toBe("queued");
      await asCustomer(db, ids.other);
      expect((await raw(db, createInput("b"))).error).toBe("VENUE_CAPACITY");
    } finally {
      await db.close();
    }
  });

  it("una oferta vencida pasa al siguiente; la espera también vence y se puede reintentar", async () => {
    const db = await setup(full);
    try {
      await asCustomer(db);
      const first = await command(db, createInput("first"));
      await asCustomer(db, ids.other);
      await waitlist(db, "join");
      await asCustomer(db, third);
      await waitlist(db, "join");
      await asCustomer(db);
      await command(db, cancel(first.id));
      await asCustomer(db, ids.other);
      expect((await waitlist(db, "status")).status).toBe("offered");
      await db.exec("reset role");
      await db.query("update private.waitlist set offer_expires_at=now()-interval '1 second' where customer_id=$1", [ids.other]);
      await asCustomer(db, ids.other);
      expect(await waitlist(db, "status")).toMatchObject({ status: "expired", closed_reason: "offer_expired" });
      expect((await raw(db, createInput("late-confirm"))).error).toBe("VENUE_CAPACITY");
      await asCustomer(db, third);
      expect((await waitlist(db, "status")).status).toBe("offered");
      await db.exec("reset role");
      await db.query("update private.waitlist set wait_expires_at=now()-interval '1 second' where customer_id=$1", [ids.other]);
      await asCustomer(db, ids.other);
      expect((await waitlist(db, "join")).status).toBe("waiting"); // reintento al vencer
    } finally {
      await db.close();
    }
  });

  it("con el local pausado no hay ofertas nuevas; al reanudar se ofrecen; el lugar se recupera tras recargar", async () => {
    const db = await setup(full);
    try {
      await asCustomer(db);
      const first = await command(db, createInput("first"));
      await asCustomer(db, ids.other);
      const joined = await waitlist(db, "join");
      await db.exec("reset role");
      await db.exec("update public.venues set paused=true where id='20000000-0000-4000-8000-000000000001'");
      await asCustomer(db);
      await command(db, cancel(first.id));
      await asCustomer(db, ids.other);
      expect(await waitlist(db, "status")).toMatchObject({ id: joined.id, status: "waiting", venue_paused: true });
      await asCustomer(db, third);
      await expect(waitlist(db, "join")).rejects.toThrow("VENUE_PAUSED");
      await db.exec("reset role");
      await db.exec("update public.venues set paused=false where id='20000000-0000-4000-8000-000000000001'");
      await asCustomer(db, ids.other);
      expect(await waitlist(db, "status")).toMatchObject({ id: joined.id, status: "offered", venue_paused: false });
      expect((await waitlist(db, "leave")).status).toBe("left");
    } finally {
      await db.close();
    }
  });

  it("si un artículo se agota durante la espera, la oferta sigue retenida y se confirma sin esa línea", async () => {
    const db = await setup(full);
    try {
      await asCustomer(db);
      const first = await command(db, createInput("first"));
      await asCustomer(db, ids.other);
      await waitlist(db, "join");
      await asCustomer(db);
      await command(db, cancel(first.id));
      await actor(db, ids.admin, "admin", false);
      await command(db, { action: "product_availability", venueId: ids.venue, productId: ids.product, available: false });
      await asCustomer(db, ids.other);
      expect(await raw(db, createInput("with-soldout"))).toEqual({ error: "OUT_OF_STOCK", productId: ids.product });
      expect((await waitlist(db, "status")).status).toBe("offered");
      const order = await command(
        db,
        createInput("without", {
          items: [{ productId: "30000000-0000-4000-8000-000000000002", quantity: 1, expectedProductVersion: 1 }],
        }),
      );
      expect(order.status).toBe("queued");
    } finally {
      await db.close();
    }
  });
});
