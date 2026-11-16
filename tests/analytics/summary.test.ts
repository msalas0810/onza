import { it, expect } from "vitest";
import { database, actor, command, createInput, ids } from "../db/helpers";
it("corte 06:00 Costa Rica, medianoche, reservas/cobros/devoluciones separados", async () => {
  const db = await database();
  try {
    const dates = await db.query<{ day: string }>(
      `select public.business_date_at('2026-11-16T07:00:00Z')::text as day union all select public.business_date_at('2026-11-16T12:00:00Z')::text`,
    );
    expect(dates.rows.map((r) => r.day)).toEqual(["2026-11-15", "2026-11-16"]);
    await actor(db);
    const o = await command(db, createInput());
    await actor(db, ids.admin, "admin-a", false);
    const day = o.business_date;
    const summary = () =>
      db.query<{
        result: {
          captured_minor: number;
          reserved_minor: number;
          refunded_minor: number;
        };
      }>("select public.venue_summary($1,$2) as result", [ids.venue, day]);
    expect((await summary()).rows[0].result.reserved_minor).toBe(900000);
    await db.exec("reset role");
    await db.exec(
      `update private.payments set status='captured',captured_minor=900000`,
    );
    await actor(db, ids.admin, "admin-a", false);
    await command(db, {
      action: "refund",
      orderId: o.id,
      reason: "Pedido no entregado",
    });
    const result = (await summary()).rows[0].result;
    expect(result.captured_minor).toBe(900000);
    expect(result.refunded_minor).toBe(900000);
    expect(result.reserved_minor).toBe(0);
    await actor(db);
    await expect(summary()).rejects.toThrow("NOT_AUTHORIZED");
  } finally {
    await db.close();
  }
});
