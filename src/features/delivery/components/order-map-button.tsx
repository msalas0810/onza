"use client";
import { useState } from "react";
import { Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { formatClock } from "@/lib/clock";
import {
  deliveryOptionsSchema,
  MAP_NAME_FALLBACK,
  spotText,
  type DeliveryOptions,
} from "../types";
import { OrderPinMap } from "./order-pin-map";

type PinOrder = {
  id?: string;
  public_code?: string;
  venue_id: string;
  spot_id?: string | null;
  spot_label?: string | null;
  spot_area?: string | null;
  spot_changed_at?: string | null;
  map_x?: number | null;
  map_y?: number | null;
  map?: {
    image_url: string;
    width: number;
    height: number;
    current: boolean;
  } | null;
};

/**
 * El pin del pedido para la barra. En la tarjeta se ve un recorte del MISMO plano centrado en el punto que marcó el cliente
 * (sin abrir nada); tocarlo abre el plano completo con el nombre de la mesa o zona. Las formas del mapa vigente se leen al
 * abrir; sin ellas se ve igual el pin sobre la imagen.
 */
export function OrderMapButton({
  order,
  size = "sm",
}: {
  order: PinOrder;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<DeliveryOptions | null>(null);
  if (!order.map || order.map_x == null || order.map_y == null) return null;
  const load = () => {
    setOpen(true);
    if (options) return;
    void fetch(`/api/delivery?venue=${order.venue_id}`, { cache: "no-store" })
      .then(async (r) =>
        r.ok ? deliveryOptionsSchema.parse(await r.json()) : null,
      )
      .then(setOptions)
      .catch(() => undefined);
  };
  const name = spotText(order) || MAP_NAME_FALLBACK;
  return (
    <>
      {size === "sm" ? (
        <button
          type="button"
          className="pin-peek"
          onClick={load}
          aria-label={`Ver en el mapa: ${name}`}
          style={{
            backgroundImage: `url(${JSON.stringify(order.map.image_url)})`,
            // background-position en % alinea el punto (x, y) de la imagen con el mismo % de la caja: el pin cae justo ahí.
            backgroundPosition: `${order.map_x * 100}% ${order.map_y * 100}%`,
          }}
        >
          <span
            className="pin-peek-pin"
            aria-hidden="true"
            style={{ left: `${order.map_x * 100}%`, top: `${order.map_y * 100}%` }}
          />
          <span className="pin-peek-label">
            <MapIcon size={14} aria-hidden="true" /> Ver en el mapa
          </span>
        </button>
      ) : (
        <Button variant="secondary" size={size} onClick={load}>
          <MapIcon size={16} aria-hidden="true" /> Ver en el mapa
        </Button>
      )}
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={order.public_code ? `#${order.public_code} · ${name}` : name}
        description={
          order.spot_changed_at
            ? `Pin exacto del cliente. Cambió su lugar a las ${formatClock(order.spot_changed_at).replace(/\.$/, "")}.`
            : "Pin exacto que marcó el cliente."
        }
        actions={
          <Button block variant="secondary" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        }
      >
        <OrderPinMap
          order={order}
          spots={options?.spots}
          serviceArea={options?.map?.serviceArea}
          maxVh={52}
          label={`Mapa con el pin del pedido: ${name}`}
        />
      </Sheet>
    </>
  );
}
