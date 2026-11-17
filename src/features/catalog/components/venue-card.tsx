"use client";
import Link from "next/link";
import type { Venue } from "../server/queries";
import { StatusBadge } from "@/components/ui/primitives";
import { VenueCover, VenueMark, useCover } from "./venue-parts";

export type VenueCardData = Pick<
  Venue,
  "slug" | "name" | "zone" | "cover_url" | "logo_url"
> &
  Partial<Pick<Venue, "open_state" | "paused" | "hours" | "pickup_label">>;

/** Distancia aproximada y honesta: se redondea a 50 m y nunca se muestra sin ubicación fiable. */
export function formatDistance(km: number) {
  if (km < 1) return `Aprox. ${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  return `Aprox. ${km.toFixed(1).replace(".", ",")} km`;
}
export function venueStatus(venue: VenueCardData) {
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

export function VenueCard({
  venue,
  preview = false,
  eager = false,
  featured = false,
  distance = null,
}: {
  venue: VenueCardData;
  distance?: number | null;
  /** Vista estática (administración, sistema de diseño): mismo marcado sin navegar. */
  preview?: boolean;
  /** Cargar la portada de inmediato (tarjetas sobre el pliegue) en vez de diferida. */
  eager?: boolean;
  /** El local abierto más cercano: portada algo más alta. */
  featured?: boolean;
}) {
  const status = venueStatus(venue);
  const cover = useCover(venue.cover_url);
  const meta = [
    venue.zone.trim(),
    distance !== null ? formatDistance(distance) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const className = [
    "vcard",
    cover.usable ? "" : "compact",
    featured && cover.usable ? "featured" : "",
    status.closed ? "closed" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const text = (
    <div className="grow">
      <div className="row between">
        <h3 className="name">{venue.name}</h3>
        {status.badge}
      </div>
      {meta && <div className="meta">{meta}</div>}
      {status.detail && <div className="meta">{status.detail}</div>}
    </div>
  );
  const content = cover.usable ? (
    <>
      <VenueCover src={cover.usable} state={cover} eager={eager} />
      <div className="body">
        <VenueMark venue={venue} />
        {text}
      </div>
    </>
  ) : (
    <>
      <VenueMark venue={venue} large />
      {text}
    </>
  );
  return preview || status.closed ? (
    <div className={className}>{content}</div>
  ) : (
    <Link className={className} href={`/v/${venue.slug}`}>
      {content}
    </Link>
  );
}

/** Fila compacta para locales cerrados: estado evidente y sin acción. */
export function VenueRow({
  venue,
  distance = null,
}: {
  venue: VenueCardData;
  distance?: number | null;
}) {
  const status = venueStatus(venue);
  const meta = [
    venue.zone.trim(),
    distance !== null ? formatDistance(distance) : "",
    status.detail,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className={`vrow ${status.closed ? "closed" : ""}`}>
      <VenueMark venue={venue} />
      <div className="grow">
        <h3>{venue.name}</h3>
        <div className="muted t-label">{meta}</div>
      </div>
      {status.badge}
    </div>
  );
}
