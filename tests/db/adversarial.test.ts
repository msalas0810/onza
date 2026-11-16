import { it, expect } from "vitest";
import { database, actor, command, createInput, ids } from "./helpers";
it("RPC directa exige versiones y políticas aunque se omita API", async () => {
  const db = await database();
  try {
    await actor(db);
    const missingPolicy = createInput("missing-policy");
    delete (missingPolicy as Record<string, unknown>).termsVersion;
    await expect(command(db, missingPolicy)).rejects.toThrow("POLICY_REQUIRED");
    const noVersion = createInput("missing-version", {
      items: [{ productId: ids.product, quantity: 1 }],
    });
    await expect(command(db, noVersion)).rejects.toThrow("INVALID_INPUT");
    const o = await command(db, createInput("valid"));
    await actor(db, ids.staff, "staff-a", false);
    await expect(
      command(db, {
        action: "accept",
        orderId: o.id,
        idempotencyKey: "no-version",
      }),
    ).rejects.toThrow("INVALID_INPUT");
  } finally {
    await db.close();
  }
});
it("los intentos de código inválido también consumen el límite", async () => {
  const db = await database();
  try {
    await actor(db, ids.staff, "staff-a", false);
    for (let i = 0; i < 10; i++)
      await expect(
        command(db, { action: "resolve", venueId: ids.venue, code: "000000" }),
      ).rejects.toThrow("INVALID_PICKUP");
    await expect(
      command(db, { action: "resolve", venueId: ids.venue, code: "000000" }),
    ).rejects.toThrow("RATE_LIMITED");
  } finally {
    await db.close();
  }
});

it("RPC no permite saltar vencimientos ni versiones null; listado directo recupera el pedido", async () => {
  const db = await database();
  try {
    await actor(db);
    await expect(
      command(
        db,
        createInput("null-version", {
          items: [
            {
              productId: ids.product,
              quantity: 1,
              expectedProductVersion: null,
            },
          ],
        }),
      ),
    ).rejects.toThrow("PRICE_CHANGED");
    const o = await command(db, createInput("expires"));
    await db.exec("reset role");
    await db.exec(
      "update public.orders set deadline=now()-interval '1 second'",
    );
    await actor(db, ids.staff, "staff", false);
    await expect(
      command(db, {
        action: "accept",
        orderId: o.id,
        expectedVersion: 1,
        idempotencyKey: "stale",
      }),
    ).rejects.toThrow();
    await actor(db);
    const result = await db.query<{ result: { id: string }[] }>(
      "select public.order_list(null,$1) as result",
      [o.id],
    );
    expect(result.rows[0].result[0].id).toBe(o.id);
    await actor(db, ids.other);
    expect(
      (
        await db.query<{ result: unknown[] }>(
          "select public.order_list(null,$1) as result",
          [o.id],
        )
      ).rows[0].result,
    ).toEqual([]);
  } finally {
    await db.close();
  }
});
