import "server-only";
import { summarySchema } from "../types";
import { requireVenue } from "@/lib/supabase/guards";
export async function getVenueSummary(venueId: string, day: string) {
  const { db } = await requireVenue(venueId, true);
  const { data, error } = await db.rpc("venue_summary", {
    venue: venueId,
    day,
  });
  if (error) throw new Error(error.message);
  return summarySchema.parse(data);
}
