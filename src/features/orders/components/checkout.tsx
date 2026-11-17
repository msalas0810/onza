"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { browserDb } from "@/lib/supabase/browser";
import { errorMessage } from "@/lib/errors";
import { useCart, cartTotal, writeCart, readCart } from "../cart-store";
import { Button, Price, EmptyState } from "@/components/ui/primitives";
import { sendCommand } from "../client-api";
import { orderSchema } from "../types";
export function Checkout({ accounts = false }: { accounts?: boolean }) {
  const cart = useCart();
  const router = useRouter();
  // With accounts, age and terms were accepted (with date and version) during onboarding.
  const [adult, setAdult] = useState(accounts);
  const [policy, setPolicy] = useState(accounts);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  if (!cart?.items.length)
    return (
      <EmptyState title="Tu carrito está vacío">
        <Link href="/">Explorar locales</Link>
      </EmptyState>
    );
  const submit = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const db = browserDb();
      const {
        data: { user },
      } = await db.auth.getUser();
      if (accounts) {
        if (!user || user.is_anonymous) {
          router.push("/acceso?next=%2Fcheckout");
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
      // Preserve the same key after network loss. A different draft needs an explicit new attempt.
      if (previous && previous.fingerprint !== fingerprint)
        throw new Error(
          "Hay un intento anterior sin resolver. Consultá Pedidos antes de cambiar el carrito o la simulación.",
        );
      const attempt = previous ?? { fingerprint, key: crypto.randomUUID() };
      localStorage.setItem("onza-checkout-attempt", JSON.stringify(attempt));
      const order = orderSchema.parse(
        await sendCommand({ ...input, idempotencyKey: attempt.key }),
      );
      if (JSON.stringify(readCart()) === JSON.stringify(cart)) writeCart(null);
      localStorage.removeItem("onza-checkout-attempt");
      router.push(`/orders/${order.id}`);
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes("SUPABASE_NOT_CONFIGURED")
          ? errorMessage(e)
          : e instanceof Error
            ? e.message
            : errorMessage(e),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <p className="eyebrow">Último paso</p>
      <h1>Confirmá tu pedido.</h1>
      <p>
        {cart.venueName} · retiro en {cart.pickupLabel}
      </p>
      <div className="stack">
        {cart.items.map((i) => (
          <div className="row between" key={i.productId}>
            <span>
              {i.quantity} × {i.name}
            </span>
            <Price amount={i.priceMinor * i.quantity} />
          </div>
        ))}
        <div className="row between">
          <h2>Total final</h2>
          <Price amount={cartTotal(cart)} />
        </div>
        <div className="notice">
          <strong>Reserva simulada, cobro al recoger</strong>
          <p>
            Reservaremos <Price amount={cartTotal(cart)} />. El cobro se
            confirma al recoger tu pedido. No ingresés datos de tarjeta.
          </p>
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
        <p className="muted">
          Podés cancelar mientras el pedido esté en cola. Si el local no acepta
          en 2 minutos, la reserva se anula. Sin recogida, se anula 20 minutos
          después de estar listo; no hay penalidad oculta. Preparando: solicitá
          ayuda al local.
        </p>
        {error && (
          <div className="notice error" role="alert">
            <p>{error}</p>
            <Link className="link-button" href="/orders">
              Consultar mis pedidos
            </Link>
            <Button
              variant="secondary"
              onClick={() => {
                if (
                  confirm(
                    "Verificá primero Pedidos: iniciar otro intento puede crear otro pedido si el anterior se confirmó. ¿Ya lo revisaste?",
                  )
                ) {
                  localStorage.removeItem("onza-checkout-attempt");
                  setError(
                    "Podés revisar el carrito e iniciar un nuevo intento.",
                  );
                }
              }}
            >
              Ya revisé mis pedidos · nuevo intento
            </Button>
          </div>
        )}
        <Button onClick={submit} disabled={!adult || !policy} loading={busy}>
          Confirmar y reservar <Price amount={cartTotal(cart)} />
        </Button>
        <Link className="link-button" href="/cart">
          ← Revisar carrito
        </Link>
      </div>
    </>
  );
}
