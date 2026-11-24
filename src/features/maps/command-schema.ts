import { z } from "zod";
import { mapLayoutSchema } from "./types";

const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().max(max);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Comandos de mapas y de ubicación del pedido. El servidor vuelve a validar todo en la base (nada de esto se da por bueno). */
export const mapCommandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("map_create"),
    venueId: uuid,
    name: text(100).min(1),
    kind: z.enum(["permanent", "edition"]).default("permanent"),
    eventName: text(100).optional(),
    siteLabel: text(100).optional(),
    eventDate: date.optional(),
  }),
  z.object({
    action: z.literal("map_update_meta"),
    mapId: uuid,
    name: text(100).min(1).optional(),
    eventName: text(100).optional(),
    siteLabel: text(100).optional(),
    eventDate: date.nullable().optional(),
  }),
  z.object({
    action: z.literal("map_save_draft"),
    mapId: uuid,
    expectedRevision: z.number().int().positive(),
    imagePath: z.string().max(200).optional(),
    imageWidth: z.number().int().min(64).max(8000).optional(),
    imageHeight: z.number().int().min(64).max(8000).optional(),
    layout: mapLayoutSchema.optional(),
  }),
  z.object({
    action: z.literal("map_publish"),
    mapId: uuid,
    expectedRevision: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("map_archive"),
    mapId: uuid,
    archived: z.boolean(),
  }),
  z.object({
    action: z.literal("map_duplicate"),
    mapId: uuid,
    name: text(100).min(1).optional(),
    kind: z.enum(["permanent", "edition"]).optional(),
    eventName: text(100).optional(),
    siteLabel: text(100).optional(),
    eventDate: date.nullable().optional(),
  }),
  z.object({
    action: z.literal("map_assign_staff"),
    mapId: uuid,
    zoneId: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
    userIds: z.array(uuid).max(50),
  }),
  z.object({
    action: z.literal("order_location_clear"),
    orderId: uuid,
  }),
  z
    .object({
      action: z.literal("order_location_set"),
      orderId: uuid,
      method: z.enum(["location_on_map", "table", "table_qr"]),
      mapId: uuid,
      x: z.number().min(0).max(1).optional(),
      y: z.number().min(0).max(1).optional(),
      tableId: z
        .string()
        .regex(/^[A-Za-z0-9_-]{1,40}$/)
        .optional(),
    })
    .refine((c) =>
      c.method === "location_on_map"
        ? c.x !== undefined && c.y !== undefined
        : c.tableId !== undefined,
    ),
]);
export type MapCommand = z.infer<typeof mapCommandSchema>;
