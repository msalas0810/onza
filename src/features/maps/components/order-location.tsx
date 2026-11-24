"use client";
import { useState } from "react";
import { MapPin, Pencil } from "lucide-react";
import { Button, Notice } from "@/components/ui/primitives";
import type { Order } from "@/features/orders/types";
import { mapsCommand } from "../client-api";
import {
  describeLocation,
  type LocationSelection,
  type OrderLocation,
} from "../types";
import { useMapVersion, useVenueMaps } from "../use-maps";
import { LocationThumb } from "./delivery-location";
import { LocationPicker } from "./location-picker";
import styles from "./maps.module.css";

const ACTIVE = ["pending_authorization", "queued", "preparing", "ready"];

const selectionFrom = (l: OrderLocation): LocationSelection =>
  l.delivery_method === "location_on_map" || !l.element_id
    ? {
        method: "location_on_map",
        mapId: l.map_id,
        x: l.location.x,
        y: l.location.y,
      }
    : { method: "table", mapId: l.map_id, tableId: l.element_id };

/** Plano de la versión exacta que usó el pedido, en miniatura y centrado en el marcador. */
function Thumb({ location }: { location: OrderLocation }) {
  const version = useMapVersion(location.map_id, location.map_version);
  if (version.status === "loading")
    return <div className="sk" style={{ height: 180 }} aria-busy="true" />;
  if (version.status !== "ready") return null;
  return (
    <LocationThumb
      map={version.data}
      point={location.location}
      label={`Tu ubicación en ${version.data.name}`}
    />
  );
}

/**
 * Ubicación de entrega en la pantalla del pedido del cliente: la muestra sobre el plano y permite corregirla o quitarla
 * mientras el pedido sigue activo y el equipo no haya empezado la entrega.
 */
export function OrderLocationCard({
  order,
  refresh,
}: {
  order: Order;
  refresh: () => void;
}) {
  const maps = useVenueMaps(order.venue.id);
  const [open, setOpen] = useState(false);
  const location = order.location ?? null;
  const active = ACTIVE.includes(order.status);
  // `claimed_elsewhere` para el cliente es «alguien del equipo ya empezó el retiro».
  const locked = !!order.claimed_elsewhere;
  const canEdit = active && !locked && maps.status === "ready";

  if (!location && !canEdit) return null;
  const apply = async (selection: LocationSelection) => {
    await mapsCommand({
      action: "order_location_set",
      orderId: order.id,
      ...selection,
    });
    refresh();
  };
  const clear = async () => {
    await mapsCommand({ action: "order_location_clear", orderId: order.id });
    refresh();
  };
  return (
    <section
      className={styles.card}
      aria-labelledby="order-location-title"
      data-testid="order-location"
    >
      <div className={styles.cardHead} id="order-location-title">
        <MapPin size={20} aria-hidden="true" /> Dónde te entregamos
      </div>
      {location ? (
        <>
          <div className={styles.cardRow}>
            <div className="grow">
              <strong data-testid="order-location-summary">
                {describeLocation(location)}
              </strong>
              <div className="muted t-label">{location.map_name}</div>
            </div>
            {canEdit && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setOpen(true)}
              >
                <Pencil size={16} aria-hidden="true" /> Cambiar
              </Button>
            )}
          </div>
          {active && <Thumb location={location} />}
          {active && locked && (
            <Notice tone="warning">
              El equipo ya empezó la entrega: la ubicación no se puede cambiar.
            </Notice>
          )}
        </>
      ) : (
        <div className={styles.cardRow}>
          <div className="grow muted t-label">
            Opcional. Marcá dónde estás y te llevamos el pedido; si no, retirás
            en {order.venue.pickup_label}.
          </div>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Indicar dónde estoy
          </Button>
        </div>
      )}
      {open && maps.status === "ready" && (
        <LocationPicker
          open
          onOpenChange={setOpen}
          maps={maps.data}
          initial={location ? selectionFrom(location) : null}
          onConfirm={apply}
          onClear={location ? clear : undefined}
        />
      )}
    </section>
  );
}
