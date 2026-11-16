import { it, expect } from "vitest";
import { createHash } from "node:crypto";
import { database, actor, command, createInput, ids } from "../db/helpers";
const manual = (key: string) =>
  createHash("sha256").update(key).digest("hex").slice(0, 12).toUpperCase();
it("public number never claims pickup; private legacy token yields a separate code; consumed code rejects", async () => {
  const db = await database();
  try {
    await actor(db);
    const o = await command(db, createInput("credential"));
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
    await expect(
      command(db, {
        action: "resolve",
        venueId: ids.venue,
        code: o.public_code,
      }),
    ).rejects.toThrow("INVALID_PICKUP");
    const list = await db.query<{ result: Record<string, unknown>[] }>(
      "select public.order_list($1) as result",
      [ids.venue],
    );
    expect(list.rows[0].result[0].encrypted_token).toBeNull();
    expect(list.rows[0].result[0].pickup_code).toBeUndefined();
    const claim = await command(db, {
      action: "resolve",
      venueId: ids.venue,
      code: manual("credential"),
    });
    expect(claim.claim_id).toBeTruthy();
    await command(db, {
      action: "capture",
      orderId: o.id,
      claimId: claim.claim_id,
    });
    await command(db, {
      action: "complete",
      orderId: o.id,
      claimId: claim.claim_id,
      physicalHandoff: true,
    });
    await expect(
      command(db, {
        action: "resolve",
        venueId: ids.venue,
        code: manual("credential"),
      }),
    ).rejects.toThrow("ALREADY_DELIVERED");
  } finally {
    await db.close();
  }
});
