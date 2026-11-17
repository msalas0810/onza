"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Lock } from "lucide-react";
import { browserDb } from "@/lib/supabase/browser";
import { errorMessage } from "@/lib/errors";
import { useCart, cartTotal, writeCart, readCart } from "../cart-store";
import {
  Button,
  Price,
  EmptyState,
  Notice,
  buttonClass,
} from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { sendCommand, CommandError, isSessionError } from "../client-api";
import { orderSchema, type Order } from "../types";
import { SessionExpiredSheet } from "./session-expired-sheet";
import { useOnline } from "@/lib/use-online";

export function Checkout({ accounts = false }: { accounts?: boolean }) {
  const cart = useCart();
  const router = useRouter();
  const online = useOnline();
  // Con cuentas, la mayoría de edad y las condiciones se aceptaron (con fecha y versión) en el perfil.
  const [adult, setAdult] = useState(accounts);
  const [policy, setPolicy] = useState(accounts);
  const [error, setError] = useState<{ code: string; message: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const [confirmRetry, setConfirmRetry] = useState(false);
  const [placed, setPlaced] = useState<Order | null>(null);
  const lock = useRef(false);
  if (placed)
    return (
      <div className="state" role="status" aria-live="polite" style={{ paddingTop: 64 }}>
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
        <Link className={buttonClass({ variant: "secondary" })} href={`/orders/${placed.id}`}>
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
      const input = {
        action: "create",
        venueId: cart.venueId,
        items: cart.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          expectedProductVersion: i.version,
        })),
        termsVersion: "demo-v1",
        privacyVersion: "demo-v1",
        adult,
      };
      const fingerprint = JSON.stringify(input);
      const saved = localStorage.getItem("onza-checkout-attempt");
      const previous = saved ? JSON.parse(saved) : null;
      // Se conserva la misma clave tras perder la red. Un carrito distinto exige un intento nuevo explícito.
      if (previous && previous.fingerprint !== fingerprint)
        throw new CommandError(
          "Hay un intento anterior sin resolver. Consultá Pedidos antes de cambiar el carrito.",
          "ATTEMPT_PENDING",
        );
      const attempt = previous ?? { fingerprint, key: crypto.randomUUID() };
      localStorage.setItem("onza-checkout-attempt", JSON.stringify(attempt));
      const order = orderSchema.parse(
        await sendCommand({ ...input, idempotencyKey: attempt.key }),
      );
      if (JSON.stringify(readCart()) === JSON.stringify(cart)) writeCart(null);
      localStorage.removeItem("onza-checkout-attempt");
      setPlaced(order);
      setTimeout(() => router.push(`/orders/${order.id}`), 1800);
    } catch (e) {
      if (isSessionError(e)) {
        setExpired(true);
        return;
      }
      setError({
        code: e instanceof CommandError ? e.code : "UNKNOWN",
        message:
          e instanceof CommandError
            ? e.message
            : e instanceof Error && e.message.includes("SUPABASE_NOT_CONFIGURED")
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
  const reviewable =
    error && ["OUT_OF_STOCK", "PRICE_CHANGED"].includes(error.code);
  const unresolved =
    error &&
    !reviewable &&
    !["OFFLINE", "CONNECTION_ERROR", "VENUE_CLOSED", "VENUE_PAUSED", "VENUE_CAPACITY"].includes(error.code);
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
            <div className="line" key={i.productId}>
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
                <Link href="/policies">términos y la política de privacidad del demo</Link>{" "}
                (demo-v1).
              </span>
            </label>
          </>
        )}
        <p className="muted t-label">
          Podés cancelar hasta que el local acepte tu pedido.
        </p>
        {error && (
          <Notice
            tone="danger"
            title={
              error.code === "OFFLINE" ? "Sin conexión" : "No se hizo el pedido"
            }
            action={
              reviewable ? (
                <Link className={buttonClass({ variant: "secondary", size: "sm" })} href="/cart">
                  Revisar carrito
                </Link>
              ) : unresolved ? (
                <div className="row wrap">
                  <Link className={buttonClass({ variant: "secondary", size: "sm" })} href="/orders">
                    Consultar mis pedidos
                  </Link>
                  <Button variant="quiet" size="sm" onClick={() => setConfirmRetry(true)}>
                    Ya revisé · nuevo intento
                  </Button>
                </div>
              ) : error.code === "OFFLINE" || error.code === "CONNECTION_ERROR" ? (
                <Button variant="secondary" size="sm" onClick={() => void submit()}>
                  Reintentar
                </Button>
              ) : undefined
            }
          >
            {error.message}
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
            <p className="btn-note">Sin conexión: el pedido no se va a enviar.</p>
          )}
        </div>
      </div>
      <SessionExpiredSheet open={expired} next="/checkout" />
      <Sheet
        open={confirmRetry}
        onOpenChange={setConfirmRetry}
        title="¿Ya revisaste tus pedidos?"
        description="Iniciar otro intento puede crear otro pedido si el anterior se confirmó."
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmRetry(false)}>
              Volver
            </Button>
            <Button
              onClick={() => {
                localStorage.removeItem("onza-checkout-attempt");
                setError(null);
                setConfirmRetry(false);
              }}
            >
              Empezar un intento nuevo
            </Button>
          </>
        }
      />
    </>
  );
}
