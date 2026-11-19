"use client";
import type { Venue } from "../server/queries";
import { venueStatus } from "./venue-status";
import { VenueCover, VenueMark, useCover } from "./venue-parts";

/** Cabecera del local: foto (si hay), identidad, datos de retiro y nota de demo. */
export function VenueHero({ venue }: { venue: Venue }) {
  const cover = useCover(venue.cover_url);
  const status = venueStatus(venue);
  return (
    <header className="vhero">
      {cover.usable && (
        <VenueCover
          src={cover.usable}
          state={cover}
          ratio="ratio-3x2"
          eager
          sizes="(min-width: 640px) 640px, 100vw"
        />
      )}
      <div className="id">
        <VenueMark venue={venue} large />
        <div className="grow">
          <h1 className="t-title">{venue.name}</h1>
          <div className="facts">
            <span>{venue.zone}</span>
            <span>Retiro: {venue.pickup_label}</span>
            {status.detail && <span>{status.detail}</span>}
          </div>
        </div>
        {status.badge}
      </div>
      {/* Locales reales sin acuerdo: una sola línea, compacta, mientras dure el entorno controlado. */}
      <p className="demo-note">Menú de demostración · sin relación comercial con el local</p>
    </header>
  );
}
