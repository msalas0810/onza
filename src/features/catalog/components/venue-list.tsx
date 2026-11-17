"use client";
import { useState } from "react";
import { MapPin, Search } from "lucide-react";
import type { Venue } from "../server/queries";
import { Button, EmptyState, Notice } from "@/components/ui/primitives";
import { rankVenues, type Coordinates } from "../proximity";
import { VenueCard, VenueRow } from "./venue-card";

export function VenueList({ venues }: { venues: Venue[] }) {
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState("");
  function locate() {
    if (!navigator.geolocation) {
      setNotice("Este navegador no ofrece ubicación. Buscá por nombre.");
      return;
    }
    setLocating(true);
    setNotice("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const { latitude, longitude, accuracy } = position.coords;
        if (
          !Number.isFinite(accuracy) ||
          accuracy > 1000 ||
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          Math.abs(latitude) > 90 ||
          Math.abs(longitude) > 180
        ) {
          setLocation(null);
          setNotice(
            "La ubicación es demasiado imprecisa. Elegí por nombre o probá de nuevo.",
          );
          return;
        }
        // Solo en memoria: nunca se guarda, registra ni envía la ubicación de la persona.
        setLocation({ latitude, longitude });
        setNotice("");
      },
      (error) => {
        setLocating(false);
        setLocation(null);
        setNotice(
          error.code === 1
            ? "Sin permiso de ubicación. Ordenamos por disponibilidad; podés activarla en el navegador."
            : error.code === 3
              ? "La ubicación tardó demasiado. Probá de nuevo o elegí por nombre."
              : "No pudimos obtener una ubicación precisa. Elegí por nombre.",
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }
  const term = search.trim().toLocaleLowerCase("es-CR");
  const ranked = rankVenues(
    venues.filter((v) =>
      `${v.name} ${v.zone}`.toLocaleLowerCase("es-CR").includes(term),
    ),
    location,
  );
  const nearest = ranked.find(
    ({ venue, distance }) =>
      venue.open_state === "open" &&
      !venue.paused &&
      distance !== null &&
      distance <= 5,
  );
  const active = ranked.filter(
    ({ venue }) =>
      venue.open_state !== "closed" && venue.id !== nearest?.venue.id,
  );
  const closed = ranked.filter(({ venue }) => venue.open_state === "closed");
  const available = ranked.some(
    ({ venue }) => venue.open_state === "open" && !venue.paused,
  );
  return (
    <>
      <div className="stack">
        <div className="search">
          <Search size={20} aria-hidden="true" />
          <input
            type="search"
            aria-label="Buscar local"
            placeholder="Buscar local o barrio"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {notice ? (
          <Notice
            tone="warning"
            title="Sin ubicación"
            action={
              <Button
                variant="secondary"
                size="sm"
                loading={locating}
                onClick={locate}
              >
                Reintentar
              </Button>
            }
          >
            {notice}
          </Notice>
        ) : location ? (
          <div className="row wrap">
            <span className="badge success">Ubicación activa</span>
            <span className="muted t-label">Ordenado por cercanía</span>
            <Button
              variant="quiet"
              size="sm"
              loading={locating}
              onClick={locate}
            >
              Actualizar
            </Button>
          </div>
        ) : (
          <div className="row wrap">
            <Button
              variant="secondary"
              size="sm"
              loading={locating}
              onClick={locate}
            >
              <MapPin size={16} aria-hidden="true" />
              Usar mi ubicación
            </Button>
            <span className="muted t-label">Ordenado por disponibilidad</span>
          </div>
        )}
        {location && !nearest && available && (
          <p className="muted t-label" role="status">
            No hay locales abiertos con ubicación confirmada a menos de 5 km.
            Mostramos los disponibles.
          </p>
        )}
      </div>
      {!available && ranked.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <Notice>Por ahora ningún local de esta lista recibe pedidos.</Notice>
        </div>
      )}
      {nearest && (
        <>
          <h2 className="eyebrow section-label">Más cerca</h2>
          <VenueCard
            venue={nearest.venue}
            distance={nearest.distance}
            eager
            featured
          />
        </>
      )}
      {active.length > 0 && (
        <>
          <h2 className="eyebrow section-label">
            {nearest ? "Otros abiertos" : "Abiertos"}
          </h2>
          <div className="vgrid three">
            {active.map(({ venue, distance }, index) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                eager={index < 2}
                distance={distance}
              />
            ))}
          </div>
        </>
      )}
      {closed.length > 0 && (
        <>
          <h2 className="eyebrow section-label">Cerrados</h2>
          <div>
            {closed.map(({ venue, distance }) => (
              <VenueRow key={venue.id} venue={venue} distance={distance} />
            ))}
          </div>
        </>
      )}
      {!ranked.length && (
        <EmptyState
          icon={Search}
          title={search ? "Sin resultados" : "Todavía no hay locales"}
          action={
            search ? (
              <Button variant="secondary" onClick={() => setSearch("")}>
                Borrar búsqueda
              </Button>
            ) : undefined
          }
        >
          {search
            ? "Probá con otro nombre o barrio."
            : "Volvé más tarde para ver los locales disponibles."}
        </EmptyState>
      )}
    </>
  );
}
