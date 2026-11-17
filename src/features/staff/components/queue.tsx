"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Clock, History, ScanLine, Volume2, VolumeX } from "lucide-react";
import { useLiveOrders } from "@/features/orders/use-live-orders";
import {
  sendCommand,
  CommandError,
  isSessionError,
} from "@/features/orders/client-api";
import type { Order } from "@/features/orders/types";
import {
  Button,
  EmptyState,
  Notice,
  StatusBadge,
  Toggle,
  buttonClass,
} from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { ReconnectingBanner } from "@/components/ui/connection-banner";
import { SessionExpiredSheet } from "@/features/orders/components/session-expired-sheet";
import { PickupPanel } from "@/features/pickup/components/pickup-panel";
import { useOnline } from "@/lib/use-online";
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
const FINAL = ["delivered", "canceled", "expired", "uncollected"];
const rejectReasons = [
  "Sin stock",
  "No podemos prepararlo ahora",
  "Pedido duplicado",
  "Otro motivo",
] as const;

const minutesSince = (iso: string, now: number) =>
  Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));

/** Reloj para los minutos de espera: se actualiza solo, sin pedir datos nuevos. */
function useNow(interval = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [interval]);
  return now;
}

export function StaffQueue({ venue }: { venue: Venue }) {
  const {
    orders,
    loading,
    error,
    connection,
    refresh,
    sessionExpired,
    access,
  } = useLiveOrders({ venueId: venue.id });
  const online = useOnline();
  const now = useNow();
  const [tab, setTab] = useState<string>("queued");
  const [cardErrors, setCardErrors] = useState<
    Record<string, { message: string; version: number }>
  >({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [paused, setPaused] = useState(venue.paused);
  const [scan, setScan] = useState(false);
  const [pickup, setPickup] = useState(false);
  const [credential, setCredential] = useState<string | null>(null);
  const [resumeOrderId, setResumeOrderId] = useState<string | null>(null);
  const [pickupRevision, setPickupRevision] = useState(0);
  const [rejecting, setRejecting] = useState<Order | null>(null);
  const [reason, setReason] = useState<string>(rejectReasons[0]);
  const [detail, setDetail] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [sound, setSound] = useState(false);
  const [expired, setExpired] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const keys = useRef(new Map<string, string>());
  const lock = useRef(false);

  // Pedido nuevo: se resalta dos segundos y, con el sonido activado (tras un gesto), suena un tono corto.
  useEffect(() => {
    if (loading) return;
    const ids = new Set(orders.map((o) => o.id));
    if (seen.current === null) {
      seen.current = ids;
      return;
    }
    const known = seen.current;
    const added = orders.filter(
      (o) => o.status === "queued" && !known.has(o.id),
    );
    seen.current = ids;
    if (!added.length) return;
    const timer = setTimeout(() => {
      setFresh((current) => new Set([...current, ...added.map((o) => o.id)]));
      if (sound && audio.current?.state === "running") {
        const osc = audio.current.createOscillator();
        const gain = audio.current.createGain();
        osc.connect(gain);
        gain.connect(audio.current.destination);
        osc.frequency.value = 660;
        gain.gain.setValueAtTime(0.08, audio.current.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          audio.current.currentTime + 0.3,
        );
        osc.start();
        osc.stop(audio.current.currentTime + 0.3);
      }
    }, 0);
    const clear = setTimeout(() => setFresh(new Set()), 2400);
    return () => {
      clearTimeout(timer);
      clearTimeout(clear);
    };
  }, [orders, loading, sound]);
  useEffect(
    () => () => {
      void audio.current?.close();
    },
    [],
  );

  const openPickup = (options: { resume?: string } = {}) => {
    setCredential(null);
    setResumeOrderId(options.resume ?? null);
    setPickupRevision((n) => n + 1);
    setPickup(true);
  };
  const act = async (
    order: Order,
    action: "accept" | "ready" | "cancel",
    why?: string,
  ) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(order.id);
    setNotice("");
    const key = `${order.id}:${action}:${order.version}`;
    if (!keys.current.has(key)) keys.current.set(key, crypto.randomUUID());
    try {
      await sendCommand({
        action,
        orderId: order.id,
        expectedVersion: order.version,
        idempotencyKey: keys.current.get(key),
        reason: why,
      });
      keys.current.delete(key);
      setCardErrors((current) => {
        const { [order.id]: _removed, ...rest } = current;
        void _removed;
        return rest;
      });
    } catch (e) {
      if (isSessionError(e)) setExpired(true);
      else if (e instanceof CommandError && e.code === "VERSION_CONFLICT")
        setNotice(
          `#${order.public_code} cambió en otro dispositivo o el cliente lo canceló. Mostramos su estado actual.`,
        );
      else
        setCardErrors((current) => ({
          ...current,
          [order.id]: {
            message:
              e instanceof Error
                ? e.message
                : "No pudimos completar la acción.",
            version: order.version,
          },
        }));
    } finally {
      refresh();
      setBusy(null);
      lock.current = false;
    }
  };
  const submitReject = async () => {
    if (!rejecting) return;
    const text =
      reason === "Otro motivo"
        ? detail.trim()
        : `${reason}${detail.trim() ? `: ${detail.trim()}` : ""}`;
    if (text.length < 3) {
      setReasonError("Escribí un motivo de al menos 3 caracteres.");
      return;
    }
    const order = rejecting;
    setRejecting(null);
    setDetail("");
    setReason(rejectReasons[0]);
    await act(order, "cancel", text);
  };
  async function toggleSound(next: boolean) {
    if (!next) return setSound(false);
    try {
      const context = audio.current ?? new AudioContext();
      audio.current = context;
      await context.resume();
      setSound(context.state === "running");
    } catch {
      setSound(false);
    }
  }

  if (sessionExpired || expired)
    return (
      <SessionExpiredSheet open area="equipo" next={`/staff/${venue.id}`} />
    );
  if (access !== "ok")
    return (
      <EmptyState
        title={
          access === "password"
            ? "Cambiá tu contraseña temporal"
            : "Ya no tenés acceso a este local"
        }
        action={
          <Link
            className={buttonClass({ variant: "secondary" })}
            href={access === "password" ? "/equipo/clave" : "/equipo/locales"}
          >
            {access === "password" ? "Cambiar contraseña" : "Ver mis locales"}
          </Link>
        }
      >
        {access === "password"
          ? "Hasta cambiarla no podés operar."
          : "Si es un error, pedile al administrador del local que te dé acceso."}
      </EmptyState>
    );

  const active = orders.filter((o) =>
    ["queued", "preparing", "ready"].includes(o.status),
  );
  const waiting = orders.filter((o) =>
    ["queued", "preparing"].includes(o.status),
  );
  const longest = waiting.length
    ? Math.max(...waiting.map((o) => minutesSince(o.created_at, now)))
    : 0;
  const incidents = orders.filter(
    (o) =>
      (o.payment_state === "captured" || o.payment_state === "unknown") &&
      o.status !== "delivered" &&
      o.status !== "canceled",
  );
  const closed = orders.filter((o) => FINAL.includes(o.status)).slice(0, 20);
  const closedVenue = venue.open_state === "closed";
  return (
    <>
      <ReconnectingBanner show={/Reconect/.test(connection)} />
      <div className="board-head">
        <div className="grow">
          <h1 className="t-title">Barra</h1>
          <p className="muted t-label" role="status">
            {venue.pickup_label}
            {waiting.length > 0 && (
              <>
                {" "}
                · Espera más larga{" "}
                <strong className="num">{longest} min</strong>
              </>
            )}
            {!active.length && !loading && " · Sin pedidos activos"}
          </p>
        </div>
        <button
          type="button"
          className="btn secondary sm"
          aria-pressed={sound}
          aria-label={`Sonido de pedidos nuevos: ${sound ? "activado" : "desactivado"}`}
          onClick={() => void toggleSound(!sound)}
        >
          {sound ? (
            <Volume2 size={16} aria-hidden="true" />
          ) : (
            <VolumeX size={16} aria-hidden="true" />
          )}
          <span>Sonido</span>
        </button>
        {closedVenue ? (
          <StatusBadge>Cerrado por el administrador</StatusBadge>
        ) : (
          <Toggle
            label="Recibiendo pedidos"
            checked={!paused}
            disabled={!online}
            onChange={async (receiving) => {
              try {
                await sendCommand({
                  action: "venue_update",
                  venueId: venue.id,
                  paused: !receiving,
                });
                setPaused(!receiving);
              } catch (e) {
                if (isSessionError(e)) setExpired(true);
                else
                  setNotice(
                    e instanceof Error
                      ? e.message
                      : "No pudimos cambiar la pausa.",
                  );
              }
            }}
          />
        )}
        <Button size="lg" disabled={!online} onClick={() => openPickup()}>
          <ScanLine size={20} aria-hidden="true" />
          Validar retiro
        </Button>
      </div>
      <div className="stack" style={{ marginBottom: 16 }}>
        {paused && !closedVenue && (
          <Notice tone="warning" title="Pedidos pausados">
            Los clientes ven el local en pausa y no pueden pedir. Seguí con la
            cola actual.
          </Notice>
        )}
        {(error || notice) && (
          <Notice tone={error ? "danger" : "warning"}>{error || notice}</Notice>
        )}
      </div>
      <div
        className="tabs board-tabs"
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
            {label}
            <span className="n">
              {orders.filter((o) => o.status === state).length}
            </span>
          </button>
        ))}
      </div>
      {loading && (
        <div
          className="stack"
          aria-busy="true"
          aria-label="Consultando la cola"
        >
          <div className="sk" style={{ height: 160 }} />
        </div>
      )}
      <div className="board">
        {lanes.map(([state, label]) => {
          const list = orders
            .filter((o) => o.status === state)
            .sort((a, b) => a.created_at.localeCompare(b.created_at));
          return (
            <section
              key={state}
              className="col"
              hidden={tab !== state}
              aria-label={label}
            >
              <div className="col-head">
                <h2>{label}</h2>
                <span className="count-pill">{list.length}</span>
              </div>
              <div className="col col-scroll">
                {list.map((o) => {
                  const minutes = minutesSince(
                    state === "ready"
                      ? (o.ready_at ?? o.created_at)
                      : o.created_at,
                    now,
                  );
                  const late = state !== "ready" && minutes >= 10;
                  const failure = cardErrors[o.id];
                  const disabled = !online || busy === o.id;
                  return (
                    <article
                      key={o.id}
                      className={`ocard ${fresh.has(o.id) ? "new" : ""}`}
                      aria-label={`Pedido ${o.public_code}`}
                    >
                      <div className="row between">
                        <span className="num">#{o.public_code}</span>
                        <span className={`wait ${late ? "late" : ""}`}>
                          <Clock size={16} aria-hidden="true" />
                          {state === "ready"
                            ? `Listo hace ${minutes} min`
                            : `Espera ${minutes} min`}
                        </span>
                      </div>
                      <ul className="items">
                        {o.items.map((i) => (
                          <li key={i.id}>
                            <span className="q">{i.quantity}×</span>{" "}
                            {i.name_snapshot}
                          </li>
                        ))}
                      </ul>
                      <div className="by">
                        {o.items.reduce((n, i) => n + i.quantity, 0)} productos
                      </div>
                      {failure && failure.version === o.version && (
                        <p className="inline-error" role="alert">
                          {failure.message}
                        </p>
                      )}
                      {state === "queued" && (
                        <div className="acts">
                          <Button
                            variant="danger"
                            size="lg"
                            disabled={disabled}
                            onClick={() => {
                              setReasonError("");
                              setRejecting(o);
                            }}
                          >
                            Rechazar
                          </Button>
                          <Button
                            size="lg"
                            loading={busy === o.id}
                            disabled={!online}
                            onClick={() => void act(o, "accept")}
                          >
                            Aceptar
                          </Button>
                        </div>
                      )}
                      {state === "preparing" && (
                        <div className="acts one">
                          <Button
                            size="lg"
                            loading={busy === o.id}
                            disabled={!online}
                            onClick={() => void act(o, "ready")}
                          >
                            Marcar listo
                          </Button>
                        </div>
                      )}
                      {state === "ready" && (
                        <div className="acts one">
                          <Button
                            variant="secondary"
                            size="lg"
                            disabled={!online}
                            onClick={() => openPickup()}
                          >
                            <ScanLine size={20} aria-hidden="true" />
                            Validar retiro
                          </Button>
                        </div>
                      )}
                    </article>
                  );
                })}
                {!list.length && !loading && (
                  <p className="muted t-label" style={{ padding: "16px 0" }}>
                    {state === "queued"
                      ? "Sin pedidos nuevos."
                      : state === "preparing"
                        ? "Nada en preparación."
                        : "Nada esperando retiro."}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {incidents.length > 0 && (
        <section className="stack" style={{ marginTop: 32 }}>
          <h2>Incidencias de cobro o entrega</h2>
          {incidents.map((o) => (
            <Notice
              key={o.id}
              tone="warning"
              title={`#${o.public_code}`}
              action={
                o.claim_id ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openPickup({ resume: o.id })}
                  >
                    Retomar retiro validado
                  </Button>
                ) : undefined
              }
            >
              {o.payment_state === "captured"
                ? "Cobrado, entrega pendiente. Retomá el retiro sin volver a cobrar."
                : "Resultado sin confirmar. Conservá el responsable del retiro."}
            </Notice>
          ))}
        </section>
      )}
      {closed.length > 0 && (
        <details style={{ marginTop: 32 }}>
          <summary
            className="t-label"
            style={{
              cursor: "pointer",
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <History size={16} aria-hidden="true" />
            Cerrados hoy ({closed.length})
          </summary>
          <div className="rows" style={{ marginTop: 8 }}>
            {closed.map((o) => (
              <div className="r" key={o.id}>
                <span className="num" style={{ fontWeight: 600 }}>
                  #{o.public_code}
                </span>
                <span className="grow sub">
                  {o.items
                    .map((i) => `${i.quantity}× ${i.name_snapshot}`)
                    .join(", ")}
                </span>
                <StatusBadge
                  tone={o.status === "delivered" ? "success" : "danger"}
                >
                  {o.status === "delivered" ? "Entregado" : "Cerrado"}
                </StatusBadge>
              </div>
            ))}
          </div>
        </details>
      )}
      <Sheet
        open={pickup}
        onOpenChange={(open) => {
          setPickup(open);
          if (!open) refresh();
        }}
        title="Validar retiro"
        description="Pedí el código privado al cliente o escaneá su QR. El número del pedido no autoriza la entrega."
      >
        <PickupPanel
          key={pickupRevision}
          venueId={venue.id}
          credential={credential}
          resumeOrderId={resumeOrderId}
          onChanged={refresh}
          onScan={() => setScan(true)}
        />
      </Sheet>
      {scan && (
        <ScanSheet
          onClose={() => setScan(false)}
          onResult={(value) => {
            setResumeOrderId(null);
            setPickupRevision((n) => n + 1);
            setCredential(value);
            setScan(false);
          }}
        />
      )}
      <Sheet
        open={!!rejecting}
        onOpenChange={(open) => !open && setRejecting(null)}
        title={
          rejecting ? `Rechazar #${rejecting.public_code}` : "Rechazar pedido"
        }
        description="El cliente ve el motivo."
        actions={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Volver
            </Button>
            <Button variant="danger" onClick={() => void submitReject()}>
              Rechazar pedido
            </Button>
          </>
        }
      >
        <fieldset
          className="stack tight"
          style={{ border: 0, padding: 0, margin: 0 }}
        >
          <legend
            className="t-label"
            style={{ marginBottom: 8, fontWeight: 500 }}
          >
            Motivo
          </legend>
          {rejectReasons.map((r) => (
            <label className="toggle" key={r}>
              <input
                type="radio"
                name="reject-reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                style={{ width: 20, height: 20 }}
              />
              <span className="grow">{r}</span>
            </label>
          ))}
        </fieldset>
        <label className="field" style={{ marginTop: 16 }}>
          <span>
            {reason === "Otro motivo" ? "Detalle" : "Detalle (opcional)"}
          </span>
          <textarea
            value={detail}
            aria-invalid={!!reasonError}
            onChange={(e) => {
              setDetail(e.target.value);
              setReasonError("");
            }}
          />
          {reasonError && (
            <span role="alert" className="field-error">
              {reasonError}
            </span>
          )}
        </label>
      </Sheet>
    </>
  );
}
