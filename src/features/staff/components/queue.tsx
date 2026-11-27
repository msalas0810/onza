"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clock, History, MapPin, ScanLine, Settings2 } from "lucide-react";
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
import {
  PickupPanel,
  startCamera,
} from "@/features/pickup/components/pickup-panel";
import { ProductImage } from "@/features/catalog/components/product-image";
import { productImageSrc } from "@/features/catalog/product-image-src";
import { LogoutButton } from "@/features/account/components/account-actions";
import { useOnline } from "@/lib/use-online";
import { formatClock } from "@/lib/clock";
import { countdownText } from "@/features/orders/countdown";
import type React from "react";
import type { Venue } from "@/features/catalog/server/queries";
import { placePhrase, spotText } from "@/features/delivery/types";
import { OrderMapButton } from "@/features/delivery/components/order-map-button";

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
const countdown = countdownText;
const clockTime = formatClock;

/** Reloj para los minutos de espera: se actualiza solo, sin pedir datos nuevos. */
function useNow(interval = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [interval]);
  return now;
}

export function StaffQueue({
  venue,
  role = "bartender",
  canSwitch = false,
}: {
  venue: Venue;
  role?: "admin" | "bartender" | "onza";
  canSwitch?: boolean;
}) {
  const {
    orders,
    loading,
    error,
    connection,
    refresh,
    sessionExpired,
    access,
    clockOffset,
  } = useLiveOrders({ venueId: venue.id });
  const online = useOnline();
  const hasNew = orders.some((o) => o.status === "queued");
  // Con pedidos nuevos el reloj avanza cada segundo para la cuenta regresiva; si no, cada 30 s.
  const deviceNow = useNow(hasNew ? 1000 : 30000);
  const now = deviceNow + clockOffset;
  const [tab, setTab] = useState<string>("queued");
  // Zona que atiende esta persona: «all», «bar» (retiros en barra) o el nombre de una zona de entrega.
  const [zone, setZone] = useState<string>("all");
  const [cardErrors, setCardErrors] = useState<
    Record<string, { message: string; version: number }>
  >({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [paused, setPaused] = useState(venue.paused);
  const [autoAccept, setAutoAccept] = useState(venue.auto_accept ?? false);
  const [pickup, setPickup] = useState(false);
  const [settings, setSettings] = useState(false);
  const camera = useRef<Promise<MediaStream> | null>(null);
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

  // Un pedido que llega a 0:00 se reconcilia en el servidor (vence y libera la reserva) con una consulta nueva.
  const lapsedIds = orders
    .filter(
      (o) => o.status === "queued" && Date.parse(o.deadline) - now <= 0,
    )
    .map((o) => o.id)
    .join(",");
  useEffect(() => {
    if (lapsedIds) refresh();
  }, [lapsedIds, refresh]);
  /** «Validar retiro» abre el escáner y pide la cámara dentro del mismo toque (Safari lo exige). */
  const openPickup = (options: { resume?: string } = {}) => {
    camera.current = options.resume ? null : startCamera();
    camera.current?.catch(() => undefined);
    setResumeOrderId(options.resume ?? null);
    setPickupRevision((n) => n + 1);
    setPickup(true);
  };
  const closePickup = () => {
    camera.current?.then((media) => media.getTracks().forEach((t) => t.stop())).catch(() => undefined);
    camera.current = null;
    setPickup(false);
    refresh();
  };
  const setReceiving = async (receiving: boolean) => {
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
          e instanceof Error ? e.message : "No pudimos cambiar la recepción.",
        );
    }
  };
  const isAdmin = role === "admin" || role === "onza";
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
      else if (e instanceof CommandError && e.code === "ORDER_EXPIRED")
        setNotice(
          `#${order.public_code} venció: pasaron los cinco minutos para aceptarlo. La reserva quedó liberada.`,
        );
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
  // Zonas con pedidos en curso para entregar en el lugar; con una sola zona (o ninguna) el filtro no aporta.
  const zones = [
    ...new Set(
      active.filter((o) => o.fulfillment === "location").map((o) => o.spot_area || "Sin zona"),
    ),
  ].sort((a, b) => a.localeCompare(b, "es"));
  const showZones = active.some((o) => o.fulfillment === "location");
  const inZone = (o: Order) =>
    zone === "all" ||
    (zone === "bar" ? o.fulfillment !== "location" : o.fulfillment === "location" && (o.spot_area || "Sin zona") === zone);
  const toBring = orders.filter((o) => o.status === "ready" && o.fulfillment === "location").length;
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
            {toBring > 0 && (
              <>
                {" "}
                · <strong className="num">{toBring}</strong>{" "}
                {toBring === 1 ? "listo para llevar" : "listos para llevar"}
              </>
            )}
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
        <span
          className={`reception ${closedVenue ? "closed" : paused ? "paused" : "open"}`}
          role="status"
        >
          <span className="dot" aria-hidden="true" />
          {closedVenue
            ? "Local cerrado"
            : paused
              ? "Pausado"
              : "Recibiendo pedidos"}
        </span>
        {autoAccept && !paused && !closedVenue && (
          <span className="reception auto" role="status">
            Aceptación automática
          </span>
        )}
        <button
          type="button"
          className="btn secondary sm"
          onClick={() => setSettings(true)}
        >
          <Settings2 size={18} aria-hidden="true" />
          <span>Ajustes</span>
        </button>
        <Button
          size="lg"
          className="pickup-cta wide-only"
          disabled={!online}
          onClick={() => openPickup()}
        >
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
      {showZones && (
        <div className="chips" role="group" aria-label="Qué atiendo" style={{ marginBottom: 12 }}>
          {[
            ["all", "Todo"],
            ["bar", "Barra"],
            ...zones.map((z) => [z, z] as const),
          ].map(([value, label]) => (
            <button
              type="button"
              className="chip"
              key={value}
              aria-current={zone === value ? "true" : undefined}
              onClick={() => setZone(value)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div
        className="board-tabs"
        role="tablist"
        aria-label="Cola de pedidos"
        style={
          {
            "--seg-count": lanes.length,
            "--seg-index": Math.max(
              0,
              lanes.findIndex(([state]) => state === tab),
            ),
          } as React.CSSProperties
        }
      >
        <span className="seg-thumb" aria-hidden="true" />
        {lanes.map(([state, label]) => (
          <button
            key={state}
            role="tab"
            aria-selected={tab === state}
            onClick={() => setTab(state)}
          >
            {label}
            <span className="n">
              {orders.filter((o) => o.status === state && inZone(o)).length}
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
            .filter((o) => o.status === state && inZone(o))
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
                  const left =
                    state === "queued" ? Date.parse(o.deadline) - now : 0;
                  const lapsed = state === "queued" && left <= 0;
                  const disabled = !online || busy === o.id || lapsed;
                  return (
                    <article
                      key={o.id}
                      className={`ocard ${fresh.has(o.id) ? "new" : ""}`}
                      aria-label={`Pedido ${o.public_code}`}
                    >
                      <div className="row between">
                        <span className="num">#{o.public_code}</span>
                        {state === "queued" ? (
                          <span
                            className={`wait countdown ${lapsed ? "late" : left <= 60000 ? "soon" : ""}`}
                            aria-label={
                              lapsed
                                ? "Plazo para aceptar vencido"
                                : `Quedan ${countdown(left)} para aceptar`
                            }
                          >
                            <Clock size={16} aria-hidden="true" />
                            {lapsed ? "Venció" : countdown(left)}
                          </span>
                        ) : (
                          <span className={`wait ${late ? "late" : ""}`}>
                            <Clock size={16} aria-hidden="true" />
                            {state === "ready"
                              ? `Listo hace ${minutes} min`
                              : `Espera ${minutes} min`}
                          </span>
                        )}
                      </div>
                      {o.fulfillment === "location" && (
                        <div className="where">
                          <p
                            className={`where-line ${o.spot_changed_at && Date.parse(o.spot_changed_at) > now - 10 * 60000 ? "moved" : ""}`}
                          >
                            <MapPin size={16} aria-hidden="true" />
                            <span>Llevar {placePhrase(o, "a")}</span>
                          </p>
                          <OrderMapButton order={o} />
                          {o.spot_changed_at && (
                            <span className="muted t-label">
                              El cliente cambió su lugar a las {clockTime(o.spot_changed_at)}
                            </span>
                          )}
                        </div>
                      )}
                      {state === "queued" && (
                        <p className="entered t-label muted">
                          Entró a las{" "}
                          <time dateTime={o.queued_at ?? o.created_at}>
                            {clockTime(o.queued_at ?? o.created_at)}
                          </time>
                          {lapsed && " · ya no se puede aceptar"}
                        </p>
                      )}
                      <ul className="items">
                        {o.items.map((i) => (
                          <li key={i.id}>
                            <span className="mini">
                              <ProductImage
                                name={i.name_snapshot}
                                src={productImageSrc({
                                  image_url: i.image_url ?? null,
                                  photo_path: i.photo_path ?? null,
                                })}
                              />
                            </span>
                            <span className="q">{i.quantity}×</span>{" "}
                            {i.name_snapshot}
                          </li>
                        ))}
                      </ul>
                      <div className="by">
                        {(() => {
                          const units = o.items.reduce((n, i) => n + i.quantity, 0);
                          return `${units} ${units === 1 ? "producto" : "productos"}`;
                        })()}
                      </div>
                      {failure && failure.version === o.version && (
                        <p className="inline-error" role="alert">
                          {failure.message}
                        </p>
                      )}
                      {state === "queued" && (
                        <div className="acts">
                          <Button
                            variant="secondary"
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
                            variant="success"
                            loading={busy === o.id}
                            disabled={!online || lapsed}
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
                            {o.fulfillment === "location"
                              ? `Entregar ${placePhrase({ spot_label: o.spot_label }, "en")}`
                              : "Validar retiro"}
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
                    Retomar entrega
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
                  {o.fulfillment === "location" && o.spot_label && (
                    <>
                      {" · "}
                      {o.status === "delivered" ? "Entregado en" : "Era para"} {spotText(o)}
                      {o.status === "delivered" && o.delivered_at && ` a las ${clockTime(o.delivered_at)}`}
                      {o.status === "delivered" && o.delivered_by_name && ` · ${o.delivered_by_name}`}
                    </>
                  )}
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
      <div className="pickup-dock">
        <Button size="lg" block disabled={!online} onClick={() => openPickup()}>
          <ScanLine size={20} aria-hidden="true" />
          Validar retiro
        </Button>
      </div>
      <Sheet
        open={pickup}
        onOpenChange={(open) => (open ? setPickup(true) : closePickup())}
        title={resumeOrderId ? "Retomar entrega" : "Validar retiro"}
        description="Escaneá el QR del cliente o ingresá su código privado. El número del pedido no autoriza la entrega."
      >
        {pickup && (
          <PickupPanel
            key={pickupRevision}
            venueId={venue.id}
            camera={camera.current}
            resumeOrderId={resumeOrderId}
            onChanged={refresh}
            onDone={closePickup}
          />
        )}
      </Sheet>
      <Sheet
        open={settings}
        onOpenChange={setSettings}
        title="Ajustes de la barra"
      >
        <div className="stack">
          {closedVenue ? (
            <Notice tone="warning">
              El administrador cerró el local. La cola existente se puede seguir
              operando.
            </Notice>
          ) : (
            <Toggle
              label="Recibir pedidos nuevos"
              checked={!paused}
              disabled={!online}
              onChange={(receiving) => void setReceiving(receiving)}
            />
          )}
          <p className="hint">
            La pausa detiene pedidos nuevos y conserva los que ya están en la
            cola.
          </p>
          <Toggle
            label="Aceptación automática"
            checked={autoAccept}
            disabled={!online || (!autoAccept && !isAdmin)}
            onChange={async (enabled) => {
              try {
                await sendCommand({ action: "venue_auto_accept", venueId: venue.id, enabled });
                setAutoAccept(enabled);
              } catch (e) {
                if (isSessionError(e)) setExpired(true);
                else setNotice(e instanceof Error ? e.message : "No pudimos cambiar la aceptación automática.");
              }
            }}
          />
          <p className="hint">
            {autoAccept
              ? "Acepta pedidos elegibles en el servidor, aunque la barra esté cerrada. Apagala para volver a manual."
              : isAdmin
                ? "Apagada. Configurá el máximo en preparación en Administración → Disponibilidad."
                : "Apagada. Solo administración puede activarla."}
          </p>
          <Toggle
            label="Sonido de pedidos nuevos"
            checked={sound}
            onChange={(next) => void toggleSound(next)}
          />
          {isAdmin && (
            <Link
              className={buttonClass({ variant: "secondary", block: true })}
              href={`/admin/${venue.id}?tab=ahora`}
            >
              {closedVenue ? "Abrir el local" : "Cerrar el local"} en
              Administración
            </Link>
          )}
          {canSwitch && (
            <Link
              className={buttonClass({ variant: "secondary", block: true })}
              href="/equipo/locales"
            >
              Cambiar de local
            </Link>
          )}
          <LogoutButton to="/equipo/acceso" label="Salir de este dispositivo" />
          <LogoutButton
            to="/equipo/acceso"
            everywhere
            label="Salir en todos mis dispositivos"
          />
        </div>
      </Sheet>
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
