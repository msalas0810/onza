"use client";
import Image from "next/image";
import type { Venue } from "../server/queries";
import { useImageFailure } from "@/lib/use-image-failure";

type Mark = Pick<Venue, "name" | "logo_url">;
/** Logo del local (62–64 px) o monograma compacto cuando no hay logo utilizable. */
export function VenueMark({
  venue,
  large = false,
}: {
  venue: Mark;
  large?: boolean;
}) {
  const logo = useImageFailure(venue.logo_url);
  return (
    <span
      className={`mono ${large ? "lg" : ""}`}
      data-has-logo={logo.usable ? "true" : "false"}
    >
      {logo.usable ? (
        <Image
          unoptimized
          fill
          sizes="64px"
          src={logo.usable}
          alt=""
          {...logo.props}
        />
      ) : (
        <span aria-hidden="true">
          {venue.name.trim().charAt(0).toLocaleUpperCase("es-CR") || "O"}
        </span>
      )}
    </span>
  );
}
/** Portada: foto protagonista sin velos ni filtros. Devuelve null si no hay foto utilizable (el llamador decide el respaldo). */
export function useCover(src: string | null) {
  return useImageFailure(src);
}
export function VenueCover({
  src,
  ratio = "ratio-16x9",
  eager = false,
  sizes = "(min-width: 1024px) 336px, (min-width: 720px) 50vw, 100vw",
  state,
  position = "50% 50%",
}: {
  src: string;
  ratio?: "ratio-16x9" | "ratio-3x2";
  eager?: boolean;
  sizes?: string;
  state: ReturnType<typeof useImageFailure>;
  position?: string;
}) {
  return (
    <div className={`media ${ratio}`}>
      <Image
        unoptimized
        fill
        sizes={sizes}
        src={src}
        alt=""
        loading={eager ? "eager" : undefined}
        style={{ objectPosition: position }}
        {...state.props}
      />
    </div>
  );
}
