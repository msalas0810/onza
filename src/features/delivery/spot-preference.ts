/**
 * Lugar elegido por el cliente en un local: un punto del mapa (con la mesa del QR como pista, si entró por uno) o un lugar de
 * la lista. Vive en este dispositivo ocho horas: un lugar de ayer no debe aparecer hoy, y sobrevive a la recarga y al login.
 * Es solo una comodidad; el servidor valida mapa, punto y lugar al pedir.
 */
const key = "onza-spot-preference";
const TTL_MS = 8 * 60 * 60 * 1000;

export type LocationPref = {
  /** Un lugar de la lista (sin punto en el mapa). */
  spotId?: string;
  /** Un toque en el mapa vigente, relativo a la imagen. */
  point?: { mapId: string; x: number; y: number };
  /** La mesa o zona del QR: la base comprueba que contenga el punto. */
  hint?: string;
};
type Stored = LocationPref & { venueId: string; at: number };

const num = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;

export function readLocationPreference(
  venueId: string,
  now = Date.now(),
): LocationPref | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (!value || typeof value !== "object") return null;
    const v = value as Stored;
    if (
      v.venueId !== venueId ||
      typeof v.at !== "number" ||
      now - v.at > TTL_MS
    )
      return null;
    const pref: LocationPref = {};
    if (typeof v.spotId === "string") pref.spotId = v.spotId;
    if (typeof v.hint === "string") pref.hint = v.hint;
    if (
      v.point &&
      typeof v.point.mapId === "string" &&
      num(v.point.x) &&
      num(v.point.y)
    )
      pref.point = { mapId: v.point.mapId, x: v.point.x, y: v.point.y };
    return pref.spotId || pref.point ? pref : null;
  } catch {
    return null;
  }
}

export function writeLocationPreference(
  venueId: string,
  pref: LocationPref | null,
) {
  try {
    if (pref === null) localStorage.removeItem(key);
    else
      localStorage.setItem(
        key,
        JSON.stringify({ ...pref, venueId, at: Date.now() } satisfies Stored),
      );
    window.dispatchEvent(new Event("onza-spot-change"));
  } catch {
    /* Sin almacenamiento local no se recuerda el lugar; se vuelve a marcar al pedir. */
  }
}

/** Lo que el servidor espera en `delivery` al crear el pedido. */
export function deliveryFrom(pref: LocationPref) {
  if (pref.point)
    return {
      mode: "location" as const,
      point: pref.point,
      ...(pref.hint ? { spotId: pref.hint } : {}),
    };
  return pref.spotId
    ? { mode: "location" as const, spotId: pref.spotId }
    : null;
}
