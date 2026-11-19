import { it, expect, describe } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { database, actor, command, createInput, ids } from "../db/helpers";

type Row = Record<string, unknown>;
/** Llama a onza_command y devuelve la respuesta cruda (incluye { error, productId, … } sin lanzar). */
async function raw(db: PGlite, input: Row) {
  const { rows } = await db.query<{ result: Row }>(
    "select public.onza_command($1::jsonb) as result",
    [JSON.stringify(input)],
  );
  return rows[0].result;
}
/** Reloj controlado: mueve la entrada a la cola `elapsed` hacia atrás manteniendo el plazo de 5:00 del servidor. */
async function setElapsed(db: PGlite, orderId: string, elapsed: string) {
  await db.exec("reset role");
  await db.query(
    `update public.orders set queued_at=now()-$2::interval, deadline=now()-$2::interval+interval '5 minutes' where id=$1`,
    [orderId, elapsed],
  );
}
const accept = (orderId: unknown, version: number, key = "accept") => ({
  action: "accept",
  orderId,
  expectedVersion: version,
  idempotencyKey: key,
});

describe("plazo de aceptación de cinco minutos", () => {
  it("arranca cuando el servidor deja el pedido en la cola y devuelve su vencimiento", async () => {
    const db = await database();
    try {
      await actor(db);
      const o = await command(db, createInput());
      expect(o.status).toBe("queued");
      expect(o.queued_at).toBeTruthy();
      const window =
        new Date(String(o.deadline)).getTime() -
        new Date(String(o.queued_at)).getTime();
      expect(window).toBe(5 * 60 * 1000);
      expect(o.server_now).toBeTruthy();
    } finally {
      await db.close();
    }
  });

  it("aceptar a las 4:59 funciona", async () => {
    const db = await database();
    try {
      await actor(db);
      const o = await command(db, createInput());
      await setElapsed(db, String(o.id), "4 minutes 59 seconds");
      await actor(db, ids.staff, "bar", false);
      const accepted = await command(db, accept(o.id, 1));
      expect(accepted.status).toBe("preparing");
      expect(accepted.payment_state).toBe("authorized");
    } finally {
      await db.close();
    }
  });

  it("a las 5:00 exactas vence: no se acepta y la reserva se libera", async () => {
    const db = await database();
    try {
      await actor(db);
      const o = await command(db, createInput());
      // Misma transacción: now() es idéntico en el update y en la aceptación → deadline = now() (5:00 justas).
      await db.exec("begin");
      await setElapsed(db, String(o.id), "5 minutes");
      await actor(db, ids.staff, "bar", false);
      const result = await raw(db, accept(o.id, 1));
      await db.exec("commit");
      expect(result.error).toBe("ORDER_EXPIRED");
      await actor(db);
      const after = await command(db, { action: "get", orderId: o.id });
      expect(after.status).toBe("expired");
      expect(after.payment_state).toBe("voided");
    } finally {
      await db.close();
    }
  });

  it("pasado el plazo, cualquier comando reconcilia y la barra recibe ORDER_EXPIRED en vez de un conflicto", async () => {
    const db = await database();
    try {
      await actor(db);
      const o = await command(db, createInput());
      await setElapsed(db, String(o.id), "5 minutes 1 second");
      await actor(db, ids.staff, "bar", false);
      expect((await raw(db, accept(o.id, 1))).error).toBe("ORDER_EXPIRED");
      // El cliente que intenta cancelar ve el mismo estado: nada que liberar dos veces.
      await actor(db);
      expect(
        (
          await raw(db, {
            action: "cancel",
            orderId: o.id,
            expectedVersion: 1,
            idempotencyKey: "c",
            reason: "Ya no",
          })
        ).error,
      ).toBe("ORDER_EXPIRED");
      await db.exec("reset role");
      const { rows } = await db.query<{ n: number }>(
        `select count(*)::int n from private.payment_operations where type='void'`,
      );
      expect(rows[0].n).toBe(1);
    } finally {
      await db.close();
    }
  });

  it("autorización confirmada tarde: el plazo empieza al entrar en la cola, no al tocar Pedir", async () => {
    const db = await database();
    try {
      await actor(db);
      const o = await command(
        db,
        createInput("needs-action", { scenario: "requires_action" }),
      );
      expect(o.status).toBe("pending_authorization");
      expect(o.queued_at).toBeNull();
      const queued = await command(db, {
        action: "authorize_action",
        orderId: o.id,
      });
      expect(queued.status).toBe("queued");
      expect(
        new Date(String(queued.deadline)).getTime() -
          new Date(String(queued.queued_at)).getTime(),
      ).toBe(5 * 60 * 1000);
    } finally {
      await db.close();
    }
  });
});

describe("una sola transición gana", () => {
  it("cancelar primero: la aceptación con la versión vieja pierde", async () => {
    const db = await database();
    try {
      await actor(db);
      const o = await command(db, createInput());
      await command(db, {
        action: "cancel",
        orderId: o.id,
        expectedVersion: 1,
        idempotencyKey: "c",
        reason: "Cambio de opinión",
      });
      await actor(db, ids.staff, "bar", false);
      await expect(command(db, accept(o.id, 1))).rejects.toThrow(
        "VERSION_CONFLICT",
      );
    } finally {
      await db.close();
    }
  });

  it("dos operadores: el segundo recibe conflicto y el reintento del primero es idempotente", async () => {
    const db = await database();
    try {
      await actor(db);
      const o = await command(db, createInput());
      await db.exec("reset role");
      await db.exec(
        `insert into auth.users values('10000000-0000-4000-8000-000000000009');insert into public.memberships values('10000000-0000-4000-8000-000000000009','${ids.venue}','bartender')`,
      );
      await actor(db, ids.staff, "bar-1", false);
      const first = await command(db, accept(o.id, 1, "op-1"));
      expect(first.status).toBe("preparing");
      expect((await command(db, accept(o.id, 1, "op-1"))).version).toBe(
        first.version,
      );
      await actor(db, "10000000-0000-4000-8000-000000000009", "bar-2", false);
      await expect(command(db, accept(o.id, 1, "op-2"))).rejects.toThrow(
        "VERSION_CONFLICT",
      );
      await db.exec("reset role");
      const { rows } = await db.query<{ n: number }>(
        `select count(*)::int n from public.order_events where order_id=$1 and type='accept'`,
        [o.id],
      );
      expect(rows[0].n).toBe(1);
    } finally {
      await db.close();
    }
  });

  it("el vencimiento gana a una aceptación tardía y no deja eventos duplicados", async () => {
    const db = await database();
    try {
      await actor(db);
      const o = await command(db, createInput());
      await setElapsed(db, String(o.id), "6 minutes");
      await actor(db);
      await db.query("select public.sweep_orders()");
      await actor(db, ids.staff, "bar", false);
      expect((await raw(db, accept(o.id, 1))).error).toBe("ORDER_EXPIRED");
      await db.exec("reset role");
      const { rows } = await db.query<{ type: string }>(
        `select type from public.order_events where order_id=$1 order by created_at`,
        [o.id],
      );
      expect(rows.map((r) => r.type)).toEqual(["created", "expired"]);
    } finally {
      await db.close();
    }
  });
});

describe("cupos y pedidos que bloquean", () => {
  it("vencidos, terminales y autorizaciones inciertas fuera de plazo no ocupan cupo", async () => {
    const db = await database();
    try {
      await db.exec(
        `update public.venues set capacity=1 where id='${ids.venue}'`,
      );
      await actor(db);
      const uncertain = await command(
        db,
        createInput("uncertain", { scenario: "timeout" }),
      );
      expect(uncertain.payment_state).toBe("unknown");
      // Dentro de su plazo ocupa el único cupo.
      await expect(command(db, createInput("blocked"))).rejects.toThrow(
        "VENUE_CAPACITY",
      );
      await db.exec("reset role");
      await db.query(
        `update public.orders set deadline=now()-interval '1 second' where id=$1`,
        [uncertain.id],
      );
      await actor(db);
      const next = await command(db, createInput("after-uncertain"));
      expect(next.status).toBe("queued");
      // La incierta no se anula sola: espera conciliación, pero ya no bloquea.
      const still = await command(db, { action: "get", orderId: uncertain.id });
      expect(still.status).toBe("pending_authorization");
      expect(still.payment_state).toBe("unknown");
    } finally {
      await db.close();
    }
  });

  it("el intento anterior se consulta por clave: ninguno, o el pedido que creó", async () => {
    const db = await database();
    try {
      await actor(db);
      expect(
        await raw(db, { action: "attempt_status", idempotencyKey: "k-1" }),
      ).toEqual({ attempt: "none" });
      const o = await command(db, createInput("k-1"));
      const found = await raw(db, {
        action: "attempt_status",
        idempotencyKey: "k-1",
      });
      expect(found.attempt).toBe("found");
      expect((found.order as Row).id).toBe(o.id);
      // Otra cuenta no ve el intento ajeno con la misma clave.
      await actor(db, ids.other);
      expect(
        await raw(db, { action: "attempt_status", idempotencyKey: "k-1" }),
      ).toEqual({ attempt: "none" });
      // Reintentar el envío con la misma clave devuelve el mismo pedido, sin duplicar.
      await actor(db);
      expect((await command(db, createInput("k-1"))).id).toBe(o.id);
      await db.exec("reset role");
      expect(
        (
          await db.query<{ n: number }>(
            "select count(*)::int n from public.orders",
          )
        ).rows[0].n,
      ).toBe(1);
    } finally {
      await db.close();
    }
  });

  it("un rechazo definitivo no deja pedido ni intento registrado", async () => {
    const db = await database();
    try {
      await actor(db, ids.admin, "admin", false);
      await command(db, {
        action: "product_availability",
        venueId: ids.venue,
        productId: ids.product,
        available: false,
      });
      await actor(db);
      const result = await raw(db, createInput("rejected"));
      expect(result).toEqual({ error: "OUT_OF_STOCK", productId: ids.product });
      expect(
        await raw(db, { action: "attempt_status", idempotencyKey: "rejected" }),
      ).toEqual({ attempt: "none" });
    } finally {
      await db.close();
    }
  });
});

describe("disponible, agotado y archivado", () => {
  const save = (extra: Row) => ({
    venueId: ids.venue,
    productId: ids.product,
    ...extra,
  });

  it("agotar y reactivar no cambia la versión ni invalida carritos", async () => {
    const db = await database();
    try {
      await actor(db, ids.admin, "admin", false);
      const off = await command(
        db,
        save({ action: "product_availability", available: false }),
      );
      expect(off).toMatchObject({ available: false, archived: false, version: 1 });
      // Idempotente: repetir el mismo valor no falla ni cambia nada.
      expect(
        (await command(db, save({ action: "product_availability", available: false })))
          .version,
      ).toBe(1);
      const on = await command(
        db,
        save({ action: "product_availability", available: true }),
      );
      expect(on).toMatchObject({ available: true, version: 1 });
      await actor(db);
      expect((await command(db, createInput("cart-kept"))).status).toBe("queued");
    } finally {
      await db.close();
    }
  });

  it("solo administración agota; el producto sigue listado para el admin", async () => {
    const db = await database();
    try {
      await actor(db, ids.staff, "bar", false);
      await expect(
        command(db, save({ action: "product_availability", available: false })),
      ).rejects.toThrow("NOT_AUTHORIZED");
      await actor(db, ids.admin, "admin", false);
      await command(db, save({ action: "product_availability", available: false }));
      const { rows } = await db.query<{ available: boolean }>(
        "select available from public.products where id=$1",
        [ids.product],
      );
      expect(rows).toEqual([{ available: false }]);
    } finally {
      await db.close();
    }
  });

  it("archivar oculta al cliente; restaurar vuelve a administración como agotado", async () => {
    const db = await database();
    try {
      await actor(db, ids.admin, "admin", false);
      const archived = await command(
        db,
        save({ action: "product_archive", archived: true }),
      );
      expect(archived.archived).toBe(true);
      await expect(
        command(db, save({ action: "product_availability", available: true })),
      ).rejects.toThrow("PRODUCT_ARCHIVED");
      await actor(db);
      expect(
        (
          await db.query("select id from public.products where id=$1", [
            ids.product,
          ])
        ).rows,
      ).toHaveLength(0);
      expect((await raw(db, createInput("archived"))).error).toBe("OUT_OF_STOCK");
      await actor(db, ids.admin, "admin", false);
      const restored = await command(
        db,
        save({ action: "product_archive", archived: false }),
      );
      expect(restored).toMatchObject({ archived: false, available: false });
      await actor(db);
      expect((await raw(db, createInput("restored-not-sold"))).error).toBe(
        "OUT_OF_STOCK",
      );
      await actor(db, ids.admin, "admin", false);
      await command(db, save({ action: "product_availability", available: true }));
      await actor(db);
      expect((await command(db, createInput("enabled"))).status).toBe("queued");
    } finally {
      await db.close();
    }
  });

  it("precio nuevo: rechaza solo esa línea y devuelve el precio vigente; cambios sin precio no molestan", async () => {
    const db = await database();
    try {
      await actor(db, ids.admin, "admin", false);
      await command(db, {
        action: "product_save",
        venueId: ids.venue,
        productId: ids.product,
        expectedVersion: 1,
        description: "Nueva descripción",
      });
      const item = (price: number) => ({
        items: [
          {
            productId: ids.product,
            quantity: 1,
            expectedProductVersion: 1,
            expectedPriceMinor: price,
          },
        ],
      });
      await actor(db);
      expect(
        (await command(db, createInput("same-price", item(450000)))).status,
      ).toBe("queued");
      await actor(db, ids.admin, "admin", false);
      await command(db, {
        action: "product_save",
        venueId: ids.venue,
        productId: ids.product,
        expectedVersion: 2,
        priceMinor: 480000,
      });
      await actor(db);
      expect(await raw(db, createInput("old-price", item(450000)))).toEqual({
        error: "PRICE_CHANGED",
        productId: ids.product,
        priceMinor: 480000,
        version: 3,
      });
    } finally {
      await db.close();
    }
  });
});
