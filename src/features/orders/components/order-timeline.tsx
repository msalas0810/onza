import { Check } from "lucide-react";
import type { Order } from "../types";

const steps = [
  {
    status: "queued",
    title: "Recibido",
    hint: "Esperando que el local lo acepte",
    at: "created_at",
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

const time = (value: string | null) =>
  value
    ? new Date(value).toLocaleTimeString("es-CR", {
        timeZone: "America/Costa_Rica",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

/** Recibido → Preparando → Listo → Entregado. Los estados finales no felices (cancelado, vencido) se muestran aparte. */
export function OrderTimeline({ order }: { order: Order }) {
  const index = steps.findIndex((s) => s.status === order.status);
  const current = order.status === "pending_authorization" ? -1 : index;
  return (
    <ol className="tl" aria-label="Seguimiento del pedido">
      {steps.map((step, i) => {
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
              <div className="t">{step.title}</div>
              {state === "now" && step.hint && (
                <div className="s">{step.hint}</div>
              )}
              {state && order[step.at] && (
                <time className="s num" dateTime={order[step.at] ?? undefined}>
                  {time(order[step.at])}
                </time>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
