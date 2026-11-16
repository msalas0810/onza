import { it, expect } from "vitest";
import { database, actor, command, createInput, ids } from "../db/helpers";
it("supervisor concilia autorización unknown sin crear otra reserva", async () => {
  const db = await database();
  try {
    await actor(db);
    const o = await command(
      db,
      createInput("lost-reference", { scenario: "timeout" }),
    );
    await actor(db, ids.admin, "admin-device", false);
    const result = await command(db, {
      action: "reconcile_authorization",
      orderId: o.id,
      outcome: "authorized",
      reason: "Evidencia simulada verificada",
      providerResultConfirmed: true,
    });
    expect(result.status).toBe("queued");
    expect(result.payment_state).toBe("authorized");
    await db.exec("reset role");
    expect(
      (
        await db.query(
          "select * from private.payment_operations where type='authorize'",
        )
      ).rows,
    ).toHaveLength(1);
  } finally {
    await db.close();
  }
});
it("captura rechazada permite cancelación supervisada y anulación de reserva", async () => {
  const db = await database();
  try {
    await actor(db);
    const o = await command(db, createInput());
    await actor(db, ids.staff, "bar", false);
    await command(db, {
      action: "accept",
      orderId: o.id,
      expectedVersion: 1,
      idempotencyKey: "a",
    });
    await command(db, {
      action: "ready",
      orderId: o.id,
      expectedVersion: 2,
      idempotencyKey: "r",
    });
    const claim = await command(db, {
      action: "resolve",
      venueId: ids.venue,
      code: o.public_code,
    });
    const failed = await command(db, {
      action: "capture",
      orderId: o.id,
      claimId: claim.claim_id,
      scenario: "declined",
    });
    expect(failed.capture_state).toBe("declined");
    await actor(db, ids.admin, "admin", false);
    const result = await command(db, {
      action: "cancel",
      orderId: o.id,
      expectedVersion: failed.version,
      idempotencyKey: "cancel",
      reason: "Captura rechazada por proveedor mock",
    });
    expect(result.status).toBe("canceled");
    expect(result.payment_state).toBe("voided");
  } finally {
    await db.close();
  }
});

it("devolución repetida retorna el resultado previo sin otra operación", async () => {
  const db = await database();
  try {
    await actor(db);
    const o = await command(db, createInput());
    await db.exec("reset role");
    await db.exec(
      "update private.payments set status='captured',captured_minor=authorized_minor",
    );
    await actor(db, ids.admin, "supervisor", false);
    const input = {
      action: "refund",
      orderId: o.id,
      reason: "Devolución verificada",
    };
    const first = await command(db, input);
    const again = await command(db, input);
    expect(again.refunded_minor).toBe(first.refunded_minor);
    await db.exec("reset role");
    expect(
      (
        await db.query(
          "select * from private.payment_operations where type='refund'",
        )
      ).rows,
    ).toHaveLength(1);
  } finally {
    await db.close();
  }
});
