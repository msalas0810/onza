"use client";
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { anchorOf, roundPoint, type Shape } from "../geometry";
import {
  readLocationPreference,
  writeLocationPreference,
  type LocationPref,
} from "../spot-preference";
import {
  yourSpot,
  type DeliveryMode,
  type Spot,
  type VenueMap,
} from "../types";
import { describeChoice, LocationPicker } from "./location-picker";

/**
 * Entrada del menú de un local que entrega en el lugar. Si el cliente llegó por el QR de una mesa (?spot=), el mapa se abre
 * con el pin ya puesto en esa mesa; si no, marca dónde está acá o al pedir. Queda guardado en este dispositivo (sobrevive al
 * login). Es una comodidad: el servidor valida mapa, punto y lugar cuando se hace el pedido.
 */
export function SpotEntry({
  venueId,
  mode,
  noun,
  spots,
  map,
  presetSpotId,
}: {
  venueId: string;
  mode: DeliveryMode;
  noun: string;
  spots: Spot[];
  map: VenueMap | null;
  presetSpotId?: string;
}) {
  const [pref, setPref] = useState<LocationPref | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const preset = presetSpotId
      ? spots.find((s) => s.id === presetSpotId)
      : undefined;
    if (preset) {
      if (map && preset.shape) {
        const at = anchorOf(preset.shape as Shape, map);
        writeLocationPreference(venueId, {
          point: { mapId: map.id, x: roundPoint(at.x), y: roundPoint(at.y) },
          hint: preset.id,
        });
      } else writeLocationPreference(venueId, { spotId: preset.id });
    }
    const read = () => setPref(readLocationPreference(venueId));
    read();
    window.addEventListener("onza-spot-change", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("onza-spot-change", read);
      window.removeEventListener("storage", read);
    };
  }, [venueId, presetSpotId, spots, map]);
  if (mode === "bar" || (!spots.length && !map)) return null;
  const chosen = describeChoice(pref, spots, map);
  return (
    <>
      <div className="spot-here" role="status">
        <MapPin size={20} aria-hidden="true" />
        <div className="grow">
          {chosen ? (
            <>
              <strong>
                Te lo llevamos a {chosen.text || "tu punto en el mapa"}
              </strong>
              <span className="muted t-label">
                Lo confirmás al pedir
                {mode === "both" ? " o retirás en la barra" : ""}.
              </span>
            </>
          ) : (
            <>
              <strong>
                {mode === "location"
                  ? `Pedí y te lo llevamos a ${yourSpot(noun)}`
                  : `También te lo llevamos a ${yourSpot(noun)}`}
              </strong>
              <span className="muted t-label">
                {map
                  ? "Tocá el mapa donde estás y listo."
                  : "Elegí dónde estás para recibirlo ahí."}
              </span>
            </>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          {chosen
            ? "Cambiar"
            : map
              ? "Marcar en el mapa"
              : `Elegir ${noun.toLowerCase()}`}
        </Button>
      </div>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="¿Dónde estás?"
        description={
          map
            ? "Tocá el mapa donde estás sentado. Cuando el pedido esté listo te lo llevamos ahí."
            : `Elegí ${yourSpot(noun)}. Cuando el pedido esté listo te lo llevamos ahí.`
        }
        actions={
          chosen ? (
            <Button onClick={() => setOpen(false)} block>
              Listo
            </Button>
          ) : undefined
        }
      >
        <LocationPicker
          noun={noun}
          map={map}
          spots={spots}
          value={pref}
          name="entry-spot"
          maxVh={50}
          onChange={(next) => {
            writeLocationPreference(venueId, next);
            // Sin mapa, elegir de la lista cierra la hoja (un solo toque, como antes).
            if (!map) setOpen(false);
          }}
        />
      </Sheet>
    </>
  );
}
