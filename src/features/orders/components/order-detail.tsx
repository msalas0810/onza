"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bell, ChevronLeft, Lock, MapPin, RefreshCw } from "lucide-react";
import { useLiveOrders } from "../use-live-orders";
import {
  statusLabels,
  orderStatusLabel,
  paymentLabels,
  orderSchema,
  type Order,
} from "../types";
import {
  Button,
  Price,
  ErrorState,
  Notice,
  StatusBadge,
} from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { sendCommand, CommandError, isSessionError } from "../client-api";
import { ReadySound } from "@/features/notifications/ready-sound";
import { OrderTimeline } from "./order-timeline";
import { formatClock } from "@/lib/clock";
import { SessionExpiredSheet } from "./session-expired-sheet";
import { ReconnectingBanner } from "@/components/ui/connection-banner";
import { EnjoyMoment } from "./enjoy";
import { SpotPicker } from "@/features/delivery/components/spot-picker";
import { writeSpotPreference } from "@/features/delivery/spot-preference";
import {
  deliveryOptionsSchema,
  offersLocation,
  spotText,
  yourSpot,
  type DeliveryOptions,
} from "@/features/delivery/types";

/** «¡Disfrutá!» una sola vez por pedido, y solo cerca de la entrega: en el historial queda el comprobante. */
function useEnjoyOnce(order: Order | undefined) {
  const [show, setShow] = useState(false);
  const id = order?.id;
  const deliveredAt = order?.status === "delivered" ? order.delivered_at : null;
  useEffect(() => {
    if (!id || !deliveredAt) return;
    const key = `onza-enjoy:${id}`;
    try {
      if (localStorage.getItem(key)) return;
      if (Date.now() - Date.parse(deliveredAt) > 30 * 60 * 1000) return;
      localStorage.setItem(key, "1");
    } catch {
      return;
    }
    const timer = setTimeout(() => setShow(true), 0);
    return () => clearTimeout(timer);
  }, [id, deliveredAt]);
  return show;
}

const tone = (status: Order["status"]) =>
  status === "ready"
    ? "brand"
    : status === "delivered"
      ? "success"
      : status === "preparing"
        ? "warning"
        : ["canceled", "expired", "uncollected"].includes(status)
          ? "danger"
          : "neutral";

/** Mantiene la pantalla encendida mientras se muestra el ticket (donde el navegador lo permite). Si falla, no pasa nada. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    navigator.wakeLock
      .request("screen")
      .then((sentinel) => {
        if (cancelled) void sentinel.release();
        else lock = sentinel;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}

export function OrderDetail({ id }: { id: string }) {
  const { order, orders, loading, error, connection, refresh, sessionExpired } =
    useLiveOrders({ orderId: id });
  const [notice, setNotice] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState<DeliveryOptions | "loading" | "error" | null>(null);
  const actionKey = useRef<string | null>(null);
  useWakeLock(order?.status === "ready" && !!order.pickup_code);
  const enjoy = useEnjoyOnce(order);
  const act = async (action: string) => {
    if (!order || busy) return;
    setBusy(true);
    setNotice("");
    try {
      actionKey.current ??= crypto.randomUUID();
      await sendCommand({
        action,
        orderId: order.id,
        expectedVersion: order.version,
        idempotencyKey: actionKey.current,
        reason: "Cancelación solicitada por cliente",
      });
    } catch (e) {
      if (isSessionError(e)) setExpired(true);
      else
        setNotice(
          e instanceof CommandError && e.code === "VERSION_CONFLICT"
            ? "El local ya aceptó tu pedido. Ya no se puede cancelar."
            : e instanceof Error
              ? e.message
              : "No pudimos completar la acción.",
        );
    } finally {
      actionKey.current = null;
      setBusy(false);
      setConfirmCancel(false);
      refresh();
    }
  };
  /** El cliente corrige su lugar mientras el pedido no se haya entregado. El servidor valida que sea de este local. */
  const openMove = async () => {
    if (!order) return;
    setMoving("loading");
    try {
      const response = await fetch(`/api/delivery?venue=${order.venue_id}`, { cache: "no-store" });
      if (!response.ok) throw new Error("delivery");
      setMoving(deliveryOptionsSchema.parse(await response.json()));
    } catch {
      setMoving("error");
    }
  };
  const moveTo = async (spotId: string) => {
    if (!order || busy) return;
    setBusy(true);
    setNotice("");
    try {
      orderSchema.parse(await sendCommand({ action: "order_change_spot", orderId: order.id, spotId }));
      writeSpotPreference(order.venue_id, spotId);
      setMoving(null);
    } catch (e) {
      if (isSessionError(e)) setExpired(true);
      else {
        setMoving(null);
        setNotice(e instanceof Error ? e.message : "No pudimos cambiar tu lugar.");
      }
    } finally {
      setBusy(false);
      refresh();
    }
  };
  if (sessionExpired || expired)
    return <SessionExpiredSheet open next={`/orders/${id}`} />;
  if (loading) return <p role="status">Consultando tu pedido…</p>;
  if (error)
    return (
      <ErrorState message={error}>
        <Button variant="secondary" onClick={refresh}>
          Volver a consultar
        </Button>
      </ErrorState>
    );
  if (!order)
    return (
      <ErrorState message="No encontramos este pedido en tu cuenta.">
        <Link className="btn secondary" href="/orders">
          Mis pedidos
        </Link>
      </ErrorState>
    );
  const financial =
    paymentLabels[order.payment_state] ?? "Estado de pago pendiente";
  const ready = order.status === "ready";
  const toLocation = order.fulfillment === "location";
  const noun = order.venue.spot_noun ?? "Mesa";
  const canMove =
    toLocation &&
    ["pending_authorization", "queued", "preparing", "ready"].includes(order.status);
  return (
    <>
      <Link className="back" href="/orders">
        <ChevronLeft size={16} aria-hidden="true" />
        Pedidos
      </Link>
      <ReconnectingBanner show={/Reconect/.test(connection)} />
      <div className="page-head">
        <p className="eyebrow">{order.venue.name}</p>
        <div className="row between">
          <h1 className="t-title num">#{order.public_code}</h1>
          <StatusBadge tone={tone(order.status)}>
            {orderStatusLabel(order)}
          </StatusBadge>
        </div>
      </div>
      <div className="stack" aria-live="polite">
        {notice && <Notice tone="warning">{notice}</Notice>}
        {ready && (
          <div className="ready-head" role="status">
            <Bell size={24} className="anim-bell" aria-hidden="true" />
            <div className="grow">
              <h2>{toLocation ? "Listo: te lo llevamos" : "Listo para retirar"}</h2>
              <span className="t-label">
                {toLocation
                  ? `Va a ${spotText(order)}. Mostrá el QR o el código al equipo cuando llegue.`
                  : `Mostrá el código o el QR en ${order.venue.pickup_label}.`}
              </span>
            </div>
          </div>
        )}
        {canMove && (
          <div className="spot-here">
            <MapPin size={20} aria-hidden="true" />
            <div className="grow">
              <strong>Entrega en {spotText(order)}</strong>
              <span className="muted t-label">
                {order.spot_changed_at
                  ? `Lugar actualizado a las ${formatClock(order.spot_changed_at).replace(/\.$/, "")}.`
                  : `¿No estás ahí? Cambiá ${yourSpot(noun)} hasta que llegue.`}
              </span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void openMove()}>
              Cambiar
            </Button>
          </div>
        )}
        {ready && (
          <section className="ticket" aria-label="Ticket de retiro">
            <div>
              <div className="small">{toLocation ? "Te lo llevamos a" : "Retirá en"}</div>
              <div className="where">
                {toLocation ? spotText(order) : order.venue.pickup_label}
              </div>
            </div>
            {order.qr_data_url && (
              <div className="qr">
                <Image
                  unoptimized
                  src={order.qr_data_url}
                  width={184}
                  height={184}
                  alt="QR de autorización de retiro"
                />
              </div>
            )}
            {order.pickup_code ? (
              <>
                <div>
                  <div className="small private-label">
                    <Lock size={14} aria-hidden="true" />
                    Código privado
                  </div>
                  <div
                    className="code num"
                    data-private="pickup"
                    aria-label={`Código ${order.pickup_code.split("").join(" ")}`}
                  >
                    {order.pickup_code.match(/.{1,4}/g)?.map((group) => (
                      <span key={group}>{group}</span>
                    ))}
                  </div>
                </div>
                {!order.qr_data_url && (
                  <p role="status" className="small">
                    El QR no está disponible. La barra puede validar este
                    código.
                  </p>
                )}
                <details className="ticket-help">
                  <summary>¿Cómo se usa?</summary>
                  <p className="small">
                    Mostrá el QR o decí el código {toLocation ? "al equipo cuando llegue a tu lugar" : "en la barra"}. El número
                    #{order.public_code} identifica el pedido pero no sirve para
                    {toLocation ? " recibirlo" : " retirar"}. No compartas este código.
                  </p>
                </details>
              </>
            ) : (
              <div role="alert">
                <p className="small">
                  No pudimos abrir tu ticket. Tu pedido sigue listo; volvé a
                  consultar o pedí ayuda en la barra.
                </p>
                <Button
                  variant="secondary"
                  onClick={refresh}
                  style={{ marginTop: 12 }}
                >
                  Reintentar ticket
                </Button>
              </div>
            )}
          </section>
        )}
        {order.status === "canceled" && (
          <Notice tone="danger" title="Pedido cancelado">
            La barra no continuará este pedido.
          </Notice>
        )}
        {["expired", "uncollected"].includes(order.status) && (
          <Notice tone="danger" title={statusLabels[order.status]}>
            {order.status === "expired"
              ? "El local no lo aceptó a tiempo y la reserva se anuló."
              : "No se retiró a tiempo y la reserva se anuló."}
          </Notice>
        )}
        {order.status === "delivered" &&
          (enjoy ? (
            <EnjoyMoment
              venueName={order.venue.name}
              where={
                toLocation
                  ? `${spotText(order)}${order.delivered_at ? ` a las ${formatClock(order.delivered_at)}` : ""}`
                  : undefined
              }
              menuHref={
                order.venue.slug && order.venue.open_state !== "closed"
                  ? `/v/${order.venue.slug}`
                  : null
              }
            />
          ) : (
            <Notice tone="success" title="Entregado · comprobante">
              {toLocation
                ? order.delivered_at
                  ? `Entregado en ${spotText(order)} a las ${formatClock(order.delivered_at)}.`
                  : `Entregado en ${spotText(order)}.`
                : order.delivered_at
                  ? `Retirado a las ${formatClock(order.delivered_at)}.`
                  : "Pedido retirado."}
            </Notice>
          ))}
        {order.status === "pending_authorization" && (
          <Notice title="Confirmando pedido">
            Todavía no entró a la cola del local.
          </Notice>
        )}
        {!ready &&
          ["queued", "preparing", "delivered"].includes(order.status) && (
            <OrderTimeline order={order} />
          )}
        {["queued", "preparing"].includes(order.status) && (
          <ReadySound orders={orders} />
        )}
        <div className="lines">
          {order.items.map((i) => (
            <div key={i.id} className="line">
              <span className="q">{i.quantity}×</span>
              <span>{i.name_snapshot}</span>
              <span className="amt">
                <Price amount={i.line_total_minor} />
              </span>
            </div>
          ))}
        </div>
        <div className="total-row">
          <span>Total</span>
          <Price amount={order.total_minor} />
        </div>
        <p className="hint">
          {financial} · simulado
        </p>
        {order.payment_state === "unknown" && (
          <Notice tone="danger" title="Resultado pendiente de conciliación">
            No inicies otro pedido para resolver esta reserva. Consultá al
            local.
          </Notice>
        )}
        {order.status === "pending_authorization" &&
          order.payment_state === "authorizing" && (
            <Button loading={busy} onClick={() => void act("authorize_action")}>
              Simular confirmación de reserva
            </Button>
          )}
        {order.status === "queued" && (
          <Button variant="danger" block onClick={() => setConfirmCancel(true)}>
            Cancelar pedido
          </Button>
        )}
        <Button variant="quiet" onClick={refresh} aria-label="Actualizar estado del pedido">
          <RefreshCw size={18} aria-hidden="true" />
          Actualizar estado
        </Button>
        <p className="hint">
          Ayuda del local:{" "}
          {order.venue.support_contact ||
            "solicitá ayuda presencial en la barra."}
        </p>
      </div>
      <Sheet
        open={moving !== null}
        onOpenChange={(open) => !open && setMoving(null)}
        title="¿Dónde estás ahora?"
        description={`Elegí ${yourSpot(noun)}. El equipo ve el cambio al instante.`}
      >
        {moving === "loading" && <p role="status">Cargando lugares…</p>}
        {moving === "error" && (
          <Notice tone="danger" title="No pudimos cargar los lugares">
            Volvé a intentar en unos segundos.
          </Notice>
        )}
        {moving && typeof moving === "object" && offersLocation(moving.mode) && (
          <SpotPicker
            spots={moving.spots}
            noun={moving.noun}
            value={order.spot_id ?? null}
            name="move-spot"
            onChange={(spot) => void moveTo(spot)}
          />
        )}
      </Sheet>
      <Sheet
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={`¿Cancelar #${order.public_code}?`}
        description="El local todavía no lo aceptó. Si lo acepta antes, ya no se puede cancelar."
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
              Volver
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() => void act("cancel")}
            >
              Sí, cancelar pedido
            </Button>
          </>
        }
      />
    </>
  );
}
