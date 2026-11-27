import { z } from "zod";
import { MAP_POINT_LABEL } from "./geometry";

/** Cómo entrega un local: solo en la barra (lo de siempre), el cliente elige, o solo en su lugar. */
export type DeliveryMode = "bar" | "both" | "location";

const pointTuple = z.tuple([z.number(), z.number()]);
export const shapeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("circle"), x: z.number(), y: z.number(), r: z.number() }),
  z.object({ kind: z.literal("polygon"), points: z.array(pointTuple) }),
]);
export const spotSchema = z.object({
  id: z.string(),
  venue_id: z.string(),
  label: z.string(),
  area: z.string(),
  position: z.number(),
  enabled: z.boolean(),
  /** Dónde está el lugar sobre el mapa; nulo si solo existe en la lista. */
  shape: shapeSchema.nullable().optional(),
});
export type Spot = z.infer<typeof spotSchema>;

export const offersLocation = (mode: DeliveryMode | undefined) =>
  mode === "both" || mode === "location";
export const offersBar = (mode: DeliveryMode | undefined) =>
  mode !== "location";

/** Lugares agrupados por zona, en el orden en que el local los cargó. Sin zona van juntos, al principio. */
export function groupSpots(spots: Spot[]) {
  const groups = new Map<string, Spot[]>();
  for (const spot of [...spots].sort(
    (a, b) => a.position - b.position || a.label.localeCompare(b.label, "es", { numeric: true }),
  )) {
    const list = groups.get(spot.area) ?? [];
    list.push(spot);
    groups.set(spot.area, list);
  }
  return [...groups.entries()]
    .map(([area, list]) => ({ area, spots: list }))
    .sort((a, b) => Number(Boolean(a.area)) - Number(Boolean(b.area)));
}

export const MAP_NAME_FALLBACK = MAP_POINT_LABEL;

/** El mapa vigente de un local: imagen, medidas y área de servicio (polígonos 0..1; vacía = toda la imagen). */
export const mapSchema = z.object({
  id: z.string(),
  imageUrl: z.string(),
  width: z.number(),
  height: z.number(),
  serviceArea: z.array(z.object({ points: z.array(pointTuple) })),
});
export type VenueMap = z.infer<typeof mapSchema>;

/** «Mesa 4 · Terraza»: el lugar tal como lo ve quien lo pidió y quien lo lleva. Un punto sin mesa ni zona: «punto en el mapa». */
export function spotText(order: {
  spot_label?: string | null;
  spot_area?: string | null;
}) {
  if (!order.spot_label) return "";
  if (order.spot_label === MAP_POINT_LABEL)
    return order.spot_area ? `${MAP_POINT_LABEL} · ${order.spot_area}` : MAP_POINT_LABEL;
  return order.spot_area
    ? `${order.spot_label} · ${order.spot_area}`
    : order.spot_label;
}

/**
 * La frase con su preposición: «a Mesa 4 · Terraza», «en Mesa 4», o para un pin sin mesa «al punto marcado · Jardín» /
 * «en el punto marcado» (nunca «a Punto en el mapa»).
 */
export function placePhrase(
  order: { spot_label?: string | null; spot_area?: string | null },
  prep: "a" | "en",
) {
  if (order.spot_label !== MAP_POINT_LABEL) return `${prep} ${spotText(order)}`;
  const base = prep === "a" ? "al punto marcado" : "en el punto marcado";
  return order.spot_area ? `${base} · ${order.spot_area}` : base;
}

/** El artículo concuerda con la palabra que eligió el local: «tu mesa», «tu zona», «tu puesto». */
export const yourSpot = (noun: string) => `tu ${noun.trim().toLowerCase()}`;

export const deliveryOptionsSchema = z.object({
  mode: z.enum(["bar", "both", "location"]),
  noun: z.string(),
  pickupLabel: z.string(),
  spots: z.array(spotSchema),
  /** Mapa vigente del local, o null si el cliente elige de la lista. */
  map: mapSchema.nullable().optional(),
});
export type DeliveryOptions = z.infer<typeof deliveryOptionsSchema>;
