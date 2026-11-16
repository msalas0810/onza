import { createHash } from "node:crypto";
import { it, expect } from "vitest";
import { database, actor, command, createInput, ids } from "../db/helpers";
async function ready(db: Awaited<ReturnType<typeof database>>) {
  await actor(db);
  const o = await command(db, createInput());
  await actor(db, ids.staff, "staff-a", false);
  await command(db, {
    action: "accept",
    orderId: o.id,
    expectedVersion: 1,
    idempotencyKey: "a",
  });
  return command(db, {
    action: "ready",
    orderId: o.id,
    expectedVersion: 2,
    idempotencyKey: "r",
  });
}
it("un dueño de entrega, una captura, timeout se reconcilia sin recobrar", async () => {
  const db = await database();
  try {
    const o = await ready(db);
    const claim = await command(db, {
      action: "resolve",
      venueId: ids.venue,
      code: createHash("sha256").update("order-one").digest("hex").slice(0, 12),
    });
    expect(claim.claim_id).toBeTruthy();
    const capture = { orderId: o.id, claimId: claim.claim_id };
    await actor(db, ids.staff, "staff-b", false);
    const other = await command(db, {
      action: "resolve",
      venueId: ids.venue,
      code: createHash("sha256").update("order-one").digest("hex").slice(0, 12),
    });
    expect(other.claim_id).toBeNull();
    expect(other.claimed_elsewhere).toBe(true);
    await expect(
      command(db, { action: "capture", ...capture }),
    ).rejects.toThrow("CLAIM_OWNED_ELSEWHERE");
    await actor(db, ids.staff, "staff-a", false);
    const unknown = await command(db, {
      action: "capture",
      ...capture,
      scenario: "timeout_after_success",
    });
    expect(unknown.payment_state).toBe("unknown");
    await expect(
      command(db, { action: "complete", ...capture, physicalHandoff: true }),
    ).rejects.toThrow("PAYMENT_UNCONFIRMED");
    await expect(
      command(db, { action: "capture", ...capture }),
    ).rejects.toThrow("PAYMENT_UNCONFIRMED");
    await db.exec("reset role");
    await db.exec(
      `update public.orders set deadline=now()-interval '1 minute'`,
    );
    await actor(db, ids.staff, "staff-a", false);
    await db.query("select public.sweep_orders()");
    expect(
      (await command(db, { action: "reconcile", ...capture })).payment_state,
    ).toBe("captured");
    expect(
      (await command(db, { action: "capture", ...capture })).captured_minor,
    ).toBe(900000);
    expect(
      (
        await command(db, {
          action: "complete",
          ...capture,
          physicalHandoff: true,
        })
      ).status,
    ).toBe("delivered");
    expect(
      (
        await command(db, {
          action: "complete",
          ...capture,
          physicalHandoff: true,
        })
      ).status,
    ).toBe("delivered");
    await db.exec("reset role");
    expect(
      (
        await db.query(
          `select * from private.payment_operations where type='capture'`,
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          `select * from public.order_events where type='delivered'`,
        )
      ).rows,
    ).toHaveLength(1);
  } finally {
    await db.close();
  }
});
it("QR alterado, local ajeno, vencido; cliente no puede capturar", async () => {
  const db = await database();
  try {
    const o = await ready(db);
    await expect(
      command(db, {
        action: "resolve",
        venueId: ids.venue,
        tokenHash: "b".repeat(64),
      }),
    ).rejects.toThrow("INVALID_PICKUP");
    await expect(
      command(db, {
        action: "resolve",
        venueId: ids.patio,
        code: createHash("sha256")
          .update("order-one")
          .digest("hex")
          .slice(0, 12),
      }),
    ).rejects.toThrow("INVALID_PICKUP");
    await actor(db);
    await expect(
      command(db, {
        action: "capture",
        orderId: o.id,
        claimId: crypto.randomUUID(),
      }),
    ).rejects.toThrow("NOT_AUTHORIZED");
    await db.exec("reset role");
    await db.exec(
      `update private.pickup_tokens set expires_at=now()-interval '1 second'`,
    );
    await actor(db, ids.staff, "staff-a", false);
    await expect(
      command(db, {
        action: "resolve",
        venueId: ids.venue,
        code: createHash("sha256")
          .update("order-one")
          .digest("hex")
          .slice(0, 12),
      }),
    ).rejects.toThrow("EXPIRED");
  } finally {
    await db.close();
  }
});
