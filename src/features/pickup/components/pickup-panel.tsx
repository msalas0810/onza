"use client";
import { useState, useEffect, useRef } from "react";
import { AlertCircle, Check, ScanLine } from "lucide-react";
import { Button, TextField, Price, Notice } from "@/components/ui/primitives";
import { sendCommand } from "@/features/orders/client-api";
import {
  orderSchema,
  type Order,
  paymentLabels,
} from "@/features/orders/types";

/**
 * Validación del retiro con QR o código privado. El flujo contra el servidor no cambia: resolver (asigna el retiro a esta
 * sesión) → confirmar cobro simulado → confirmar entrega. Solo cambia cómo se presenta.
 */
export function PickupPanel({
  venueId,
  credential,
  resumeOrderId,
  onChanged,
  onScan,
}: {
  venueId: string;
  credential: string | null;
  resumeOrderId?: string | null;
  onChanged: () => void;
  onScan?: () => void;
}) {
  const [code, setCode] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [physical, setPhysical] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const lock = useRef(false);
  async function resolve(value: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setOrder(null);
    setPhysical(false);
    setDelivered(false);
    try {
      const input = value.startsWith("onza:")
        ? { token: value.slice(5) }
        : { code: value.replace(/[\s-]/g, "").toUpperCase() };
      setOrder(
        orderSchema.parse(
          await sendCommand({ action: "resolve", venueId, ...input }),
        ),
      );
      setCode("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos validar el retiro.",
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  useEffect(() => {
    const timer = credential
      ? setTimeout(() => void resolve(credential), 0)
      : undefined;
    return () => {
      if (timer) clearTimeout(timer);
    }; /* Credentials are intentionally consumed only when the parent changes them. */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credential]);
  useEffect(() => {
    if (!resumeOrderId) return;
    let closed = false;
    void sendCommand({ action: "get", orderId: resumeOrderId })
      .then((data) => {
        if (!closed) {
          setError("");
          setPhysical(false);
          setOrder(orderSchema.parse(data));
        }
      })
      .catch(() => {
        if (!closed)
          setError("No pudimos retomar el retiro. Volvé a consultar.");
      });
    return () => {
      closed = true;
    };
  }, [resumeOrderId]);
  async function act(action: string) {
    if (!order || !order.claim_id || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const next = orderSchema.parse(
        await sendCommand({
          action,
          orderId: order.id,
          claimId: order.claim_id,
          physicalHandoff: physical,
        }),
      );
      setOrder(next);
      if (action === "complete" && next.status === "delivered")
        setDelivered(true);
      onChanged();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "La operación no pudo confirmarse.",
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  const reset = () => {
    setOrder(null);
    setError("");
    setDelivered(false);
    setPhysical(false);
  };
  const summary = order && (
    <div className="panel">
      <div className="row between">
        <strong className="num">#{order.public_code}</strong>
        <Price amount={order.total_minor} />
      </div>
      <div className="t-label">
        {order.items.map((i) => `${i.quantity}× ${i.name_snapshot}`).join(", ")}
      </div>
      <div className="hint" style={{ marginTop: 4 }}>
        {paymentLabels[order.payment_state]}
      </div>
    </div>
  );
  if (order && delivered)
    return (
      <div className="stack">
        <div className="result ok" role="status">
          <span className="big">
            <svg
              className="ico anim-check"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <strong className="t-heading">Entregado #{order.public_code}</strong>
          <span>
            {order.items
              .map((i) => `${i.quantity}× ${i.name_snapshot}`)
              .join(", ")}
          </span>
        </div>
        <Button block onClick={reset}>
          Validar otro retiro
        </Button>
      </div>
    );
  return (
    <div className="stack">
      {!order && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void resolve(code);
          }}
        >
          <TextField
            label="Código de retiro (12 caracteres)"
            className="code-input"
            placeholder="XXXX XXXX XXXX"
            value={code}
            maxLength={14}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            hint="Pedile el código privado al cliente. El número del pedido no sirve."
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <div className="row">
            {onScan && (
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={onScan}
              >
                <ScanLine size={20} aria-hidden="true" />
                Escanear QR
              </Button>
            )}
            <Button
              type="submit"
              size="lg"
              className="grow"
              loading={busy}
              disabled={code.replace(/[\s-]/g, "").length !== 12}
              style={{ flex: 1 }}
            >
              Validar
            </Button>
          </div>
        </form>
      )}
      {error && (
        <div className="result bad" role="alert">
          <AlertCircle size={24} aria-hidden="true" />
          <strong>{error}</strong>
        </div>
      )}
      {order && (
        <section className="stack" aria-live="polite">
          {summary}
          {order.status === "delivered" ? (
            <div className="result bad" role="alert">
              <AlertCircle size={24} aria-hidden="true" />
              <strong>
                Este código ya se usó: #{order.public_code} se entregó. No
                cobres ni entregues otra vez.
              </strong>
            </div>
          ) : order.claimed_elsewhere ? (
            <Notice tone="warning">
              Otra persona está atendiendo este retiro. Solo esa sesión puede
              entregar.
            </Notice>
          ) : (
            <div className="stack">
              {order.capture_state === "declined" && (
                <Notice tone="danger">
                  Captura rechazada. No entregues. Pedile al supervisor la
                  cancelación y la anulación de la reserva.
                </Notice>
              )}
              {order.payment_state === "authorized" &&
                order.capture_state !== "declined" && (
                  <Button
                    size="lg"
                    block
                    loading={busy}
                    onClick={() => void act("capture")}
                  >
                    Confirmar cobro simulado
                  </Button>
                )}
              {order.payment_state === "unknown" && (
                <>
                  <Notice tone="danger">
                    No entregues: el cobro no está confirmado. El retiro sigue
                    asignado a esta sesión.
                  </Notice>
                  <Button
                    variant="secondary"
                    size="lg"
                    block
                    loading={busy}
                    onClick={() => void act("reconcile")}
                  >
                    Consultar resultado de la captura
                  </Button>
                </>
              )}
              {order.payment_state === "captured" && (
                <>
                  <Notice tone="success" title="Podés entregar">
                    Este retiro está asignado únicamente a esta sesión.
                  </Notice>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={physical}
                      onChange={(e) => setPhysical(e.target.checked)}
                    />
                    <span>Entregué físicamente el pedido completo.</span>
                  </label>
                  <Button
                    size="lg"
                    block
                    loading={busy}
                    disabled={!physical}
                    onClick={() => void act("complete")}
                  >
                    <Check size={20} aria-hidden="true" />
                    Confirmar entrega
                  </Button>
                </>
              )}
            </div>
          )}
          <Button variant="quiet" onClick={reset}>
            Validar otro código
          </Button>
        </section>
      )}
    </div>
  );
}
