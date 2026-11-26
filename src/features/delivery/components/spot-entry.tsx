"use client";
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { SpotPicker } from "./spot-picker";
import { readSpotPreference, writeSpotPreference } from "../spot-preference";
import { spotText, yourSpot, type DeliveryMode, type Spot } from "../types";

/**
 * Entrada del menú de un local que entrega en el lugar. Si el cliente llegó por el QR de una mesa (?spot=), ese lugar queda
 * elegido; si no, puede elegirlo acá o al pedir. Es una comodidad: el servidor valida el lugar cuando se hace el pedido.
 */
export function SpotEntry({
  venueId,
  mode,
  noun,
  spots,
  presetSpotId,
}: {
  venueId: string;
  mode: DeliveryMode;
  noun: string;
  spots: Spot[];
  presetSpotId?: string;
}) {
  const [spotId, setSpotId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (presetSpotId) writeSpotPreference(venueId, presetSpotId);
    const read = () => {
      const saved = readSpotPreference(venueId);
      setSpotId(saved && spots.some((s) => s.id === saved) ? saved : null);
    };
    read();
    window.addEventListener("onza-spot-change", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("onza-spot-change", read);
      window.removeEventListener("storage", read);
    };
  }, [venueId, presetSpotId, spots]);
  if (mode === "bar" || !spots.length) return null;
  const chosen = spots.find((s) => s.id === spotId);
  return (
    <>
      <div className="spot-here" role="status">
        <MapPin size={20} aria-hidden="true" />
        <div className="grow">
          {chosen ? (
            <>
              <strong>Te lo llevamos a {spotText({ spot_label: chosen.label, spot_area: chosen.area })}</strong>
              <span className="muted t-label">
                Lo confirmás al pedir{mode === "both" ? " o retirás en la barra" : ""}.
              </span>
            </>
          ) : (
            <>
              <strong>
                {mode === "location"
                  ? `Pedí y te lo llevamos a ${yourSpot(noun)}`
                  : `También te lo llevamos a ${yourSpot(noun)}`}
              </strong>
              <span className="muted t-label">Elegí dónde estás para recibirlo ahí.</span>
            </>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          {chosen ? "Cambiar" : `Elegir ${noun.toLowerCase()}`}
        </Button>
      </div>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={`¿Dónde estás?`}
        description={`Elegí ${yourSpot(noun)}. Cuando el pedido esté listo te lo llevamos ahí.`}
      >
        <SpotPicker
          spots={spots}
          noun={noun}
          value={spotId}
          name="entry-spot"
          onChange={(id) => {
            writeSpotPreference(venueId, id);
            setOpen(false);
          }}
        />
      </Sheet>
    </>
  );
}
