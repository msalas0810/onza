import { it, expect } from "vitest";
import { database, actor, command, createInput, ids } from "./helpers";
it("guion completo SQL: cliente → barra → QR/código → entrega → ventas", async () => {
  const db = await database();
  try {
    await actor(db);
    const o = await command(db, createInput("full-demo"));
    await actor(db, ids.staff, "bar-device", false);
    await command(db, {
      action: "accept",
      orderId: o.id,
      expectedVersion: 1,
      idempotencyKey: "accept",
    });
    await command(db, {
      action: "ready",
      orderId: o.id,
      expectedVersion: 2,
      idempotencyKey: "ready",
    });
    const claim = await command(db, {
      action: "resolve",
      venueId: ids.venue,
      code: o.public_code,
    });
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
    await actor(db);
    const restored = await command(db, { action: "get", orderId: o.id });
    expect(restored.status).toBe("delivered");
    expect(restored.encrypted_token).toBeNull();
    await actor(db, ids.admin, "admin-device", false);
    const { rows } = await db.query<{
      result: {
        delivered_orders: number;
        captured_minor: number;
        products: { units: number }[];
      };
    }>("select public.venue_summary($1,$2) as result", [
      ids.venue,
      o.business_date,
    ]);
    expect(rows[0].result.delivered_orders).toBe(1);
    expect(rows[0].result.captured_minor).toBe(900000);
    expect(rows[0].result.products[0].units).toBe(2);
  } finally {
    await db.close();
  }
});
it("staff del otro local no lee ni escribe pedidos y el admin no puede crear locales globales", async () => {
  const db = await database();
  try {
    await actor(db);
    const o = await command(db, createInput());
    await db.exec("reset role");
    await db.exec(
      `update public.memberships set venue_id='${ids.patio}' where user_id='${ids.staff}'`,
    );
    await actor(db, ids.staff, "patio-device", false);
    expect((await db.query("select * from public.orders")).rows).toHaveLength(
      0,
    );
    await expect(
      command(db, {
        action: "accept",
        orderId: o.id,
        expectedVersion: 1,
        idempotencyKey: "cross",
      }),
    ).rejects.toThrow("NOT_AUTHORIZED");
    await actor(db, ids.admin, "admin-device", false);
    await expect(
      db.query("select public.platform_command($1::jsonb)", [
        JSON.stringify({
          action: "venue_create",
          name: "No permitido",
          slug: "no-permitido",
        }),
      ]),
    ).rejects.toThrow("NOT_AUTHORIZED");
  } finally {
    await db.close();
  }
});
