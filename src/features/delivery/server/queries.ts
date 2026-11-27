import "server-only";
import { serverDb } from "@/lib/supabase/server";
import { mapSchema, offersLocation, spotSchema, type DeliveryMode, type Spot, type VenueMap } from "../types";

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
  const location = offersLocation(mode);
  const spots = location ? (await listSpots(venueId)).filter((spot) => spot.enabled) : [];
  const map = location ? await getVenueMap(venueId) : null;
  return { mode, noun: venue.spot_noun, pickupLabel: venue.pickup_label, spots, map };
}

/** El mapa vigente de un local (lectura pública), o null si no tiene. La base solo muestra el publicado al público. */
export async function getVenueMap(venueId: string): Promise<VenueMap | null> {
  const db = await serverDb();
  const { data, error } = await db
    .from("venue_maps")
    .select("id,image_url,width,height,service_area")
    .eq("venue_id", venueId)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapSchema.parse({
    id: data.id,
    imageUrl: data.image_url,
    width: data.width,
    height: data.height,
    serviceArea: data.service_area,
  });
}
