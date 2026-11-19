import "server-only";
import { rangeSummarySchema, summarySchema } from "../types";
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
/** Resumen por período (migración 016). Devuelve null si la base todavía no tiene la función. */
export async function getVenueSummaryRange(
  venueId: string,
  from: string,
  to: string,
) {
  const { db } = await requireVenue(venueId, true);
  const { data, error } = await db.rpc("venue_summary_range", {
    venue: venueId,
    from_day: from,
    to_day: to,
  });
  if (error) {
    if (/venue_summary_range|function .* does not exist|PGRST202/i.test(error.message + (error.code ?? "")))
      return null;
    throw new Error(error.message);
  }
  return rangeSummarySchema.parse(data);
}
