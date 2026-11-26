import { Check } from "lucide-react";
import type { Order } from "../types";
import { formatClock } from "@/lib/clock";

const steps = [
  {
    status: "queued",
    title: "Recibido · esperando al local",
    hint: "El local tiene unos minutos para aceptarlo",
    at: "queued_at",
  },
  {
    status: "preparing",
    title: "Preparando",
    hint: "El local está haciendo tu pedido",
    at: "preparing_at",
  },
  {
    status: "ready",
    title: "Listo para retirar",
    hint: "Mostrá el código en la barra",
    at: "ready_at",
  },
  { status: "delivered", title: "Entregado", hint: "", at: "delivered_at" },
] as const;

const time = (value: string | null | undefined) =>
  value ? formatClock(value) : "";

/** Recibido → Preparando → Listo → Entregado. Los estados finales no felices (cancelado, vencido) se muestran aparte. */
export function OrderTimeline({ order }: { order: Order }) {
  const index = steps.findIndex((s) => s.status === order.status);
  const current = order.status === "pending_authorization" ? -1 : index;
  return (
    <ol className="tl" aria-label="Seguimiento del pedido">
      {steps.map((step, i) => {
        const location = order.fulfillment === "location" && step.status === "ready";
        const state =
          i < current || order.status === "delivered"
            ? "done"
            : i === current
              ? "now"
              : "";
        return (
          <li
            key={step.status}
            className={state}
            aria-current={state === "now" ? "step" : undefined}
          >
            <span className="dot">
              {state === "done" && <Check size={14} aria-hidden="true" />}
            </span>
            <div>
              <div className="t">
                {location ? "Listo · te lo llevamos" : step.title}
              </div>
              {state === "now" && step.hint && (
                <div className="s">
                  {location
                    ? "Mostrá el QR o el código al equipo cuando llegue"
                    : step.hint}
                </div>
              )}
              {state && (order[step.at] ?? (step.at === "queued_at" ? order.created_at : null)) && (
                <time
                  className="s num"
                  dateTime={order[step.at] ?? order.created_at}
                >
                  {time(order[step.at] ?? order.created_at)}
                </time>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
