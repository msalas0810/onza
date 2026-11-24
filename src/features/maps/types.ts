import { z } from "zod";

/**
 * Mapa interactivo de ubicación y entrega. Todas las posiciones son coordenadas NORMALIZADAS (0..1) sobre la imagen del plano,
 * con origen arriba a la izquierda: no dependen del tamaño de pantalla ni de la resolución de la imagen.
 */
export const ELEMENT_TYPES = [
  "table",
  "bar",
  "entrance",
  "stage",
  "poi",
  "delivery_point",
] as const;
export type ElementType = (typeof ELEMENT_TYPES)[number];
export const elementTypeLabels: Record<ElementType, string> = {
  table: "Mesa",
  bar: "Barra",
  entrance: "Entrada",
  stage: "Escenario",
  poi: "Punto de referencia",
  delivery_point: "Punto de entrega",
};
export const ZONE_KINDS = ["general", "vip"] as const;
export const zoneKindLabels = {
  general: "Zona general",
  vip: "Zona VIP",
} as const;
/** default: solo informativa · allow: la entrega solo se acepta en zonas "allow" · restrict: no se entrega aquí. */
export const ZONE_DELIVERY = ["default", "allow", "restrict"] as const;
export type ZoneDelivery = (typeof ZONE_DELIVERY)[number];
export const zoneDeliveryLabels: Record<ZoneDelivery, string> = {
  default: "Entrega normal",
  allow: "Entrega solo en esta zona",
  restrict: "Sin entrega",
};

const id = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/);
const unit = z.number().min(0).max(1);
export const layoutElementSchema = z
  .object({
    id,
    type: z.enum(ELEMENT_TYPES),
    label: z.string().trim().min(1).max(60),
    x: unit,
    y: unit,
  })
  .strict();
export const layoutZoneSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(60),
    kind: z.enum(ZONE_KINDS),
    delivery: z.enum(ZONE_DELIVERY),
    points: z
      .array(z.object({ x: unit, y: unit }).strict())
      .min(3)
      .max(40),
  })
  .strict();
export const mapLayoutSchema = z
  .object({
    elements: z.array(layoutElementSchema).max(300),
    zones: z.array(layoutZoneSchema).max(60),
  })
  .strict()
  .refine(
    (l) =>
      new Set(l.elements.map((e) => e.id)).size === l.elements.length &&
      new Set(l.zones.map((z) => z.id)).size === l.zones.length,
    "Los identificadores del plano deben ser únicos.",
  );
export type MapElement = z.infer<typeof layoutElementSchema>;
export type MapZone = z.infer<typeof layoutZoneSchema>;
export type MapLayout = z.infer<typeof mapLayoutSchema>;
export const emptyLayout = (): MapLayout => ({ elements: [], zones: [] });

/** Una versión publicada tal como la ve un cliente o el equipo. */
export const publishedMapSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["permanent", "edition"]),
  event_name: z.string().nullable().optional(),
  site_label: z.string().nullable().optional(),
  version: z.number().int(),
  image_path: z.string(),
  image_width: z.number().int(),
  image_height: z.number().int(),
  layout: mapLayoutSchema,
});
export type PublishedMap = z.infer<typeof publishedMapSchema>;
export const publishedMapsSchema = z.array(publishedMapSchema);

export const mapVersionSchema = publishedMapSchema.extend({
  venue_id: z.string(),
  published_at: z.string().optional(),
});
export type MapVersion = z.infer<typeof mapVersionSchema>;

export const mapSummarySchema = z.object({
  id: z.string(),
  venue_id: z.string(),
  name: z.string(),
  kind: z.enum(["permanent", "edition"]),
  event_name: z.string().nullable(),
  site_label: z.string().nullable(),
  event_date: z.string().nullable(),
  status: z.enum(["draft", "published", "archived"]),
  published_version: z.number().nullable(),
  draft_revision: z.number(),
  image_path: z.string().nullable(),
  image_width: z.number().nullable(),
  image_height: z.number().nullable(),
  elements: z.number(),
  zones: z.number(),
  has_unpublished_changes: z.boolean(),
  available_now: z.boolean(),
  versions: z.array(
    z.object({
      version: z.number(),
      published_at: z.string(),
      image_path: z.string(),
    }),
  ),
  updated_at: z.string(),
});
export type MapSummary = z.infer<typeof mapSummarySchema>;
export const mapSummariesSchema = z.array(mapSummarySchema);

export const mapDetailSchema = mapSummarySchema.extend({
  layout: mapLayoutSchema,
  zone_staff: z.record(
    z.string(),
    z.array(z.object({ user_id: z.string(), name: z.string() })),
  ),
  team: z.array(
    z.object({ user_id: z.string(), name: z.string(), role: z.string() }),
  ),
});
export type MapDetail = z.infer<typeof mapDetailSchema>;

export const DELIVERY_METHODS = [
  "location_on_map",
  "table",
  "table_qr",
] as const;
/** Ubicación de un pedido (como la devuelve la vista del pedido). */
export const orderLocationSchema = z.object({
  order_id: z.string(),
  map_id: z.string(),
  map_version: z.number().int(),
  map_name: z.string(),
  location: z.object({ x: z.number(), y: z.number() }),
  zone_id: z.string().nullable(),
  zone_name: z.string().nullable(),
  delivery_method: z.enum(DELIVERY_METHODS),
  element_id: z.string().nullable(),
  element_label: z.string().nullable(),
  reference_id: z.string().nullable(),
  reference_label: z.string().nullable(),
  updated_at: z.string(),
  /** Solo el equipo del local recibe nombres; para el cliente llega vacío. */
  assigned_staff: z.array(z.string()).default([]),
});
export type OrderLocation = z.infer<typeof orderLocationSchema>;

/** Lo que el cliente elige en el selector y se envía al servidor (que lo valida otra vez). */
export const locationSelectionSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("location_on_map"),
    mapId: z.string().uuid(),
    x: unit,
    y: unit,
  }),
  z.object({
    method: z.enum(["table", "table_qr"]),
    mapId: z.string().uuid(),
    tableId: id,
  }),
]);
export type LocationSelection = z.infer<typeof locationSelectionSchema>;

/** Etiqueta corta para el equipo y el cliente: «Mesa 12 · Zona VIP», «Marcado cerca de Barra principal»… */
export function describeLocation(l: OrderLocation) {
  const where =
    l.delivery_method === "location_on_map"
      ? l.reference_label
        ? `Marcado cerca de ${l.reference_label}`
        : "Ubicación marcada en el plano"
      : (l.element_label ?? "Mesa");
  return l.zone_name ? `${where} · ${l.zone_name}` : where;
}
