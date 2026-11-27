// Geometría del mapa de entrega. Todo en coordenadas RELATIVAS a la imagen (0 a 1 en cada eje), así el pin cae en el mismo
// lugar en el teléfono del cliente y en la pantalla de la barra. La base aplica las mismas reglas
// (private.resolve_place en la migración 026): una prueba compara ambas, y el servidor siempre decide.

export type Pt = [number, number];
export type CircleShape = { kind: "circle"; x: number; y: number; r: number };
export type PolygonShape = { kind: "polygon"; points: Pt[] };
export type Shape = CircleShape | PolygonShape;
export type ServicePolygon = { points: Pt[] };
export type MapSize = { width: number; height: number };
/** Lo mínimo que hace falta de un lugar para nombrar un punto. */
export type ShapedSpot = {
  id: string;
  label: string;
  area: string;
  position: number;
  enabled: boolean;
  shape?: Shape | null;
};
export type Place = {
  spotId: string | null;
  label: string | null;
  area: string;
};

export const MAP_POINT_LABEL = "Punto en el mapa";
export const CIRCLE_MIN_R = 0.005;
export const CIRCLE_MAX_R = 0.2;
export const DEFAULT_TABLE_R = 0.025;

/** Regla par-impar con rayo horizontal: la misma que la base. */
export function pointInPoints(points: readonly Pt[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

/** Sin área de servicio vale toda la imagen. */
export function inServiceArea(
  area: readonly ServicePolygon[],
  x: number,
  y: number,
) {
  if (x < 0 || x > 1 || y < 0 || y > 1) return false;
  return area.length === 0 || area.some((p) => pointInPoints(p.points, x, y));
}

/** El círculo es redondo en la imagen, no en el cuadrado 0..1: el eje vertical se corrige por la proporción. */
export function shapeContains(
  shape: Shape,
  size: MapSize,
  x: number,
  y: number,
) {
  if (shape.kind === "polygon") return pointInPoints(shape.points, x, y);
  const dx = x - shape.x;
  const dy = ((y - shape.y) * size.height) / size.width;
  return dx * dx + dy * dy <= shape.r * shape.r;
}

export function polygonSize(points: readonly Pt[]) {
  let total = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++)
    total += (points[j][0] + points[i][0]) * (points[j][1] - points[i][1]);
  return Math.abs(total) / 2;
}

/**
 * Qué lugar nombra un punto. Con `hint` (el QR de una mesa) vale ese lugar si contiene el punto; null si no.
 * Sin `hint`: la ÚNICA mesa que contiene el punto; si hay dos superpuestas no se adivina ninguna. Si no hay mesa, la zona más
 * chica que lo contiene. Entre mesas y fuera de zonas: sin nombre (solo el punto).
 */
export function resolvePlace(
  spots: readonly ShapedSpot[],
  size: MapSize,
  x: number,
  y: number,
  hint?: string | null,
): Place | null {
  const live = spots.filter((s) => s.enabled && s.shape);
  if (hint) {
    const spot = live.find((s) => s.id === hint);
    return spot && shapeContains(spot.shape as Shape, size, x, y)
      ? { spotId: spot.id, label: spot.label, area: spot.area }
      : null;
  }
  const tables = live.filter(
    (s) => s.shape?.kind === "circle" && shapeContains(s.shape, size, x, y),
  );
  const zone = live
    .filter(
      (s) => s.shape?.kind === "polygon" && shapeContains(s.shape, size, x, y),
    )
    .sort(
      (a, b) =>
        polygonSize((a.shape as PolygonShape).points) -
          polygonSize((b.shape as PolygonShape).points) ||
        a.position - b.position ||
        a.id.localeCompare(b.id),
    )[0];
  if (tables.length === 1)
    return {
      spotId: tables[0].id,
      label: tables[0].label,
      area: tables[0].area || zone?.label || "",
    };
  if (zone) return { spotId: zone.id, label: zone.label, area: zone.area };
  return { spotId: null, label: null, area: "" };
}

/** Un punto dentro de la forma, para precargar el pin cuando el cliente entra por el QR de una mesa o zona. */
export function anchorOf(
  shape: Shape,
  size: MapSize,
): { x: number; y: number } {
  if (shape.kind === "circle") return { x: shape.x, y: shape.y };
  const pts = shape.points;
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const f = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    a += f;
    cx += (pts[j][0] + pts[i][0]) * f;
    cy += (pts[j][1] + pts[i][1]) * f;
  }
  if (a !== 0) {
    const c = { x: cx / (3 * a), y: cy / (3 * a) };
    if (pointInPoints(pts, c.x, c.y)) return c;
  }
  // Forma cóncava: el primer punto de una grilla fina que caiga dentro.
  for (let gy = 0.02; gy < 1; gy += 0.02)
    for (let gx = 0.02; gx < 1; gx += 0.02)
      if (shapeContains(shape, size, gx, gy)) return { x: gx, y: gy };
  return { x: pts[0][0], y: pts[0][1] };
}

/** «Mesa 7» → «7» para la etiqueta chica sobre el plano; los demás nombres se acortan a 10 letras. */
export function shortLabel(label: string) {
  const n = /(\d+)\s*$/.exec(label.trim());
  if (n && n[1].length <= 3) return n[1];
  return label.length > 10 ? `${label.slice(0, 9)}…` : label;
}

export const roundPoint = (v: number) => Math.round(v * 1e6) / 1e6;

/**
 * Qué lugar toca el administrador en el editor (habilitado o no): la mesa cuyo centro está más cerca entre las que contienen el
 * punto; si no, la zona más chica. Solo para seleccionar, nunca para nombrar un pedido.
 */
export function hitSpot<T extends ShapedSpot>(
  spots: readonly T[],
  size: MapSize,
  x: number,
  y: number,
): T | null {
  const hit = spots.filter(
    (s) => s.shape && shapeContains(s.shape, size, x, y),
  );
  const circles = hit
    .filter((s) => s.shape?.kind === "circle")
    .sort(
      (a, b) =>
        dist(a.shape as CircleShape, size, x, y) -
        dist(b.shape as CircleShape, size, x, y),
    );
  if (circles[0]) return circles[0];
  return (
    hit
      .filter((s) => s.shape?.kind === "polygon")
      .sort(
        (a, b) =>
          polygonSize((a.shape as PolygonShape).points) -
          polygonSize((b.shape as PolygonShape).points),
      )[0] ?? null
  );
}
const dist = (c: CircleShape, size: MapSize, x: number, y: number) =>
  Math.hypot(x - c.x, ((y - c.y) * size.height) / size.width);
