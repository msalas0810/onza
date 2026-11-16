"use client";
import { useState, useRef } from "react";
import Image from "next/image";
import { useLiveOrders } from "../use-live-orders";
import { statusLabels, paymentLabels } from "../types";
import {
  Button,
  Price,
  StatusBadge,
  ErrorState,
} from "@/components/ui/primitives";
import { sendCommand } from "../client-api";
import { ReadySound } from "@/features/notifications/ready-sound";
export function OrderDetail({ id }: { id: string }) {
  const { order, orders, loading, error, connection, refresh } = useLiveOrders({
    orderId: id,
  });
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const actionKey = useRef<string | null>(null);
  const act = async (action: string) => {
    if (!order || busy) return;
    setBusy(true);
    try {
      actionKey.current ??= crypto.randomUUID();
      await sendCommand({
        action,
        orderId: order.id,
        expectedVersion: order.version,
        idempotencyKey: actionKey.current,
        reason: "Cancelación solicitada por cliente",
      });
      actionKey.current = null;
      refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error al consultar");
    } finally {
      setBusy(false);
    }
  };
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
      <ErrorState message="No encontramos este pedido en tu sesión. El código de retiro no recupera una sesión perdida." />
    );
  const financial =
    paymentLabels[order.payment_state] ?? "Estado de pago pendiente";
  return (
    <>
      <p className="eyebrow">
        {order.venue.name} · #{order.public_code}
      </p>
      <div aria-live="polite">
        <h1>{statusLabels[order.status]}</h1>
        <p>
          {order.status === "queued"
            ? "El local todavía no aceptó tu pedido. La reserva no equivale a preparación."
            : order.status === "preparing"
              ? "La barra está preparando tu pedido."
              : order.status === "ready"
                ? "Tu pedido está listo. Acercate a la barra."
                : order.status === "delivered"
                  ? "La entrega quedó confirmada."
                  : order.status === "pending_authorization"
                    ? "La reserva aún no está confirmada. Tu pedido no entró a la cola."
                    : "La barra no continuará este pedido."}
        </p>
        <StatusBadge
          tone={
            order.payment_state === "captured"
              ? "success"
              : order.payment_state === "unknown"
                ? "danger"
                : "neutral"
          }
        >
          {financial} · <Price amount={order.total_minor} />
        </StatusBadge>
      </div>
      <p className="muted" role="status">
        {connection}
      </p>
      {order.status === "ready" && order.qr_data_url && (
        <section className="ticket">
          <h2>{order.venue.pickup_label}</h2>
          <p>
            <Image
              unoptimized
              src={order.qr_data_url}
              width={224}
              height={224}
              alt="QR de autorización de retiro"
            />
          </p>
          <div className="code">{order.public_code}</div>
          <p>Retirá en {order.venue.pickup_label}.</p>
          <p className="muted">
            No compartás este ticket. Quien lo tenga puede recoger tu pedido.
          </p>
        </section>
      )}
      {order.payment_state === "unknown" && (
        <div className="notice error" role="alert">
          Resultado pendiente de conciliación. No iniciés otro pedido para
          intentar resolver esta reserva. Consultá al local.
        </div>
      )}
      <section className="stack">
        <h2>Tu pedido</h2>
        {order.items.map((i) => (
          <div key={i.id} className="row between">
            <span>
              {i.quantity} × {i.name_snapshot}
            </span>
            <Price amount={i.line_total_minor} />
          </div>
        ))}
        <div className="row between">
          <strong>Total final</strong>
          <Price amount={order.total_minor} />
        </div>
        <h2>Seguimiento</h2>
        <ol className="timeline">
          {order.events.map((e) => (
            <li key={e.id}>
              <span>
                {e.to_status && e.to_status in statusLabels
                  ? statusLabels[e.to_status as keyof typeof statusLabels]
                  : "Actualización del pedido"}
              </span>
              <br />
              <time className="muted" dateTime={e.created_at}>
                {new Date(e.created_at).toLocaleString("es-CR", {
                  timeZone: "America/Costa_Rica",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </li>
          ))}
        </ol>
        {order.status === "queued" && (
          <Button
            variant="danger"
            loading={busy}
            onClick={() => void act("cancel")}
          >
            Cancelar pedido
          </Button>
        )}
        {order.status === "pending_authorization" &&
          order.payment_state === "authorizing" && (
            <Button loading={busy} onClick={() => void act("authorize_action")}>
              Simular confirmación de reserva
            </Button>
          )}
        {actionError && (
          <p role="alert" className="notice error">
            {actionError}
          </p>
        )}
        <Button variant="secondary" onClick={refresh}>
          Actualizar estado
        </Button>
        <ReadySound orders={orders} />
        <h2>Ayuda del local</h2>
        <p>
          {order.venue.support_contact ||
            "Solicitá ayuda presencial en la barra."}
        </p>
      </section>
    </>
  );
}
