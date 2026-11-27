"use client";
import { useState } from "react";
import { MapPin } from "lucide-react";
import { anchorOf, resolvePlace, roundPoint, type Shape } from "../geometry";
import type { LocationPref } from "../spot-preference";
import { spotText, yourSpot, type Spot, type VenueMap } from "../types";
import { PlanMap } from "./plan-map";
import { SpotPicker } from "./spot-picker";

/** Cómo se nombra lo elegido: «Mesa 7 · Jardín», o «Tu punto en el mapa» si cayó entre mesas. Null si no hay nada válido. */
export function describeChoice(
  pref: LocationPref | null,
  spots: Spot[],
  map: VenueMap | null,
) {
  if (!pref) return null;
  if (pref.point) {
    if (!map || pref.point.mapId !== map.id) return null;
    const place = resolvePlace(
      spots,
      map,
      pref.point.x,
      pref.point.y,
      pref.hint,
    );
    return {
      pin: pref.point,
      spotId: place?.spotId ?? null,
      text: place?.label
        ? spotText({ spot_label: place.label, spot_area: place.area })
        : "",
    };
  }
  const spot = spots.find((s) => s.id === pref.spotId && s.enabled);
  return spot
    ? {
        pin: null,
        spotId: spot.id,
        text: spotText({ spot_label: spot.label, spot_area: spot.area }),
      }
    : null;
}

/**
 * Dónde recibir el pedido. Con mapa, la acción principal es tocar el plano: un toque pone el pin, otro lo mueve, y si cae en
 * una mesa o zona marcada se muestra su nombre. Sin mapa, la lista de lugares de siempre. Con mapa, la lista queda como
 * alternativa para quien no ve su mesa. Nunca se adivina una mesa: solo se nombra la que contiene el toque.
 */
export function LocationPicker({
  noun,
  map,
  spots,
  value,
  onChange,
  name,
  maxVh = 56,
}: {
  noun: string;
  map: VenueMap | null;
  spots: Spot[];
  value: LocationPref | null;
  onChange: (pref: LocationPref) => void;
  /** Distingue los grupos de radio cuando hay dos selectores en la página. */
  name: string;
  maxVh?: number;
}) {
  const [outside, setOutside] = useState(false);
  if (!map)
    return (
      <SpotPicker
        spots={spots}
        noun={noun}
        value={value?.spotId ?? null}
        name={name}
        onChange={(spotId) => onChange({ spotId })}
      />
    );
  const choice = describeChoice(value, spots, map);
  const listed = spots.filter((s) => s.enabled);
  return (
    <div className="location-picker">
      <PlanMap
        map={map}
        serviceArea={map.serviceArea}
        spots={spots}
        pin={choice?.pin ?? null}
        selectedSpotId={choice?.spotId ?? null}
        maxVh={maxVh}
        label={`Mapa del local. Tocá donde estás para ${choice ? "mover" : "poner"} el pin.`}
        onPick={(p) => {
          setOutside(false);
          onChange({
            point: { mapId: map.id, x: roundPoint(p.x), y: roundPoint(p.y) },
          });
        }}
        onOutside={() => setOutside(true)}
      />
      <div
        className="plan-status"
        role="status"
        data-tone={outside ? "danger" : undefined}
      >
        <MapPin size={20} aria-hidden="true" />
        <div className="grow">
          {outside ? (
            <>
              <strong>Ahí no llegamos</strong>
              <span className="muted t-label">
                Marcá {yourSpot(noun)} dentro de la zona de entrega: la parte
                del mapa que no está oscurecida.
              </span>
            </>
          ) : choice ? (
            <>
              <strong>{choice.text || "Tu punto en el mapa"}</strong>
              <span className="muted t-label">
                {choice.pin
                  ? "Te lo llevamos ahí. Tocá otro punto para moverlo."
                  : `Te lo llevamos a ${yourSpot(noun)}.`}
              </span>
            </>
          ) : (
            <>
              <strong>Tocá el mapa donde estás</strong>
              <span className="muted t-label">
                Un toque pone el pin; otro toque lo mueve.
              </span>
            </>
          )}
        </div>
      </div>
      {listed.length > 0 && (
        <details>
          <summary>¿No ves {yourSpot(noun)}? Elegila de la lista</summary>
          <SpotPicker
            spots={listed}
            noun={noun}
            value={choice?.spotId ?? null}
            name={name}
            onChange={(spotId) => {
              setOutside(false);
              const spot = listed.find((s) => s.id === spotId);
              if (spot?.shape) {
                const at = anchorOf(spot.shape as Shape, map);
                onChange({
                  point: {
                    mapId: map.id,
                    x: roundPoint(at.x),
                    y: roundPoint(at.y),
                  },
                  hint: spot.id,
                });
              } else onChange({ spotId });
            }}
          />
        </details>
      )}
    </div>
  );
}
