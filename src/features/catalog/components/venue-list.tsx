"use client";
import { useEffect, useId, useRef, useState } from "react";
import { LocateFixed, MapPin, Search, X } from "lucide-react";
import type { Venue } from "../server/queries";
import { Button, EmptyState, Notice } from "@/components/ui/primitives";
import { rankVenues, type Coordinates } from "../proximity";
import { VenueCard, VenueRow } from "./venue-card";
import { suggestVenues, matchesQuery, type Suggestion } from "../search";

type LocationState =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "denied"; retry: boolean }
  | { kind: "unavailable"; message: string }
  | { kind: "ready"; coords: Coordinates };

export function VenueList({ venues }: { venues: Venue[] }) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [location, setLocation] = useState<LocationState>({ kind: "idle" });
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const suggestions = draft.trim() ? suggestVenues(venues, draft) : [];

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  function locate() {
    if (!navigator.geolocation) {
      setLocation({
        kind: "unavailable",
        message: "Este navegador no ofrece ubicación.",
      });
      return;
    }
    setLocation({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (
          !Number.isFinite(accuracy) ||
          accuracy > 1000 ||
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          Math.abs(latitude) > 90 ||
          Math.abs(longitude) > 180
        ) {
          setLocation({
            kind: "unavailable",
            message: "La ubicación es demasiado imprecisa.",
          });
          return;
        }
        // Solo en memoria: nunca se guarda, registra ni envía la ubicación de la persona.
        setLocation({ kind: "ready", coords: { latitude, longitude } });
      },
      async (error) => {
        if (error.code === 1) {
          // Si el navegador vuelve a preguntar, ofrecemos reintentar; si quedó bloqueado, se activa en sus ajustes.
          let retry = false;
          try {
            const status = await navigator.permissions?.query({
              name: "geolocation",
            });
            retry = status?.state === "prompt";
          } catch {
            retry = false;
          }
          setLocation({ kind: "denied", retry });
        } else
          setLocation({
            kind: "unavailable",
            message:
              error.code === 3
                ? "La ubicación tardó demasiado."
                : "No pudimos obtener tu ubicación.",
          });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  const choose = (suggestion: Suggestion) => {
    setDraft(suggestion.value);
    setQuery(suggestion.value);
    setOpen(false);
    setHighlight(-1);
  };
  const confirm = () => {
    setQuery(draft.trim());
    setOpen(false);
    setHighlight(-1);
  };
  const clear = () => {
    setDraft("");
    setQuery("");
    setOpen(false);
    setHighlight(-1);
    input.current?.focus();
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && suggestions.length) {
      event.preventDefault();
      setOpen(true);
      setHighlight((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length) {
      event.preventDefault();
      setOpen(true);
      setHighlight((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (open && highlight >= 0 && suggestions[highlight])
        choose(suggestions[highlight]);
      else confirm();
    } else if (event.key === "Escape") {
      if (open) setOpen(false);
      else if (draft) clear();
    }
  };

  const coords = location.kind === "ready" ? location.coords : null;
  // La cuadrícula cambia solo al elegir una sugerencia o confirmar la búsqueda, no mientras se escribe.
  const ranked = rankVenues(
    venues.filter((v) => matchesQuery(v, query)),
    coords,
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
  const expanded = open && draft.trim().length > 0;
  return (
    <>
      <div className="stack">
        <div className="combo" ref={box}>
          <div className="search">
            <Search size={20} aria-hidden="true" />
            <input
              ref={input}
              type="search"
              role="combobox"
              aria-label="Buscar local, barrio o ciudad"
              aria-expanded={expanded}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                expanded && highlight >= 0
                  ? `${listId}-${highlight}`
                  : undefined
              }
              placeholder="Buscar local, barrio o ciudad"
              enterKeyHint="search"
              autoComplete="off"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setOpen(true);
                setHighlight(-1);
              }}
              onFocus={() => draft && setOpen(true)}
              onKeyDown={onKeyDown}
            />
            {draft && (
              <button
                type="button"
                className="search-clear"
                aria-label="Limpiar búsqueda"
                onClick={clear}
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>
          {expanded && (
            <ul className="suggestions" id={listId} role="listbox">
              {suggestions.length ? (
                suggestions.map((suggestion, index) => (
                  <li
                    key={`${suggestion.kind}:${suggestion.value}`}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === highlight}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => choose(suggestion)}
                  >
                    {suggestion.kind === "venue" ? (
                      <Search size={16} aria-hidden="true" />
                    ) : (
                      <MapPin size={16} aria-hidden="true" />
                    )}
                    <span className="grow">{suggestion.value}</span>
                    <span className="muted t-label">{suggestion.hint}</span>
                  </li>
                ))
              ) : (
                <li className="empty" role="option" aria-selected={false} aria-disabled="true">
                  Sin coincidencias para «{draft.trim()}»
                </li>
              )}
            </ul>
          )}
        </div>
        <LocationLine state={location} onLocate={locate} />
        {coords && !nearest && available && (
          <p className="muted t-label" role="status">
            No hay locales abiertos con ubicación confirmada a menos de 5 km.
          </p>
        )}
        {query && (
          <p className="muted t-label" role="status">
            {ranked.length
              ? `Resultados para «${query}»`
              : `Sin resultados para «${query}»`}{" "}
            <button type="button" className="link-button" onClick={clear}>
              Ver todos
            </button>
          </p>
        )}
      </div>
      {!available && ranked.length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
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
        <div className="vgrid three explore-grid">
          {active.map(({ venue, distance }, index) => (
            <VenueCard
              key={venue.id}
              venue={venue}
              eager={index < 2}
              distance={distance}
            />
          ))}
        </div>
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
          title={query ? "Sin resultados" : "Todavía no hay locales"}
          action={
            query ? (
              <Button variant="secondary" onClick={clear}>
                Borrar búsqueda
              </Button>
            ) : undefined
          }
        >
          {query
            ? "Probá con otro nombre, barrio o ciudad."
            : "Volvé más tarde para ver los locales disponibles."}
        </EmptyState>
      )}
    </>
  );
}

/** Una línea de contexto por estado de ubicación, en vez de un banner que repite «Sin ubicación». */
function LocationLine({
  state,
  onLocate,
}: {
  state: LocationState;
  onLocate: () => void;
}) {
  if (state.kind === "ready")
    return (
      <p className="location-line" role="status">
        <LocateFixed size={16} aria-hidden="true" />
        <span className="grow">Ordenado por cercanía</span>
        <button type="button" className="link-button" onClick={onLocate}>
          Actualizar
        </button>
      </p>
    );
  if (state.kind === "locating")
    return (
      <p className="location-line" role="status" aria-busy="true">
        <LocateFixed size={16} aria-hidden="true" className="pulse" />
        <span className="grow">Buscando tu ubicación…</span>
      </p>
    );
  if (state.kind === "denied")
    return (
      <p className="location-line" role="status">
        <MapPin size={16} aria-hidden="true" />
        <span className="grow">
          Podés buscar por barrio o local.
          {!state.retry && " Para ordenar por cercanía, activá la ubicación en los ajustes del navegador."}
        </span>
        {state.retry && (
          <button type="button" className="link-button" onClick={onLocate}>
            Reintentar
          </button>
        )}
      </p>
    );
  if (state.kind === "unavailable")
    return (
      <p className="location-line" role="status">
        <MapPin size={16} aria-hidden="true" />
        <span className="grow">
          {state.message} Podés buscar por barrio o local.
        </span>
        <button type="button" className="link-button" onClick={onLocate}>
          Reintentar
        </button>
      </p>
    );
  return (
    <p className="location-line">
      <MapPin size={16} aria-hidden="true" />
      <span className="grow">Podés buscar por barrio o local.</span>
      <button type="button" className="link-button" onClick={onLocate}>
        Usar mi ubicación
      </button>
    </p>
  );
}
