import type { MapElement, MapLayout, MapZone } from "./types";

/**
 * Matemática pura del plano (sin DOM ni React): coordenadas normalizadas 0..1, vista (zoom + desplazamiento) y reglas de entrega.
 * Las reglas de entrega repiten las de la base (private.map_resolve_point): sirven para guiar al cliente sin esperar al servidor,
 * que sigue siendo quien decide.
 */
export type Point = { x: number; y: number };
export type Size = { w: number; h: number };
/** `tx`/`ty`: posición en pantalla (px del contenedor) de la esquina superior izquierda de la imagen. `scale` 1 = imagen entera visible. */
export type View = { scale: number; tx: number; ty: number };
export type ViewLimits = { min: number; max: number };
export const DEFAULT_LIMITS: ViewLimits = { min: 1, max: 8 };

export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const insideUnit = (p: Point) =>
  Number.isFinite(p.x) &&
  Number.isFinite(p.y) &&
  p.x >= 0 &&
  p.x <= 1 &&
  p.y >= 0 &&
  p.y <= 1;

/** Tamaño de la imagen ajustada («contain») dentro del contenedor, a escala 1. */
export function fitBase(container: Size, image: Size): Size {
  if (container.w <= 0 || container.h <= 0 || image.w <= 0 || image.h <= 0)
    return { w: 0, h: 0 };
  const s = Math.min(container.w / image.w, container.h / image.h);
  return { w: image.w * s, h: image.h * s };
}

export const initialView = (container: Size, base: Size): View => ({
  scale: 1,
  tx: (container.w - base.w) / 2,
  ty: (container.h - base.h) / 2,
});

/** Mantiene la escala dentro de los límites y la imagen dentro del contenedor (centrada si es más chica que él). */
export function clampView(
  view: View,
  container: Size,
  base: Size,
  limits: ViewLimits = DEFAULT_LIMITS,
): View {
  const scale = clamp(view.scale, limits.min, limits.max);
  const w = base.w * scale;
  const h = base.h * scale;
  return {
    scale,
    tx:
      w <= container.w
        ? (container.w - w) / 2
        : clamp(view.tx, container.w - w, 0),
    ty:
      h <= container.h
        ? (container.h - h) / 2
        : clamp(view.ty, container.h - h, 0),
  };
}

export const normToScreen = (view: View, base: Size, p: Point): Point => ({
  x: view.tx + p.x * base.w * view.scale,
  y: view.ty + p.y * base.h * view.scale,
});

/** Posición en pantalla (relativa al contenedor) → coordenada normalizada. Puede salir de 0..1: quien llama decide qué hacer. */
export const screenToNorm = (view: View, base: Size, p: Point): Point => ({
  x: (p.x - view.tx) / (base.w * view.scale),
  y: (p.y - view.ty) / (base.h * view.scale),
});

/** Zoom por un factor manteniendo fijo el punto bajo `anchor` (rueda, doble toque, botones). */
export function zoomAt(
  view: View,
  factor: number,
  anchor: Point,
  container: Size,
  base: Size,
  limits: ViewLimits = DEFAULT_LIMITS,
): View {
  const scale = clamp(view.scale * factor, limits.min, limits.max);
  const ratio = scale / view.scale;
  return clampView(
    {
      scale,
      tx: anchor.x - (anchor.x - view.tx) * ratio,
      ty: anchor.y - (anchor.y - view.ty) * ratio,
    },
    container,
    base,
    limits,
  );
}

export const panBy = (
  view: View,
  dx: number,
  dy: number,
  container: Size,
  base: Size,
  limits?: ViewLimits,
): View =>
  clampView(
    { ...view, tx: view.tx + dx, ty: view.ty + dy },
    container,
    base,
    limits,
  );

/** Centra un punto del plano en el contenedor con la escala pedida («Ver ubicación»). */
export function centerOn(
  point: Point,
  scale: number,
  container: Size,
  base: Size,
  limits: ViewLimits = DEFAULT_LIMITS,
): View {
  const s = clamp(scale, limits.min, limits.max);
  return clampView(
    {
      scale: s,
      tx: container.w / 2 - point.x * base.w * s,
      ty: container.h / 2 - point.y * base.h * s,
    },
    container,
    base,
    limits,
  );
}

/**
 * Pellizco con dos dedos: la escala sigue la razón de distancias y el punto del plano que estaba bajo el centro de los dedos
 * al empezar queda bajo el centro actual (así el gesto también desplaza).
 */
export function pinchView(
  start: View,
  startA: Point,
  startB: Point,
  nowA: Point,
  nowB: Point,
  container: Size,
  base: Size,
  limits: ViewLimits = DEFAULT_LIMITS,
): View {
  const d0 = Math.hypot(startA.x - startB.x, startA.y - startB.y);
  const d1 = Math.hypot(nowA.x - nowB.x, nowA.y - nowB.y);
  if (d0 < 1) return start;
  const scale = clamp(start.scale * (d1 / d0), limits.min, limits.max);
  const m0 = { x: (startA.x + startB.x) / 2, y: (startA.y + startB.y) / 2 };
  const m1 = { x: (nowA.x + nowB.x) / 2, y: (nowA.y + nowB.y) / 2 };
  const anchor = screenToNorm(start, base, m0);
  return clampView(
    {
      scale,
      tx: m1.x - anchor.x * base.w * scale,
      ty: m1.y - anchor.y * base.h * scale,
    },
    container,
    base,
    limits,
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Zonas y entrega
// ---------------------------------------------------------------------------------------------------------------------

/** Trazado por rayos. Igual que private.point_in_polygon. */
export function pointInPolygon(p: Point, polygon: readonly Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}

export const zonesAt = (layout: MapLayout, p: Point): MapZone[] =>
  layout.zones.filter((z) => pointInPolygon(p, z.points));

/** Centro aproximado de una zona (para colocar su nombre). */
export const zoneCenter = (z: { points: readonly Point[] }): Point => ({
  x: z.points.reduce((n, p) => n + p.x, 0) / z.points.length,
  y: z.points.reduce((n, p) => n + p.y, 0) / z.points.length,
});

export type DeliveryRejection = "out_of_map" | "restricted" | "unknown_table";
export type Resolved = {
  point: Point;
  zone: MapZone | null;
  /** Elemento del plano más cercano al punto (cualquier tipo). */
  reference: MapElement | null;
  table: MapElement | null;
};
export type ResolveResult =
  ({ ok: true } & Resolved) | { ok: false; reason: DeliveryRejection };

export type SelectionInput =
  | { method: "location_on_map"; x: number; y: number }
  | { method: "table" | "table_qr"; tableId: string };

/** Distancia en píxeles de la imagen, para no sesgarla por la proporción del plano. */
const pixelDistance = (a: Point, b: Point, image: Size) =>
  Math.hypot((a.x - b.x) * image.w, (a.y - b.y) * image.h);

export function nearestElements(
  layout: MapLayout,
  image: Size,
  p: Point,
  count = 3,
  types?: readonly MapElement["type"][],
) {
  return layout.elements
    .filter((e) => !types || types.includes(e.type))
    .map((element) => ({ element, distance: pixelDistance(element, p, image) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count);
}

/** Misma decisión que la base: dentro del plano, fuera de zonas restringidas y, si hay zonas «allow», dentro de alguna. */
export function resolveSelection(
  layout: MapLayout,
  image: Size,
  input: SelectionInput,
): ResolveResult {
  let point: Point;
  let table: MapElement | null = null;
  if (input.method === "location_on_map") {
    point = { x: input.x, y: input.y };
    if (!insideUnit(point)) return { ok: false, reason: "out_of_map" };
  } else {
    table =
      layout.elements.find(
        (e) => e.id === input.tableId && e.type === "table",
      ) ?? null;
    if (!table) return { ok: false, reason: "unknown_table" };
    point = { x: table.x, y: table.y };
  }
  const inside = zonesAt(layout, point);
  if (inside.some((z) => z.delivery === "restrict"))
    return { ok: false, reason: "restricted" };
  if (
    layout.zones.some((z) => z.delivery === "allow") &&
    !inside.some((z) => z.delivery === "allow")
  )
    return { ok: false, reason: "restricted" };
  const zone = inside.find((z) => z.kind === "vip") ?? inside[0] ?? null;
  const reference =
    nearestElements(layout, image, point, 1)[0]?.element ?? null;
  return { ok: true, point, zone, reference, table };
}

export const rejectionMessage: Record<DeliveryRejection, string> = {
  out_of_map: "Ese punto está fuera del plano. Tocá dentro del plano.",
  restricted: "En esa zona no hacemos entregas. Elegí otro punto.",
  unknown_table: "Esa mesa ya no existe en el plano.",
};

/** Cercanía en palabras (no inventamos metros: el plano no tiene escala). Proporción de la diagonal de la imagen. */
export function proximityWord(distance: number, image: Size) {
  const ratio = distance / Math.hypot(image.w, image.h);
  return ratio < 0.04
    ? "muy cerca"
    : ratio < 0.12
      ? "cerca"
      : "a media distancia";
}

/** Mueve un punto en pasos normalizados (teclado), sin salir del plano. */
export const nudge = (p: Point, dx: number, dy: number): Point => ({
  x: clamp01(p.x + dx),
  y: clamp01(p.y + dy),
});

/** Redondea para guardar sin arrastrar ruido de coma flotante (≈ 0,001 % del plano). */
export const roundCoord = (v: number) =>
  Math.round(clamp01(v) * 100000) / 100000;
