"use client";
import Link from "next/link";
import Image from "next/image";
import type { Venue } from "../server/queries";
import { useImageFailure } from "@/lib/use-image-failure";

export type VenueCardData = Pick<
  Venue,
  "slug" | "name" | "zone" | "cover_url" | "logo_url"
> &
  Partial<Pick<Venue, "open_state" | "paused">>;

export function VenueCard({
  venue,
  preview = false,
  eager = false,
  distance = null,
}: {
  venue: VenueCardData;
  distance?: number | null;
  /** Static preview (admin screen, design system): same markup without navigating. */
  preview?: boolean;
  /** Load the cover immediately (cards above the fold, which are the LCP) instead of lazily. */
  eager?: boolean;
}) {
  const closed = venue.open_state === "closed";
  const paused = !closed && venue.paused;
  const coverImage = useImageFailure(venue.cover_url);
  const logoImage = useImageFailure(venue.logo_url);
  const cover = coverImage.usable;
  const logo = logoImage.usable;
  const location = venue.zone.trim();
  const content = (
    <div className="venue-card-cover" data-has-cover={cover ? "true" : "false"}>
      {cover ? (
        <Image
          unoptimized
          fill
          sizes="(min-width: 768px) 480px, 100vw"
          src={cover}
          alt=""
          loading={eager ? "eager" : undefined}
          {...coverImage.props}
        />
      ) : (
        <Image
          unoptimized
          className="venue-card-cover-mark"
          src="/brand/onza-shot-white.svg"
          width={48}
          height={64}
          alt=""
        />
      )}
      <div className="venue-card-fade" aria-hidden="true" />
      {(closed || paused) && (
        <span className="venue-availability">
          {closed ? "Cerrado" : "Pedidos pausados"}
        </span>
      )}
      <div className="venue-card-body">
        <span
          className="venue-card-logo"
          data-has-logo={logo ? "true" : "false"}
        >
          {logo ? (
            <Image
              unoptimized
              fill
              sizes="72px"
              src={logo}
              alt=""
              {...logoImage.props}
            />
          ) : (
            <span aria-hidden="true">
              {venue.name.trim().charAt(0).toLocaleUpperCase("es-CR") || "O"}
            </span>
          )}
        </span>
        <span className="venue-card-info">
          <h2>{venue.name}</h2>
          {location && <span className="venue-card-location">{location}</span>}
          {distance !== null && (
            <span className="venue-card-location">
              Aprox. {distance < 1 ? "menos de 1" : Math.round(distance)} km
            </span>
          )}
          {!closed && (
            <span className="venue-card-cta">
              {paused ? "Ver menú · sin pedidos" : "Ver tragos →"}
            </span>
          )}
        </span>
      </div>
    </div>
  );
  return preview || closed ? (
    <div className={`venue-card ${closed ? "is-closed" : ""}`}>{content}</div>
  ) : (
    <Link className="venue-card" href={`/v/${venue.slug}`}>
      {content}
    </Link>
  );
}
