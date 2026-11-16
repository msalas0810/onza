export type Coordinates = { latitude: number; longitude: number };
type LocatedVenue = {
  name: string;
  open_state: string;
  paused: boolean;
  latitude: number | null;
  longitude: number | null;
};
export function distanceKm(a: Coordinates, b: Coordinates) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad,
    dLon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function rankVenues<T extends LocatedVenue>(
  venues: T[],
  location: Coordinates | null,
) {
  const availability = (v: T) =>
    v.open_state !== "open" ? 2 : v.paused ? 1 : 0;
  return venues
    .map((venue) => ({
      venue,
      distance:
        location &&
        venue.latitude !== null &&
        venue.longitude !== null &&
        Number.isFinite(venue.latitude) &&
        Number.isFinite(venue.longitude)
          ? distanceKm(location, {
              latitude: venue.latitude,
              longitude: venue.longitude,
            })
          : null,
    }))
    .sort(
      (a, b) =>
        availability(a.venue) - availability(b.venue) ||
        (a.distance ?? Infinity) - (b.distance ?? Infinity) ||
        a.venue.name.localeCompare(b.venue.name, "es"),
    );
}
