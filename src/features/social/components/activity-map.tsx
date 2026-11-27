import Link from "next/link";
import { activityLevelLabel } from "../types";

export type ActivityPoint = {
  id: string;
  name: string;
  zone: string | null;
  level: 1 | 2 | 3;
  /** Posición en el plano, de 0 a 1. */
  x: number;
  y: number;
  slug?: string;
};

/** Proyecta coordenadas verificadas a un plano 0–1 con margen (equirrectangular: suficiente a escala de ciudad). */
export function projectVenues<T extends { latitude: number; longitude: number }>(venues: readonly T[]) {
  const lats = venues.map((v) => v.latitude);
  const lngs = venues.map((v) => v.longitude);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const span = Math.max(maxLat - minLat, maxLng - minLng) || 1;
  return venues.map((v) => ({
    ...v,
    x: maxLng === minLng ? 0.5 : 0.1 + (0.8 * (v.longitude - minLng)) / span,
    y: maxLat === minLat ? 0.5 : 0.1 + (0.8 * (maxLat - v.latitude)) / span,
  }));
}

const radius = { 1: 7, 2: 10, 3: 14 } as const;

/**
 * Mapa esquemático de actividad: manchas por local según el nivel (nunca un número de personas). Sin mapa base de calles:
 * para eso hace falta un proveedor de teselas con su clave (ver docs/Onza-Noche-decisiones.md).
 */
export function ActivityMap({ points, simulated }: { points: readonly ActivityPoint[]; simulated: boolean }) {
  return (
    <figure className="activity">
      <svg
        className="activity-map"
        viewBox="0 0 100 64"
        role="img"
        aria-label={`${simulated ? "Ejemplo simulado: " : ""}${points.length} ${points.length === 1 ? "local con actividad" : "locales con actividad"}`}
      >
        <defs>
          <radialGradient id="heat">
            <stop offset="0%" className="heat-core" />
            <stop offset="100%" className="heat-edge" />
          </radialGradient>
          <pattern id="activity-grid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 8 0 L 0 0 0 8" className="activity-grid" />
          </pattern>
        </defs>
        <rect width="100" height="64" className="activity-bg" />
        <rect width="100" height="64" fill="url(#activity-grid)" />
        {points.map((p) => (
          <g key={p.id} className="activity-spot" data-level={p.level}>
            <circle cx={p.x * 100} cy={p.y * 64} r={radius[p.level]} fill="url(#heat)" />
            <circle cx={p.x * 100} cy={p.y * 64} r={1.2} className="activity-dot" />
          </g>
        ))}
      </svg>
      <figcaption>
        <ol className="rows activity-list">
          {points.map((p) => (
            <li className="r" key={p.id}>
              <span className="activity-swatch" data-level={p.level} aria-hidden="true" />
              <span className="grow">
                {p.slug ? <Link href={`/v/${p.slug}`}>{p.name}</Link> : <strong>{p.name}</strong>}
                {p.zone && <div className="muted t-label">{p.zone}</div>}
              </span>
              <span className="t-label">{activityLevelLabel[p.level]}</span>
            </li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}
