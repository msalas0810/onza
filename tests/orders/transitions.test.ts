import { it, expect } from "vitest";
import { database, actor, command, createInput, ids } from "../db/helpers";
it("ready no captura; aceptar/cancelar tiene un solo ganador y snapshot no cambia", async () => {
  const db = await database();
  try {
    await actor(db);
    const o = await command(db, createInput());
    await actor(db, ids.staff, "staff-one", false);
    const accepted = await command(db, {
      action: "accept",
      orderId: o.id,
      expectedVersion: 1,
      idempotencyKey: "accept",
    });
    expect(accepted.status).toBe("preparing");
    await actor(db);
    await expect(
      command(db, {
        action: "cancel",
        orderId: o.id,
        expectedVersion: 1,
        idempotencyKey: "cancel",
        reason: "Cambio de opinión",
      }),
    ).rejects.toThrow("VERSION_CONFLICT");
    await actor(db, ids.staff, "staff-one", false);
    const ready = await command(db, {
      action: "ready",
      orderId: o.id,
      expectedVersion: 2,
      idempotencyKey: "ready",
    });
    expect(ready.payment_state).toBe("authorized");
    expect(ready.captured_minor).toBe(0);
    await command(db, {
      action: "ready",
      orderId: o.id,
      expectedVersion: 2,
      idempotencyKey: "ready",
    });
    await db.exec("reset role");
    expect(
      (await db.query("select * from private.notifications")).rows,
    ).toHaveLength(1);
    await db.exec(
      `update public.products set name='Otro nombre',price_minor=1 where id='${ids.product}'`,
    );
    expect(
      (
        await db.query<{ name_snapshot: string }>(
          "select name_snapshot from public.order_items",
        )
      ).rows[0].name_snapshot,
    ).toBe("Paloma");
  } finally {
    await db.close();
  }
});
it("vencimiento y no-show anulan sin cobrar; barrido es idempotente", async () => {
  const db = await database();
  try {
    await actor(db);
    const o = await command(db, createInput());
    await db.exec("reset role");
    await db.exec(
      `update public.orders set deadline=now()-interval '1 second'`,
    );
    await actor(db);
    expect(
      (await db.query<{ sweep_orders: number }>("select public.sweep_orders()"))
        .rows[0].sweep_orders,
    ).toBe(1);
    expect(
      (await command(db, { action: "get", orderId: o.id })).payment_state,
    ).toBe("voided");
    expect(
      (await db.query<{ sweep_orders: number }>("select public.sweep_orders()"))
        .rows[0].sweep_orders,
    ).toBe(0);
  } finally {
    await db.close();
  }
});
