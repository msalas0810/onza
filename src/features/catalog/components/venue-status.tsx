import type { Venue } from "../server/queries";
import { StatusBadge } from "@/components/ui/primitives";

export type VenueStatusInput = Partial<
  Pick<Venue, "open_state" | "paused" | "hours">
>;

/** Distancia aproximada y honesta: se redondea a 50 m y nunca se muestra sin ubicación fiable. */
export function formatDistance(km: number) {
  if (km < 1)
    return `Aprox. ${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  return `Aprox. ${km.toFixed(1).replace(".", ",")} km`;
}
export function venueStatus(venue: VenueStatusInput) {
  const closed = venue.open_state === "closed";
  const paused = !closed && !!venue.paused;
  const hours =
    venue.hours && venue.hours !== "Consultar al local" ? venue.hours : "";
  return {
    closed,
    paused,
    badge: closed ? (
      <StatusBadge>Cerrado</StatusBadge>
    ) : paused ? (
      <StatusBadge tone="warning">Pausado</StatusBadge>
    ) : (
      <StatusBadge tone="success">Abierto</StatusBadge>
    ),
    detail: closed
      ? hours || "Cerrado por ahora"
      : paused
        ? "No recibe pedidos por ahora"
        : hours,
  };
}
