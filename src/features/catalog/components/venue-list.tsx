"use client";
import { useState } from "react";
import type { Venue } from "../server/queries";
import { Button, TextField, EmptyState } from "@/components/ui/primitives";
import { rankVenues, type Coordinates } from "../proximity";
import { VenueCard } from "./venue-card";
export function VenueList({ venues }: { venues: Venue[] }) {
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState("");
  function locate() {
    if (!navigator.geolocation) {
      setNotice(
        "Este navegador no ofrece ubicación. Buscá un local por nombre.",
      );
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
            "La ubicación es demasiado imprecisa. Elegí el local por nombre o intentá de nuevo.",
          );
          return;
        }
        // In-memory only: never persist, log or transmit the customer's coordinates.
        setLocation({ latitude, longitude });
        setNotice(
          "Ordenados por distancia aproximada. Confirmá el local antes de pedir.",
        );
      },
      (error) => {
        setLocating(false);
        setLocation(null);
        setNotice(
          error.code === 1
            ? "No diste permiso de ubicación. Podés buscar y elegir un local por nombre."
            : error.code === 3
              ? "La ubicación tardó demasiado. Intentá de nuevo o elegí el local por nombre."
              : "No pudimos obtener una ubicación precisa. Elegí el local por nombre.",
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }
  const ranked = rankVenues(
    venues.filter((v) =>
      v.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
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
  const available = ranked.some(
    ({ venue }) => venue.open_state === "open" && !venue.paused,
  );
  return (
    <>
      <section className="location-prompt" aria-label="Locales por cercanía">
        <p className="muted">
          Usá tu ubicación para ordenar los locales abiertos por cercanía. Se
          usa solo mientras estés en esta pantalla.
        </p>
        <Button variant="quiet" loading={locating} onClick={locate}>
          {location ? "Actualizar ubicación" : "Usar mi ubicación"}
        </Button>
        {notice && (
          <p role="status" className="muted">
            {notice}
          </p>
        )}
        {location && !nearest && available && (
          <p className="muted">
            No encontramos locales abiertos con ubicación confirmada a menos de
            5 km. Podés elegir entre los disponibles.
          </p>
        )}
      </section>
      <TextField
        label="Buscar local"
        placeholder="Nombre del local"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {!available && ranked.length > 0 && (
        <p className="notice">
          Por ahora ningún local de esta lista recibe pedidos.
        </p>
      )}
      <div className="venue-list">
        {ranked.map(({ venue, distance }, index) => (
          <div key={venue.id}>
            {nearest?.venue.id === venue.id && (
              <p className="nearby-label">Abierto cerca de vos</p>
            )}
            <VenueCard venue={venue} eager={index < 2} distance={distance} />
          </div>
        ))}
      </div>
      {!ranked.length && (
        <EmptyState
          title={search ? "Sin resultados" : "Todavía no hay locales"}
        >
          {search
            ? "Probá con otro nombre."
            : "Volvé más tarde para ver los locales disponibles."}
        </EmptyState>
      )}
    </>
  );
}
