"use client";
import { PlanMap } from "./plan-map";
import type { ServicePolygon, ShapedSpot } from "../geometry";

/** El pin de un pedido sobre el mapa en que se marcó (solo lectura). La barra y el cliente ven el mismo lugar exacto. */
export function OrderPinMap({
  order,
  spots,
  serviceArea,
  maxVh = 46,
  label,
}: {
  order: {
    map?: {
      image_url: string;
      width: number;
      height: number;
      current: boolean;
    } | null;
    map_x?: number | null;
    map_y?: number | null;
    spot_id?: string | null;
  };
  /** Las formas del mapa vigente; solo se dibujan si el pedido se marcó en esa versión. */
  spots?: readonly ShapedSpot[];
  serviceArea?: readonly ServicePolygon[];
  maxVh?: number;
  label: string;
}) {
  const { map, map_x: x, map_y: y } = order;
  if (!map || x == null || y == null) return null;
  return (
    <PlanMap
      map={{ imageUrl: map.image_url, width: map.width, height: map.height }}
      pin={{ x, y }}
      spots={map.current ? spots : undefined}
      serviceArea={map.current ? serviceArea : undefined}
      selectedSpotId={order.spot_id ?? null}
      maxVh={maxVh}
      label={label}
    />
  );
}
