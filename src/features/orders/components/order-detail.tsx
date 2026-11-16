"use client";
import { useState, useRef } from "react";
import Image from "next/image";
import { useLiveOrders } from "../use-live-orders";
import { statusLabels, paymentLabels } from "../types";
import { Button, Price, ErrorState } from "@/components/ui/primitives";
import { sendCommand } from "../client-api";
import { ReadySound } from "@/features/notifications/ready-sound";
export function OrderDetail({ id }: { id: string }) {
  const { order, orders, loading, error, connection, refresh } = useLiveOrders({
    orderId: id,
  });
  const [actionError, setActionError] = useState<{
    message: string;
    version: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const actionKey = useRef<string | null>(null);
  const act = async (action: string) => {
    if (!order || busy) return;
    setBusy(true);
    setActionError(null);
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
      setActionError({
        message: e instanceof Error ? e.message : "Error al consultar",
        version: order.version,
      });
      actionKey.current = null;
      refresh();
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
            ? "El local todavía no aceptó tu pedido. Podés cancelarlo mientras esperás."
            : order.status === "preparing"
              ? "La barra está preparando tu pedido."
              : order.status === "ready"
                ? "Tu pedido está listo. Acercate a la barra."
                : order.status === "delivered"
                  ? "La entrega quedó confirmada."
                  : order.status === "pending_authorization"
                    ? "Estamos confirmando el pedido. Todavía no entró a la cola."
                    : "La barra no continuará este pedido."}
        </p>
      </div>
      {order.status === "ready" && (
        <section className="ticket" aria-label="Ticket de retiro">
          <h2>{order.venue.pickup_label}</h2>
          {order.qr_data_url && (
            <p>
              <Image
                unoptimized
                src={order.qr_data_url}
                width={224}
                height={224}
                alt="QR de autorización de retiro"
              />
            </p>
          )}
          {order.pickup_code ? (
            <>
              <p className="muted">Código de retiro</p>
              <div className="code" data-private="pickup">
                {order.pickup_code.match(/.{1,4}/g)?.join(" ")}
              </div>
              {!order.qr_data_url && (
                <p role="status">
                  El QR no está disponible. La barra puede validar este código.
                </p>
              )}
              <p>Mostrá este ticket al retirar. No lo compartás.</p>
            </>
          ) : (
            <div role="alert">
              <p>
                No pudimos abrir tu ticket. Tu pedido sigue listo; volvé a
                consultar o pedí ayuda en la barra.
              </p>
              <Button variant="secondary" onClick={refresh}>
                Reintentar ticket
              </Button>
            </div>
          )}
        </section>
      )}
      <p className="muted financial-note">
        Demo · {financial.toLocaleLowerCase("es-CR")} ·{" "}
        <Price amount={order.total_minor} />. Sin dinero real.
      </p>
      {connection !== "Conectado" && connection !== "Sincronizado" && (
        <p className="muted" role="status">
          {connection}
        </p>
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
        {actionError && actionError.version === order.version && (
          <p role="alert" className="notice error">
            {actionError.message}
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
