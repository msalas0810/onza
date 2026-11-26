import "server-only";
import { serverDb } from "@/lib/supabase/server";
import { offersLocation, spotSchema, type DeliveryMode, type Spot } from "../types";

/**
 * Lugares de entrega de un local. La base decide qué se ve: el público solo recibe los habilitados; la administración del
 * local recibe también los deshabilitados.
 */
export async function listSpots(venueId: string): Promise<Spot[]> {
  const db = await serverDb();
  const { data, error } = await db
    .from("delivery_spots")
    .select("*")
    .eq("venue_id", venueId)
    .order("position")
    .order("id")
    .limit(300);
  if (error) throw new Error(error.message);
  return data.map((row) => spotSchema.parse(row));
}

/** Un lugar habilitado de este local (para precargarlo desde el QR de una mesa); null si no corresponde. */
export async function findEnabledSpot(venueId: string, spotId: string) {
  const db = await serverDb();
  const { data } = await db
    .from("delivery_spots")
    .select("*")
    .eq("venue_id", venueId)
    .eq("id", spotId)
    .eq("enabled", true)
    .maybeSingle();
  return data ? spotSchema.parse(data) : null;
}

/**
 * Cómo entrega un local y qué lugares ofrece, para el checkout y el seguimiento. Lectura pública: un local desconocido
 * responde 404 y los lugares deshabilitados nunca llegan al cliente.
 */
export async function getDeliveryOptions(venueId: string) {
  const db = await serverDb();
  const { data: venue, error } = await db
    .from("venues")
    .select("delivery_mode,spot_noun,pickup_label")
    .eq("id", venueId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!venue) throw new Error("RESOURCE_NOT_FOUND");
  const mode = venue.delivery_mode as DeliveryMode;
  const spots = offersLocation(mode)
    ? (await listSpots(venueId)).filter((spot) => spot.enabled)
    : [];
  return { mode, noun: venue.spot_noun, pickupLabel: venue.pickup_label, spots };
}
