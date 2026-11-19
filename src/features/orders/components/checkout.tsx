"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Lock } from "lucide-react";
import { browserDb } from "@/lib/supabase/browser";
import { z } from "zod";
import { errorMessage, type FailureDetail } from "@/lib/errors";
import {
  useCart,
  cartTotal,
  writeCart,
  readCart,
  setProductQuantity,
} from "../cart-store";
import {
  Button,
  Price,
  EmptyState,
  Notice,
  buttonClass,
} from "@/components/ui/primitives";
import { sendCommand, CommandError, isSessionError } from "../client-api";
import { orderSchema, statusLabels, type Order } from "../types";
import { SessionExpiredSheet } from "./session-expired-sheet";
import { useOnline } from "@/lib/use-online";

/** Rechazos en los que el servidor no creó nada: el intento se puede descartar sin riesgo de duplicar. */
const DEFINITIVE = [
  "OUT_OF_STOCK",
  "PRICE_CHANGED",
  "VENUE_CLOSED",
  "VENUE_PAUSED",
  "VENUE_CAPACITY",
  "INVALID_QUANTITY",
  "INVALID_INPUT",
  "POLICY_REQUIRED",
  "RESOURCE_NOT_FOUND",
  "RATE_LIMITED",
  "STAFF_CANNOT_ORDER",
  "ONBOARDING_REQUIRED",
];
const ACTIVE = ["pending_authorization", "queued", "preparing", "ready"];
const legacyAttemptKey = "onza-checkout-attempt";
/** El intento pendiente es de la cuenta, igual que el carrito: otra cuenta en el mismo equipo nunca lo hereda. */
export const checkoutAttemptKey = (userId: string | null) =>
  userId ? `${legacyAttemptKey}:${userId}` : legacyAttemptKey;
const attemptSchema = z.object({ fingerprint: z.string(), key: z.string() });
function readAttempt(key: string) {
  try {
    const parsed = attemptSchema.safeParse(
      JSON.parse(localStorage.getItem(key) ?? "null"),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
const attemptStatusSchema = z.discriminatedUnion("attempt", [
  z.object({ attempt: z.literal("none") }),
  z.object({ attempt: z.literal("found"), order: orderSchema }),
]);

export function Checkout({ accounts = false }: { accounts?: boolean }) {
  const cart = useCart();
  const router = useRouter();
  const online = useOnline();
  // Con cuentas, la mayoría de edad y las condiciones se aceptaron (con fecha y versión) en el perfil.
  const [adult, setAdult] = useState(accounts);
  const [policy, setPolicy] = useState(accounts);
  const [error, setError] = useState<{
    code: string;
    message: string;
    detail?: FailureDetail;
  } | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const allowAnother = useRef(false);
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const [placed, setPlaced] = useState<Order | null>(null);
  const lock = useRef(false);
  if (placed)
    return (
      <div
        className="state"
        role="status"
        aria-live="polite"
        style={{ paddingTop: 64 }}
      >
        <div className="vaso">
          <span className="outline" />
          <span className="fill" />
        </div>
        <h1 className="t-title">Pedido enviado</h1>
        <p>
          #{placed.public_code} · {placed.venue.name}
          <br />
          Te avisamos cuando esté listo.
        </p>
        <Link
          className={buttonClass({ variant: "secondary" })}
          href={`/orders/${placed.id}`}
        >
          Ver pedido
        </Link>
      </div>
    );
  if (!cart?.items.length)
    return (
      <EmptyState
        title="Tu carrito está vacío"
        action={
          <Link className={buttonClass()} href="/">
            Explorar locales
          </Link>
        }
      >
        Elegí un local y armá tu ronda.
      </EmptyState>
    );
  const submit = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setActiveOrder(null);
    let attemptKey = legacyAttemptKey;
    try {
      const db = browserDb();
      const {
        data: { user },
      } = await db.auth.getUser();
      if (accounts) {
        if (!user || user.is_anonymous) {
          setExpired(true);
          return;
        }
      } else if (!user) {
        const { error } = await db.auth.signInAnonymously();
        if (error)
          throw new Error(
            "No pudimos iniciar tu sesión invitada. Volvé a intentarlo en unos minutos.",
          );
      } else if (!user.is_anonymous) {
        throw new Error(
          "Estás usando una sesión de personal. Abrí una ventana o perfil separado para pedir como invitado.",
        );
      }
      const current = await db.auth.getUser();
      attemptKey = checkoutAttemptKey(current.data.user?.id ?? null);
      const input = {
        action: "create",
        venueId: cart.venueId,
        items: cart.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          expectedProductVersion: i.version,
          expectedPriceMinor: i.priceMinor,
        })),
        termsVersion: "demo-v1",
        privacyVersion: "demo-v1",
        adult,
      };
      const fingerprint = JSON.stringify(input);
      const previous = readAttempt(attemptKey) ?? readAttempt(legacyAttemptKey);
      localStorage.removeItem(legacyAttemptKey);
      let attempt = previous;
      // Un intento anterior con otro carrito no bloquea a ciegas: el servidor dice si creó un pedido (y espera a que
      // termine un envío en curso con esa clave). Sin pedido, se descarta; con un pedido activo, se muestra cuál es.
      if (previous && previous.fingerprint !== fingerprint) {
        const status = attemptStatusSchema.parse(
          await sendCommand({
            action: "attempt_status",
            idempotencyKey: previous.key,
          }),
        );
        attempt = null;
        localStorage.removeItem(attemptKey);
        if (
          status.attempt === "found" &&
          ACTIVE.includes(status.order.status) &&
          !allowAnother.current
        ) {
          setActiveOrder(status.order);
          return;
        }
      }
      allowAnother.current = false;
      attempt ??= { fingerprint, key: crypto.randomUUID() };
      localStorage.setItem(attemptKey, JSON.stringify(attempt));
      const order = orderSchema.parse(
        await sendCommand({ ...input, idempotencyKey: attempt.key }),
      );
      if (JSON.stringify(readCart()) === JSON.stringify(cart)) writeCart(null);
      localStorage.removeItem(attemptKey);
      setPlaced(order);
      setTimeout(() => router.push(`/orders/${order.id}`), 1800);
    } catch (e) {
      if (isSessionError(e)) {
        setExpired(true);
        return;
      }
      // Un rechazo definitivo del servidor revierte toda la transacción: no hay pedido que proteger con la misma clave.
      if (e instanceof CommandError && DEFINITIVE.includes(e.code))
        localStorage.removeItem(attemptKey);
      setError({
        code: e instanceof CommandError ? e.code : "UNKNOWN",
        detail: e instanceof CommandError ? e.detail : undefined,
        message:
          e instanceof CommandError
            ? e.message
            : e instanceof Error &&
                e.message.includes("SUPABASE_NOT_CONFIGURED")
              ? errorMessage(e)
              : e instanceof Error
                ? e.message
                : errorMessage(e),
      });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const total = cartTotal(cart);
  const affected = error?.detail?.productId
    ? cart.items.find((i) => i.productId === error.detail?.productId)
    : undefined;
  const lineIssue =
    error && ["OUT_OF_STOCK", "PRICE_CHANGED"].includes(error.code);
  const retryable =
    error &&
    !lineIssue &&
    !DEFINITIVE.includes(error.code) &&
    error.code !== "OFFLINE";
  const fixLine = () => {
    if (!affected || !error) return;
    if (error.code === "OUT_OF_STOCK")
      setProductQuantity(affected.productId, 0);
    else if (error.detail?.priceMinor !== undefined)
      writeCart({
        ...cart,
        items: cart.items.map((i) =>
          i.productId === affected.productId
            ? {
                ...i,
                priceMinor: error.detail?.priceMinor ?? i.priceMinor,
                version: error.detail?.version ?? i.version,
              }
            : i,
        ),
      });
    setError(null);
  };
  return (
    <>
      <Link className="back" href="/cart">
        <ChevronLeft size={16} aria-hidden="true" />
        Carrito
      </Link>
      <div className="page-head">
        <h1 className="t-title">Confirmar pedido</h1>
      </div>
      <div className="stack">
        <div className="panel">
          <strong>{cart.venueName}</strong>
          <div className="muted t-label">Retiro: {cart.pickupLabel}</div>
        </div>
        <div className="lines">
          {cart.items.map((i) => (
            <div
              className={`line ${affected?.productId === i.productId ? "issue" : ""}`}
              key={i.productId}
            >
              <span className="q">{i.quantity}×</span>
              <span>{i.name}</span>
              <span className="amt">
                <Price amount={i.priceMinor * i.quantity} />
              </span>
            </div>
          ))}
        </div>
        <div className="total-row">
          <span>Total</span>
          <Price amount={total} />
        </div>
        <div className="panel row">
          <Lock size={20} aria-hidden="true" />
          <div className="grow">
            <strong className="t-label" style={{ fontWeight: 600 }}>
              Pago simulado
            </strong>
            <div className="muted t-label">
              Demo sin dinero real. No pedimos tarjeta.
            </div>
          </div>
        </div>
        {!accounts && (
          <>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={adult}
                onChange={(e) => setAdult(e.target.checked)}
              />
              <span>
                Confirmo que soy mayor de edad. El local puede verificarlo al
                retirar.
              </span>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={policy}
                onChange={(e) => setPolicy(e.target.checked)}
              />
              <span>
                Acepto los{" "}
                <Link href="/policies">
                  términos y la política de privacidad del demo
                </Link>{" "}
                (demo-v1).
              </span>
            </label>
          </>
        )}
        <p className="muted t-label">
          Podés cancelar hasta que el local acepte tu pedido.
        </p>
        {activeOrder && (
          <Notice
            tone="warning"
            title="Ya tenés un pedido activo"
            action={
              <div className="row wrap">
                <Link
                  className={buttonClass({ variant: "secondary", size: "sm" })}
                  href={`/orders/${activeOrder.id}`}
                >
                  Ver pedido activo
                </Link>
                <Button
                  variant="quiet"
                  size="sm"
                  onClick={() => {
                    allowAnother.current = true;
                    void submit();
                  }}
                >
                  Hacer otro pedido
                </Button>
              </div>
            }
          >
            Tu intento anterior creó el pedido #{activeOrder.public_code} en{" "}
            {activeOrder.venue.name} ({statusLabels[activeOrder.status]}).
            Revisalo antes de pedir otra ronda.
          </Notice>
        )}
        {error && (
          <Notice
            tone="danger"
            title={
              error.code === "OFFLINE" ? "Sin conexión" : "No se hizo el pedido"
            }
            action={
              lineIssue && affected ? (
                <Button variant="secondary" size="sm" onClick={fixLine}>
                  {error.code === "OUT_OF_STOCK" ? (
                    `Quitar ${affected.name}`
                  ) : (
                    <>
                      Aceptar <Price amount={error.detail?.priceMinor ?? 0} />
                    </>
                  )}
                </Button>
              ) : lineIssue ? (
                <Link
                  className={buttonClass({ variant: "secondary", size: "sm" })}
                  href="/cart"
                >
                  Revisar carrito
                </Link>
              ) : retryable || error.code === "OFFLINE" ? (
                <div className="row wrap">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void submit()}
                  >
                    Reintentar
                  </Button>
                  {retryable && (
                    <Link
                      className={buttonClass({ variant: "quiet", size: "sm" })}
                      href="/orders"
                    >
                      Consultar mis pedidos
                    </Link>
                  )}
                </div>
              ) : undefined
            }
          >
            {affected && error.code === "OUT_OF_STOCK"
              ? `${affected.name} se agotó. Quitalo para pedir el resto.`
              : affected && error.code === "PRICE_CHANGED"
                ? `${affected.name} cambió de precio. Revisá el total antes de pedir.`
                : error.message}
            {retryable &&
              " Reintentar usa el mismo intento: no se duplica el pedido."}
          </Notice>
        )}
        <div className="sticky-cta">
          <Button
            size="lg"
            block
            onClick={submit}
            disabled={!adult || !policy || !online}
            loading={busy}
          >
            Pedir · <Price amount={total} />
          </Button>
          {!online && (
            <p className="btn-note">
              Sin conexión: el pedido no se va a enviar.
            </p>
          )}
        </div>
      </div>
      <SessionExpiredSheet open={expired} next="/checkout" />
    </>
  );
}
