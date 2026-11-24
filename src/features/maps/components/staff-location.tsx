"use client";
import { useMemo, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Eye, MapPin, ShieldCheck, Users, X } from "lucide-react";
import { Button, Notice, StatusBadge } from "@/components/ui/primitives";
import { statusLabels, type Order } from "@/features/orders/types";
import { mapImageUrl } from "../image";
import { nearestElements, proximityWord } from "../geometry";
import { describeLocation } from "../types";
import { useMapVersion } from "../use-maps";
import { elementIcons, MapViewport, type ViewportMarker } from "./map-viewport";
import styles from "./maps.module.css";

/** Línea de la tarjeta del pedido en la barra: dónde está el cliente y un botón para verlo en el plano. */
export function OrderLocationLine({
  order,
  onView,
  disabled,
}: {
  order: Order;
  onView: () => void;
  disabled?: boolean;
}) {
  const location = order.location;
  if (!location)
    return (
      <p className="muted t-label" data-testid="no-location">
        Sin ubicación · retira en la barra
      </p>
    );
  return (
    <div className={styles.cardRow} data-testid="order-location-line">
      <div className="grow">
        <span className={styles.chip}>
          <MapPin size={14} aria-hidden="true" /> {describeLocation(location)}
        </span>
        {location.assigned_staff.length > 0 && (
          <div className="muted t-label" style={{ marginTop: 4 }}>
            <Users
              size={14}
              aria-hidden="true"
              style={{ verticalAlign: "-2px" }}
            />{" "}
            {location.assigned_staff.join(", ")}
          </div>
        )}
      </div>
      <Button
        variant="secondary"
        size="lg"
        onClick={onView}
        disabled={disabled}
      >
        <Eye size={20} aria-hidden="true" /> Ver ubicación
      </Button>
    </div>
  );
}

/**
 * Plano centrado sobre el marcador del cliente, con la zona o mesa, los puntos de referencia más cercanos y el estado del
 * pedido. Usa la versión exacta del plano con la que el cliente marcó (aunque el local lo haya actualizado después).
 * La entrega no se confirma aquí: pide el código o el QR del cliente y se valida en «Validar retiro».
 */
export function StaffLocationDialog({
  order,
  onClose,
  actions,
}: {
  order: Order;
  onClose: () => void;
  /** Botones de estado del pedido (aceptar, marcar listo, validar retiro), los mismos de la tarjeta. */
  actions?: ReactNode;
}) {
  const location = order.location;
  const version = useMapVersion(location?.map_id, location?.map_version);
  const map = version.status === "ready" ? version.data : null;
  const point = location?.location;
  const nearby = useMemo(
    () =>
      map && point
        ? nearestElements(
            map.layout,
            { w: map.image_width, h: map.image_height },
            point,
            3,
          )
        : [],
    [map, point],
  );
  const markers: ViewportMarker[] = useMemo(() => {
    if (!map || !point) return [];
    const list: ViewportMarker[] = map.layout.elements.map((e) => ({
      id: `e-${e.id}`,
      point: e,
      kind: "icon",
      icon: e.type,
      label: e.label,
      ariaLabel: e.label,
      tone: e.id === location?.element_id ? "selected" : "default",
      alwaysLabel: nearby.some((n) => n.element.id === e.id),
    }));
    list.push({
      id: "customer",
      point,
      kind: "pin",
      ariaLabel: `Ubicación del cliente del pedido ${order.public_code}`,
    });
    return list;
  }, [map, point, location?.element_id, nearby, order.public_code]);

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content
          className={styles.dialog}
          aria-describedby="staff-loc-desc"
          data-testid="staff-location"
        >
          <header className={styles.dialogHead}>
            <div className="grow">
              <Dialog.Title asChild>
                <h2>
                  Pedido <span className="num">#{order.public_code}</span>
                </h2>
              </Dialog.Title>
              <Dialog.Description id="staff-loc-desc" className="muted t-label">
                {location
                  ? describeLocation(location)
                  : "Sin ubicación marcada"}
              </Dialog.Description>
            </div>
            <StatusBadge tone={order.status === "ready" ? "brand" : "neutral"}>
              {statusLabels[order.status]}
            </StatusBadge>
            <Dialog.Close asChild>
              <button type="button" className="icon-btn" aria-label="Cerrar">
                <X size={20} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </header>
          <div className={styles.dialogMap}>
            {version.status === "loading" && (
              <div
                className="sk"
                style={{ height: "100%", minHeight: 240 }}
                aria-busy="true"
              />
            )}
            {version.status === "error" && (
              <Notice
                tone="danger"
                title="No pudimos cargar el plano"
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={version.reload}
                  >
                    Reintentar
                  </Button>
                }
              >
                {version.message}
              </Notice>
            )}
            {map && point && (
              <MapViewport
                imageUrl={mapImageUrl(map.image_path)}
                imageWidth={map.image_width}
                imageHeight={map.image_height}
                label={`Plano ${map.name}`}
                zones={map.layout.zones.map((z) => ({ ...z }))}
                markers={markers}
                focus={{
                  key: `${order.id}:${point.x}:${point.y}`,
                  point,
                  scale: 2.6,
                }}
              />
            )}
          </div>
          <div className={styles.dialogFoot}>
            {map && point && (
              <div className={styles.cardRow}>
                <div className="grow">
                  <strong>{location ? describeLocation(location) : ""}</strong>
                  <div className="muted t-label">
                    {map.name} · versión {map.version}
                    {location?.assigned_staff.length
                      ? ` · ${location.assigned_staff.join(", ")}`
                      : ""}
                  </div>
                </div>
              </div>
            )}
            {nearby.length > 0 && map && (
              <div>
                <div className="t-label muted">Puntos de referencia cerca</div>
                <ul className={styles.refs} data-testid="landmarks">
                  {nearby.map(({ element, distance }) => {
                    const Icon = elementIcons[element.type];
                    return (
                      <li key={element.id}>
                        <Icon size={16} aria-hidden="true" /> {element.label}
                        <span className="muted">
                          {" "}
                          ·{" "}
                          {proximityWord(distance, {
                            w: map.image_width,
                            h: map.image_height,
                          })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <Notice tone="neutral">
              <span className={styles.codeNote}>
                <ShieldCheck size={18} aria-hidden="true" />
                <span>
                  Para marcarlo como entregado, pedile al cliente su{" "}
                  <strong>QR o su código de 12 caracteres</strong> y validalo en
                  «Validar retiro». Sin esa validación el pedido no se puede
                  entregar.
                </span>
              </span>
            </Notice>
            {actions && <div className={styles.dialogActions}>{actions}</div>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
