import { z } from "zod";

/** Cómo entrega un local: solo en la barra (lo de siempre), el cliente elige, o solo en su lugar. */
export type DeliveryMode = "bar" | "both" | "location";

export const spotSchema = z.object({
  id: z.string(),
  venue_id: z.string(),
  label: z.string(),
  area: z.string(),
  position: z.number(),
  enabled: z.boolean(),
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

/** «Mesa 4 · Terraza»: el lugar tal como lo ve quien lo pidió y quien lo lleva. */
export function spotText(order: {
  spot_label?: string | null;
  spot_area?: string | null;
}) {
  if (!order.spot_label) return "";
  return order.spot_area
    ? `${order.spot_label} · ${order.spot_area}`
    : order.spot_label;
}

/** El artículo concuerda con la palabra que eligió el local: «tu mesa», «tu zona», «tu puesto». */
export const yourSpot = (noun: string) => `tu ${noun.trim().toLowerCase()}`;

export const deliveryOptionsSchema = z.object({
  mode: z.enum(["bar", "both", "location"]),
  noun: z.string(),
  pickupLabel: z.string(),
  spots: z.array(spotSchema),
});
export type DeliveryOptions = z.infer<typeof deliveryOptionsSchema>;
