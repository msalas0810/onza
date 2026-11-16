"use client";
import { useState, useEffect, useRef } from "react";
import { Button, TextField, Price } from "@/components/ui/primitives";
import { sendCommand } from "@/features/orders/client-api";
import {
  orderSchema,
  type Order,
  paymentLabels,
} from "@/features/orders/types";
export function PickupPanel({
  venueId,
  credential,
  resumeOrderId,
  onChanged,
}: {
  venueId: string;
  credential: string | null;
  resumeOrderId?: string | null;
  onChanged: () => void;
}) {
  const [code, setCode] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scenario, setScenario] = useState("approved");
  const [physical, setPhysical] = useState(false);
  const lock = useRef(false);
  async function resolve(value: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setOrder(null);
    setPhysical(false);
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
      setOrder(
        orderSchema.parse(
          await sendCommand({
            action,
            orderId: order.id,
            claimId: order.claim_id,
            scenario,
            physicalHandoff: physical,
          }),
        ),
      );
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
  return (
    <div className="stack">
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          void resolve(code);
        }}
      >
        <TextField
          label="Código de retiro (12 caracteres)"
          placeholder="El que muestra el cliente"
          value={code}
          maxLength={14}
          autoComplete="off"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <Button
          type="submit"
          loading={busy}
          disabled={code.replace(/[\s-]/g, "").length !== 12}
        >
          Validar
        </Button>
      </form>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {order && (
        <section className="notice" aria-live="polite">
          <h2>
            #{order.public_code} · {order.venue.name}
          </h2>
          <p>
            {order.items
              .map((i) => `${i.quantity} × ${i.name_snapshot}`)
              .join(", ")}
          </p>
          <p>
            {paymentLabels[order.payment_state]} ·{" "}
            <Price amount={order.total_minor} />
          </p>
          {order.status === "delivered" ? (
            <h2 className="success">
              Ya entregado. No volver a cobrar ni entregar.
            </h2>
          ) : order.claimed_elsewhere ? (
            <p className="warning">
              Otra persona está atendiendo este retiro. Solo esa sesión puede
              entregar.
            </p>
          ) : (
            <div className="stack">
              {order.capture_state === "declined" && (
                <p className="error">
                  Captura rechazada. No entregués. Solicitá la cancelación y
                  anulación de reserva al supervisor.
                </p>
              )}
              {order.payment_state === "authorized" &&
                order.capture_state !== "declined" && (
                  <>
                    <label className="field">
                      Resultado de captura simulada
                      <select
                        value={scenario}
                        onChange={(e) => setScenario(e.target.value)}
                      >
                        <option value="approved">Aprobada</option>
                        <option value="declined">Rechazada</option>
                        <option value="timeout_after_success">
                          Cobro exitoso con respuesta perdida
                        </option>
                        <option value="unknown">Resultado desconocido</option>
                      </select>
                    </label>
                    <Button loading={busy} onClick={() => void act("capture")}>
                      Confirmar cobro simulado
                    </Button>
                  </>
                )}
              {order.payment_state === "unknown" && (
                <>
                  <p className="error">
                    No entregués: el cobro no está confirmado. El retiro sigue
                    asignado a esta sesión.
                  </p>
                  <Button
                    variant="secondary"
                    loading={busy}
                    onClick={() => void act("reconcile")}
                  >
                    Consultar resultado de la captura
                  </Button>
                </>
              )}
              {order.payment_state === "captured" && (
                <>
                  <h2 className="success">Podés entregar</h2>
                  <p>Este retiro está asignado únicamente a esta sesión.</p>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={physical}
                      onChange={(e) => setPhysical(e.target.checked)}
                    />
                    <span>Entregué físicamente el pedido completo.</span>
                  </label>
                  <Button
                    loading={busy}
                    disabled={!physical}
                    onClick={() => void act("complete")}
                  >
                    Confirmar entrega
                  </Button>
                </>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
