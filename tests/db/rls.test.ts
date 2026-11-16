import { it, expect } from "vitest";
import { database, actor, command, createInput, ids } from "./helpers";
it("RLS: cliente A no lee B, invitado no es staff y staff no muta otro local", async () => {
  const db = await database();
  try {
    await actor(db);
    const order = await command(db, createInput());
    await actor(db, ids.other);
    expect((await db.query("select * from public.orders")).rows).toHaveLength(
      0,
    );
    await expect(
      command(db, {
        action: "accept",
        orderId: order.id,
        expectedVersion: 1,
        idempotencyKey: "accept",
      }),
    ).rejects.toThrow("NOT_AUTHORIZED");
    await expect(
      db.query(`update public.orders set total_minor=1`),
    ).rejects.toThrow();
    await actor(db, ids.staff, "staff-device", false);
    await expect(
      command(db, { action: "venue_update", venueId: ids.patio, paused: true }),
    ).rejects.toThrow("NOT_AUTHORIZED");
    await expect(
      db.query(
        `insert into public.memberships values ('${ids.other}','${ids.venue}','admin')`,
      ),
    ).rejects.toThrow();
  } finally {
    await db.close();
  }
});
