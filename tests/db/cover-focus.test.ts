import { expect, it } from "vitest";
import { actor, database, ids } from "./helpers";
it("punto focal de portada: solo el admin del local, dentro de 0–100", async () => {
  const db = await database();
  try {
    const focus = (x: number, y: number, venue = ids.venue) =>
      db.query<{ r: Record<string, number> }>("select public.update_venue_cover_focus($1,$2,$3) as r", [venue, x, y]);
    await actor(db, ids.admin, "admin", false);
    expect((await focus(30, 70)).rows[0].r).toEqual({ coverFocusX: 30, coverFocusY: 70 });
    await expect(focus(101, 50)).rejects.toThrow("INVALID_BRANDING");
    await expect(focus(50, 50, ids.patio)).rejects.toThrow("NOT_AUTHORIZED");
    await actor(db, ids.staff, "bar", false);
    await expect(focus(10, 10)).rejects.toThrow("NOT_AUTHORIZED");
    await actor(db);
    const { rows } = await db.query<{ cover_focus_x: number; cover_focus_y: number }>(
      "select cover_focus_x,cover_focus_y from public.venues where id=$1",
      [ids.venue],
    );
    expect(rows[0]).toEqual({ cover_focus_x: 30, cover_focus_y: 70 });
  } finally {
    await db.close();
  }
});
