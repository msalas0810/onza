"use client";
import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useLiveOrders } from "@/features/orders/use-live-orders";
import { sendCommand } from "@/features/orders/client-api";
import { Button, EmptyState } from "@/components/ui/primitives";
import { PickupPanel } from "@/features/pickup/components/pickup-panel";
import type { Venue } from "@/features/catalog/server/queries";
const ScanSheet = dynamic(
  () => import("@/features/pickup/components/scan-sheet"),
  { ssr: false },
);
const lanes = [
  ["queued", "Nuevos"],
  ["preparing", "Preparando"],
  ["ready", "Listos"],
] as const;
export function StaffQueue({ venue }: { venue: Venue }) {
  const { orders, loading, error, connection, refresh } = useLiveOrders({
    venueId: venue.id,
  });
  const [tab, setTab] = useState("queued");
  const [actionError, setActionError] = useState("");
  const [errorOrder, setErrorOrder] = useState<{
    id: string;
    version: number;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [paused, setPaused] = useState(venue.paused);
  const [scan, setScan] = useState(false);
  const [credential, setCredential] = useState<string | null>(null);
  const [resumeOrderId, setResumeOrderId] = useState<string | null>(null);
  const [pickupRevision, setPickupRevision] = useState(0);
  const pickupInput = useRef<HTMLElement | null>(null);
  const handleScanResult = useCallback((value: string) => {
    setResumeOrderId(null);
    setPickupRevision((n) => n + 1);
    setCredential(value);
    setScan(false);
  }, []);
  const keys = useRef(new Map<string, string>());
  const lock = useRef(false);
  const act = async (
    orderId: string,
    action: "accept" | "ready" | "cancel",
  ) => {
    if (lock.current) return;
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    let reason: string | undefined;
    if (action === "cancel") {
      reason =
        prompt("Motivo de rechazo/cancelación (mínimo 3 caracteres)") ??
        undefined;
      if (!reason || reason.trim().length < 3) return;
    }
    lock.current = true;
    setBusy(orderId);
    setActionError("");
    const key = `${order.id}:${action}:${order.version}`;
    if (!keys.current.has(key)) keys.current.set(key, crypto.randomUUID());
    try {
      await sendCommand({
        action,
        orderId,
        expectedVersion: order.version,
        idempotencyKey: keys.current.get(key),
        reason,
      });
      keys.current.delete(key);
      refresh();
    } catch (e) {
      refresh();
      setErrorOrder({ id: order.id, version: order.version });
      setActionError(
        e instanceof Error ? e.message : "No pudimos completar la acción.",
      );
    } finally {
      setBusy(null);
      lock.current = false;
    }
  };
  const active = orders.filter((o) =>
    ["queued", "preparing", "ready"].includes(o.status),
  );
  const incidents = orders.filter(
    (o) =>
      (o.payment_state === "captured" || o.payment_state === "unknown") &&
      o.status !== "delivered" &&
      o.status !== "canceled",
  );
  return (
    <>
      <div className="row between wrap">
        <div>
          <p className="eyebrow">Barra · {venue.pickup_label}</p>
          <h1>{venue.name}</h1>
          <p role="status" className="muted">
            {connection} · {active.length} pedidos activos
          </p>
        </div>
        <div className="row wrap">
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await sendCommand({
                  action: "venue_update",
                  venueId: venue.id,
                  paused: !paused,
                });
                setPaused(!paused);
              } catch (e) {
                setActionError(
                  e instanceof Error
                    ? e.message
                    : "No pudimos cambiar la pausa.",
                );
              }
            }}
          >
            {paused ? "Reanudar pedidos" : "Pausar pedidos"}
          </Button>
          <Button onClick={() => setScan(true)}>Escanear retiro</Button>
        </div>
      </div>
      {paused && (
        <p className="notice warning">
          Pedidos pausados. Continuá atendiendo la cola actual.
        </p>
      )}
      {(error ||
        (actionError &&
          (!errorOrder ||
            orders.some(
              (o) => o.id === errorOrder.id && o.version === errorOrder.version,
            )))) && (
        <p role="alert" className="notice error">
          {error || actionError}
        </p>
      )}
      <div
        className="staff-mobile-tabs tabs"
        role="tablist"
        aria-label="Cola de pedidos"
      >
        {lanes.map(([state, label]) => (
          <button
            key={state}
            role="tab"
            aria-selected={tab === state}
            onClick={() => setTab(state)}
          >
            {label} · {orders.filter((o) => o.status === state).length}
          </button>
        ))}
      </div>
      {loading && <p>Consultando la cola…</p>}
      <div className="queue">
        {lanes.map(([state, label]) => (
          <section
            key={state}
            className={`queue-lane ${tab === state ? "mobile-active" : ""}`}
          >
            <h2>
              {label}{" "}
              <span className="muted">
                {orders.filter((o) => o.status === state).length}
              </span>
            </h2>
            {orders
              .filter((o) => o.status === state)
              .sort((a, b) => a.created_at.localeCompare(b.created_at))
              .map((o) => (
                <article key={o.id} className="order-card">
                  <div className="row between">
                    <h2>#{o.public_code}</h2>
                    <time dateTime={o.created_at}>
                      {new Date(o.created_at).toLocaleTimeString("es-CR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "America/Costa_Rica",
                      })}
                    </time>
                  </div>
                  <p className="muted">
                    Recibido hace{" "}
                    {Math.max(
                      0,
                      Math.floor(
                        (Date.now() - new Date(o.created_at).getTime()) / 60000,
                      ),
                    )}{" "}
                    min
                  </p>
                  <ul>
                    {o.items.map((i) => (
                      <li key={i.id}>
                        {i.quantity} × {i.name_snapshot}
                      </li>
                    ))}
                  </ul>
                  <div className="stack">
                    {state === "queued" && (
                      <Button
                        loading={busy === o.id}
                        onClick={() => void act(o.id, "accept")}
                      >
                        Aceptar y preparar
                      </Button>
                    )}
                    {state === "preparing" && (
                      <Button
                        loading={busy === o.id}
                        onClick={() => void act(o.id, "ready")}
                      >
                        Marcar listo
                      </Button>
                    )}
                    {state === "ready" && (
                      <Button
                        onClick={() => {
                          setCredential(null);
                          setResumeOrderId(null);
                          setPickupRevision((n) => n + 1);
                          pickupInput.current?.scrollIntoView({
                            block: "start",
                          });
                          pickupInput.current
                            ?.querySelector("input")
                            ?.focus({ preventScroll: true });
                        }}
                      >
                        Validar retiro
                      </Button>
                    )}
                    {state === "queued" && (
                      <Button
                        variant="danger"
                        loading={busy === o.id}
                        onClick={() => void act(o.id, "cancel")}
                      >
                        Rechazar pedido
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            {!orders.some((o) => o.status === state) && (
              <EmptyState title="Sin pedidos">
                La cola se actualiza automáticamente.
              </EmptyState>
            )}
          </section>
        ))}
      </div>
      {incidents.length > 0 && (
        <section className="stack">
          <h2>Incidencias de cobro / entrega</h2>
          {incidents.map((o) => (
            <div className="notice" key={o.id}>
              <h3>#{o.public_code}</h3>
              <p>
                {o.payment_state === "captured"
                  ? "Cobrado, entrega pendiente. Retomá el retiro sin volver a cobrar."
                  : "Resultado sin confirmar. Conservá el responsable del retiro."}
              </p>
              {o.claim_id && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCredential(null);
                    setResumeOrderId(o.id);
                    setPickupRevision((n) => n + 1);
                    pickupInput.current?.scrollIntoView({ block: "start" });
                  }}
                >
                  Retomar retiro validado
                </Button>
              )}
            </div>
          ))}
        </section>
      )}
      <section className="stack" ref={pickupInput}>
        <h2>Retiro con código</h2>
        <p className="muted">
          Escaneá el QR del cliente o pedile su código de retiro. El número del
          pedido no autoriza la entrega.
        </p>
        <PickupPanel
          key={pickupRevision}
          venueId={venue.id}
          credential={credential}
          resumeOrderId={resumeOrderId}
          onChanged={refresh}
        />
      </section>
      {scan && (
        <ScanSheet onClose={() => setScan(false)} onResult={handleScanResult} />
      )}
      <div className="stack">
        <h2>Historial reciente</h2>
        {orders
          .filter((o) =>
            ["delivered", "canceled", "expired", "uncollected"].includes(
              o.status,
            ),
          )
          .slice(0, 20)
          .map((o) => (
            <p key={o.id}>
              #{o.public_code} ·{" "}
              {o.status === "delivered" ? "Entregado" : "Cerrado"}
            </p>
          ))}
        <Link className="link-button" href="/login">
          Cambiar espacio de trabajo
        </Link>
      </div>
    </>
  );
}
