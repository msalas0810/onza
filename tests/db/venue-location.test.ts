import { expect, it } from "vitest";
import { database, actor, ids } from "./helpers";
it("only venue admin configures real coordinates; invalid/partial input rejects, both null clears", async () => {
  const db = await database();
  try {
    const update = (venueId: string, latitude: unknown, longitude: unknown) =>
      db.query("select public.update_venue_branding($1::jsonb)", [
        JSON.stringify({ venueId, latitude, longitude }),
      ]);
    await actor(db, ids.admin, "admin", false);
    await update(ids.venue, 9.93, -84.08);
    await expect(update(ids.patio, 9.93, -84.08)).rejects.toThrow(
      "NOT_AUTHORIZED",
    );
    for (const pair of [
      [91, 0],
      [0, 181],
      [null, 1],
      [1, null],
      ["9.93", 0],
    ])
      await expect(
        update(ids.venue, ...(pair as [unknown, unknown])),
      ).rejects.toThrow("INVALID_LOCATION");
    await update(ids.venue, null, null);
    await actor(db, ids.staff, "bar", false);
    await expect(update(ids.venue, 9.93, -84.08)).rejects.toThrow(
      "NOT_AUTHORIZED",
    );
    await actor(db);
    await expect(update(ids.venue, 9.93, -84.08)).rejects.toThrow(
      "NOT_AUTHORIZED",
    );
  } finally {
    await db.close();
  }
});
