import "server-only";
import { serverDb } from "./server";
export async function requireVenue(venueId: string, adminOnly = false) {
  const db = await serverDb();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user || user.is_anonymous) throw new Error("NOT_AUTHORIZED");
  const { data, error: permissionError } = await db.rpc("has_venue_access", {
    venue: venueId,
    admin_only: adminOnly,
  });
  if (permissionError || !data) throw new Error("NOT_AUTHORIZED");
  return { db, user };
}
