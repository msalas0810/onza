import "server-only";
import type { Json } from "@/lib/supabase/database.generated";
import type { serverDb } from "@/lib/supabase/server";
import type { LocationSelection } from "../types";

type Db = Awaited<ReturnType<typeof serverDb>>;

/**
 * Llamadas finas a las funciones de ubicación de la base. La base es quien valida (dentro del plano, zonas, dueño del pedido,
 * estado, mapa del mismo local): aquí solo se traduce el error al código que entiende la pantalla.
 */
async function rpc(db: Db, name: string, input: Json) {
  const { data, error } = await db.rpc(name as never, { input } as never);
  if (error) throw new Error(error.message);
  return data as unknown;
}

const selectionInput = (s: LocationSelection): Record<string, Json> =>
  s.method === "location_on_map"
    ? { method: s.method, mapId: s.mapId, x: s.x, y: s.y }
    : { method: s.method, mapId: s.mapId, tableId: s.tableId };

/** Comprueba la selección contra el plano vigente del local sin guardar nada (previo a crear el pedido). */
export const validateLocation = (
  db: Db,
  venueId: string,
  s: LocationSelection,
) => rpc(db, "order_location_validate", { venueId, ...selectionInput(s) });

export const setLocation = (db: Db, orderId: string, s: LocationSelection) =>
  rpc(db, "order_location_set", { orderId, ...selectionInput(s) });

export const clearLocation = (db: Db, orderId: string) =>
  rpc(db, "order_location_clear", { orderId });

/** Funciones de administración y lectura de mapas (todas reciben un único jsonb `input`, salvo las de lectura). */
export const mapRpc = (db: Db, name: string, input: Json) =>
  rpc(db, name, input);

export async function mapRead(
  db: Db,
  name: string,
  args: Record<string, string | number>,
) {
  const { data, error } = await db.rpc(name as never, args as never);
  if (error) throw new Error(error.message);
  return data as unknown;
}
