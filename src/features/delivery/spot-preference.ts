/**
 * Lugar elegido por el cliente en un local (por el QR de una mesa o a mano). Vive en este dispositivo ocho horas: una mesa de
 * ayer no debe aparecer hoy. Es solo una comodidad; el servidor valida el lugar al pedir.
 */
const key = "onza-spot-preference";
const TTL_MS = 8 * 60 * 60 * 1000;
type Preference = { venueId: string; spotId: string; at: number };

export function readSpotPreference(venueId: string, now = Date.now()) {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (
      !value ||
      typeof value !== "object" ||
      (value as Preference).venueId !== venueId ||
      typeof (value as Preference).spotId !== "string" ||
      typeof (value as Preference).at !== "number" ||
      now - (value as Preference).at > TTL_MS
    )
      return null;
    return (value as Preference).spotId;
  } catch {
    return null;
  }
}

export function writeSpotPreference(venueId: string, spotId: string | null) {
  try {
    if (spotId === null) localStorage.removeItem(key);
    else
      localStorage.setItem(
        key,
        JSON.stringify({ venueId, spotId, at: Date.now() } satisfies Preference),
      );
    window.dispatchEvent(new Event("onza-spot-change"));
  } catch {
    /* Sin almacenamiento local no se recuerda el lugar; se vuelve a elegir al pedir. */
  }
}
