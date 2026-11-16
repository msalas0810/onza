"use client";
import { useState } from "react";
import type { Ref } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Venue } from "../server/queries";

export type VenueCardData = Pick<
  Venue,
  "slug" | "name" | "zone" | "cover_url" | "logo_url"
>;

/**
 * Tracks whether an image failed to load. An error can happen before React hydrates (server-rendered <img>), so besides
 * onError the ref callback checks the already-finished element. A new src starts fresh.
 */
function useImageFailure(src: string | null) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const ref: Ref<HTMLImageElement> = (img) => {
    if (img && src && img.complete && img.naturalWidth === 0) setFailedSrc(src);
  };
  return {
    usable: src && failedSrc !== src ? src : null,
    props: { ref, onError: () => setFailedSrc(src) },
  };
}

/**
 * Venue card: cover photo with a dark fade toward the bottom, square rounded logo on the bottom-left corner of the photo,
 * and to its right the name, optional location and "Ver tragos →". Missing or broken images fall back to a branded
 * placeholder, never to an empty or broken box. Open/closed state is deliberately not shown here.
 */
export function VenueCard({
  venue,
  preview = false,
  eager = false,
}: {
  venue: VenueCardData;
  /** Static preview (admin screen, design system): same markup without navigating. */
  preview?: boolean;
  /** Load the cover immediately (cards above the fold, which are the LCP) instead of lazily. */
  eager?: boolean;
}) {
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
          <span className="venue-card-cta">Ver tragos →</span>
        </span>
      </div>
    </div>
  );
  return preview ? (
    <div className="venue-card">{content}</div>
  ) : (
    <Link className="venue-card" href={`/v/${venue.slug}`}>
      {content}
    </Link>
  );
}
