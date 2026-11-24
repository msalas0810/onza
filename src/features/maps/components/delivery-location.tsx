"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin, Pencil } from "lucide-react";
import { Button, Notice } from "@/components/ui/primitives";
import { mapImageUrl } from "../image";
import { resolveSelection } from "../geometry";
import { readTableContext, useVenueMaps } from "../use-maps";
import type { LocationSelection, PublishedMap } from "../types";
import { LocationPicker, selectionSummary } from "./location-picker";
import { MapViewport } from "./map-viewport";
import styles from "./maps.module.css";

/** Resumen legible de una selección contra un plano (o null si ya no es válida en esa versión). */
export function describeSelection(map: PublishedMap, s: LocationSelection) {
  const r = resolveSelection(
    map.layout,
    { w: map.image_width, h: map.image_height },
    s.method === "location_on_map"
      ? { method: s.method, x: s.x, y: s.y }
      : { method: s.method, tableId: s.tableId },
  );
  return r.ok ? selectionSummary(r) : null;
}

/**
 * Sección «¿Dónde te entregamos?» del checkout. Solo aparece si el local tiene un plano disponible; la selección es opcional
 * (sin ella se retira en la barra) y, si el cliente llegó por el QR de una mesa, ya viene resuelta sin abrir el plano.
 */
export function CheckoutLocation({
  venueId,
  value,
  onChange,
}: {
  venueId: string;
  value: LocationSelection | null;
  onChange: (value: LocationSelection | null) => void;
}) {
  const maps = useVenueMaps(venueId);
  const [open, setOpen] = useState(false);
  const available = maps.status === "ready" ? maps.data : null;

  // QR de mesa: una mesa válida del plano vigente reemplaza la elección manual solo mientras el cliente no haya elegido otra cosa.
  const qrApplied = useRef(false);
  const qrTableId = available ? readTableContext(venueId) : null;
  const qrMap = qrTableId
    ? available?.find((m) =>
        m.layout.elements.some((e) => e.id === qrTableId && e.type === "table"),
      )
    : undefined;
  const qrMapId = qrMap?.id;
  useEffect(() => {
    if (qrMapId && qrTableId && !qrApplied.current && !value) {
      qrApplied.current = true;
      onChange({ method: "table_qr", mapId: qrMapId, tableId: qrTableId });
    }
  }, [qrMapId, qrTableId, value, onChange]);

  if (maps.status === "loading")
    return (
      <div
        className="sk"
        style={{ height: 76 }}
        aria-busy="true"
        aria-label="Consultando el plano del local"
      />
    );
  if (maps.status === "error")
    return (
      <Notice
        tone="warning"
        title="No pudimos cargar el plano"
        action={
          <Button variant="secondary" size="sm" onClick={maps.reload}>
            Reintentar
          </Button>
        }
      >
        Podés pedir igual y retirar en la barra.
      </Notice>
    );
  if (!available) return null;

  const map = value ? available.find((m) => m.id === value.mapId) : undefined;
  const summary = value && map ? describeSelection(map, value) : null;
  return (
    <section
      className={styles.card}
      aria-labelledby="deliver-title"
      data-testid="checkout-location"
    >
      <div className={styles.cardHead} id="deliver-title">
        <MapPin size={20} aria-hidden="true" /> ¿Dónde te entregamos?
      </div>
      {value && map && summary ? (
        <div className={styles.cardRow}>
          <div className="grow">
            <strong data-testid="checkout-location-summary">{summary}</strong>
            <div className="muted t-label">
              {value.method === "table_qr"
                ? "Mesa del QR que escaneaste"
                : map.name}{" "}
              · Te llevamos el pedido ahí.
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            <Pencil size={16} aria-hidden="true" /> Cambiar
          </Button>
          <Button variant="quiet" size="sm" onClick={() => onChange(null)}>
            Quitar
          </Button>
        </div>
      ) : (
        <div className={styles.cardRow}>
          <div className="grow muted t-label">
            Opcional. Marcá tu lugar en el plano para que te lo lleven; si no,
            retirás en {"la barra"}.
          </div>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Marcar mi ubicación
          </Button>
        </div>
      )}
      {open && (
        <LocationPicker
          open
          onOpenChange={setOpen}
          maps={available}
          initial={
            value && value.method !== "table_qr"
              ? value
              : value
                ? { ...value, method: "table" }
                : null
          }
          onConfirm={(selection) => onChange(selection)}
          onClear={value ? () => onChange(null) : undefined}
        />
      )}
    </section>
  );
}

/** Vista en miniatura (solo lectura) de dónde marcó el cliente su ubicación. */
export function LocationThumb({
  map,
  point,
  label,
}: {
  map: Pick<
    PublishedMap,
    "image_path" | "image_width" | "image_height" | "layout" | "name"
  >;
  point: { x: number; y: number };
  label: string;
}) {
  return (
    <div className={styles.mini}>
      <MapViewport
        imageUrl={mapImageUrl(map.image_path)}
        imageWidth={map.image_width}
        imageHeight={map.image_height}
        label={`Plano de ${map.name}`}
        zones={map.layout.zones.map((z) => ({ ...z }))}
        markers={[{ id: "me", point, kind: "pin", ariaLabel: label }]}
        focus={{ key: `${point.x}:${point.y}`, point, scale: 2 }}
        showZoneNames={false}
        controls={false}
      />
    </div>
  );
}
