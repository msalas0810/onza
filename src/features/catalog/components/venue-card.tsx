"use client";
import Image from "next/image";
import Link from "next/link";
import type { Venue } from "../server/queries";
import { VenueMark, useCover } from "./venue-parts";
import { formatDistance, venueStatus } from "./venue-status";

export type VenueCardData = Pick<
  Venue,
  "slug" | "name" | "zone" | "cover_url" | "logo_url"
> &
  Partial<Pick<Venue, "open_state" | "paused" | "hours" | "pickup_label">>;

/**
 * Tarjeta de Explorar: portada fotográfica 16:10 con el logo del local abajo a la izquierda y el barrio abajo a la
 * derecha; nombre, estado («Abierto» verde o «Pausado») y horario debajo del estado. Sin foto utilizable, la portada usa
 * un respaldo sólido con el vasito de Onza: nunca una foto genérica que parezca del local.
 */
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
  /** El local abierto más cercano. */
  featured?: boolean;
}) {
  const status = venueStatus(venue);
  const cover = useCover(venue.cover_url);
  const zone = venue.zone.trim();
  const className = [
    "vcard",
    featured ? "featured" : "",
    status.closed ? "closed" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const content = (
    <>
      <div className="vcard-cover" data-photo={cover.usable ? "true" : "false"}>
        {cover.usable ? (
          <Image
            unoptimized
            fill
            sizes="(min-width: 1024px) 336px, (min-width: 720px) 50vw, 100vw"
            src={cover.usable}
            alt=""
            loading={eager ? "eager" : undefined}
            {...cover.props}
          />
        ) : (
          <span className="vcard-fallback" aria-hidden="true" />
        )}
        <span className="vcard-logo">
          <VenueMark venue={venue} large />
        </span>
        {zone && <span className="vcard-zone">{zone}</span>}
      </div>
      <div className="vcard-body">
        <div className="grow">
          <h3 className="name">{venue.name}</h3>
          {distance !== null && (
            <div className="meta">{formatDistance(distance)}</div>
          )}
        </div>
        <div className="vcard-state">
          {!status.closed && status.badge}
          {status.detail && <span className="meta">{status.detail}</span>}
        </div>
      </div>
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

/** Fila compacta para locales cerrados: atenuada, sin acción y sin badge (el grupo «Cerrados» ya lo dice). */
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
      {!status.closed && status.badge}
    </div>
  );
}
