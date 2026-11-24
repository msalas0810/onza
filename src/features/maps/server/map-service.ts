import "server-only";
import { z } from "zod";
import type { Json } from "@/lib/supabase/database.generated";
import { serverDb } from "@/lib/supabase/server";
import { passwordChangePending } from "@/lib/supabase/guards";
import { enrichOrder } from "@/features/orders/server/order-service";
import { mapCommandSchema } from "../command-schema";
import { clearLocation, mapRead, mapRpc, setLocation } from "./location-rpc";

async function sessionDb() {
  const db = await serverDb();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (
    error &&
    ((error.status && error.status >= 500) ||
      error.name === "AuthRetryableFetchError")
  )
    throw new Error("CONNECTION_ERROR");
  if (error || !user) throw new Error("SESSION_REQUIRED");
  return db;
}

/** Un «no autorizado» de una cuenta del equipo con contraseña temporal pendiente se informa como tal. */
async function explain(db: Awaited<ReturnType<typeof serverDb>>, e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  if (message.includes("NOT_AUTHORIZED") && (await passwordChangePending(db)))
    return new Error("PASSWORD_CHANGE_REQUIRED");
  return e instanceof Error ? e : new Error(message);
}

const adminActions: Record<string, string> = {
  map_create: "map_create",
  map_update_meta: "map_update_meta",
  map_save_draft: "map_save_draft",
  map_publish: "map_publish",
  map_archive: "map_archive",
  map_duplicate: "map_duplicate",
  map_assign_staff: "map_assign_staff",
};

/** Administración de mapas y ubicación del pedido. Todo se valida en la base con el JWT de quien llama. */
export async function executeMapCommand(raw: unknown) {
  const command = mapCommandSchema.parse(raw);
  const db = await sessionDb();
  try {
    if (command.action === "order_location_clear")
      return await enrichOrder(await clearLocation(db, command.orderId));
    if (command.action === "order_location_set")
      return await enrichOrder(
        await setLocation(
          db,
          command.orderId,
          command.method === "location_on_map"
            ? {
                method: command.method,
                mapId: command.mapId,
                x: command.x ?? 0,
                y: command.y ?? 0,
              }
            : {
                method: command.method,
                mapId: command.mapId,
                tableId: command.tableId ?? "",
              },
        ),
      );
    const { action, ...input } = command;
    return await mapRpc(db, adminActions[action], input as Json);
  } catch (e) {
    throw await explain(db, e);
  }
}

const readSchema = z.object({
  venue: z.string().uuid().optional(),
  map: z.string().uuid().optional(),
  version: z.coerce.number().int().positive().optional(),
  scope: z.enum(["admin", "public"]).optional(),
  detail: z.enum(["1"]).optional(),
});

/** Lecturas: mapas de un local (administración o clientes), borrador completo, o una versión concreta de un mapa. */
export async function readMaps(params: Record<string, string | undefined>) {
  const q = readSchema.parse(params);
  const db = await sessionDb();
  try {
    if (q.map && q.version)
      return await mapRead(db, "map_version_get", {
        map: q.map,
        ver: q.version,
      });
    if (q.map && q.detail)
      return await mapRead(db, "map_admin_get", { map: q.map });
    if (q.venue && q.scope === "admin")
      return await mapRead(db, "map_admin_list", { venue: q.venue });
    if (q.venue) return await mapRead(db, "map_for_venue", { venue: q.venue });
  } catch (e) {
    throw await explain(db, e);
  }
  throw new Error("INVALID_INPUT");
}
