"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, StatusBadge } from "@/components/ui/primitives";
import type { Venue } from "@/features/catalog/server/queries";
import type { Order } from "@/features/orders/types";

const minutesSince = (iso: string, now: number) =>
  Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type Row = {
  key: string;
  tone: "warning" | "danger" | "neutral" | "success";
  text: string;
  detail?: string;
  action?: { label: string; href: string };
};

/**
 * «Ahora»: lo que necesita atención en este momento, con el atajo para resolverlo. Sale de los pedidos en vivo que ya
 * recibe el panel, sin consultas nuevas. Si el local está pausado o cerrado, se reanuda desde acá en un toque.
 */
export function NowPanel({
  venue,
  orders,
  soldOut,
  onResume,
}: {
  venue: Venue;
  orders: Order[];
  soldOut: number;
  onResume: () => Promise<boolean>;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [resuming, setResuming] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const queued = orders.filter((o) => o.status === "queued");
  const ready = orders.filter((o) => o.status === "ready");
  const toBring = ready.filter((o) => o.fulfillment === "location");
  const incidents = orders.filter(
    (o) =>
      (o.payment_state === "captured" && o.status !== "delivered" && o.status !== "canceled") ||
      o.payment_state === "unknown",
  );
  const oldest = (list: Order[], at: (o: Order) => string) =>
    list.length ? Math.max(...list.map((o) => minutesSince(at(o), now))) : 0;
  const waitQueued = oldest(queued, (o) => o.queued_at ?? o.created_at);
  const waitReady = oldest(ready, (o) => o.ready_at ?? o.created_at);

  const rows: Row[] = [];
  if (queued.length)
    rows.push({
      key: "queued",
      tone: waitQueued >= 3 ? "danger" : "warning",
      text: `${plural(queued.length, "pedido nuevo espera", "pedidos nuevos esperan")} aceptación`,
      detail: `El más viejo entró hace ${waitQueued} min. Tienen 5 minutos antes de vencer.`,
      action: { label: "Ir a la barra", href: `/staff/${venue.id}` },
    });
  if (ready.length)
    rows.push({
      key: "ready",
      tone: waitReady >= 10 ? "danger" : "warning",
      text: `${plural(ready.length, "pedido listo sin entregar", "pedidos listos sin entregar")}`,
      detail: `${toBring.length ? `${plural(toBring.length, "para llevar al lugar", "para llevar al lugar")} · ` : ""}el más viejo está listo hace ${waitReady} min.`,
      action: { label: "Ir a la barra", href: `/staff/${venue.id}` },
    });
  if (incidents.length)
    rows.push({
      key: "incidents",
      tone: "danger",
      text: plural(incidents.length, "incidencia de cobro o entrega", "incidencias de cobro o entrega"),
      detail: "Cobro sin entrega o resultado sin confirmar.",
      action: { label: "Revisar", href: `/admin/${venue.id}?tab=pedidos` },
    });
  if (soldOut)
    rows.push({
      key: "soldout",
      tone: "neutral",
      text: plural(soldOut, "producto agotado", "productos agotados"),
      detail: "Los clientes los ven como agotados.",
      action: { label: "Ver agotados", href: `/admin/${venue.id}?tab=disponibilidad` },
    });

  const stopped = venue.open_state !== "open" || venue.paused;
  return (
    <section className="block-card" aria-labelledby="now-title" style={{ marginBottom: 16 }}>
      <div className="row between wrap">
        <h2 id="now-title">Ahora</h2>
        <StatusBadge tone={stopped ? "warning" : "success"}>
          {venue.open_state !== "open" ? "Local cerrado" : venue.paused ? "Pedidos pausados" : "Recibiendo pedidos"}
        </StatusBadge>
      </div>
      {stopped && (
        <div className="row between wrap now-stopped">
          <p className="grow">
            {venue.open_state !== "open"
              ? "El local está cerrado: los clientes no ven el menú."
              : "Los pedidos están pausados: los clientes ven el menú pero no pueden pedir."}
          </p>
          <Button
            size="sm"
            loading={resuming}
            onClick={async () => {
              setResuming(true);
              await onResume();
              setResuming(false);
            }}
          >
            {venue.open_state !== "open" ? "Abrir el local" : "Reanudar pedidos"}
          </Button>
        </div>
      )}
      {rows.length ? (
        <div className="rows">
          {rows.map((row) => (
            <div className="r wrap" key={row.key}>
              <div className="grow">
                <strong>{row.text}</strong>
                {row.detail && <div className="sub muted t-label">{row.detail}</div>}
              </div>
              {row.action && (
                <Link className="btn secondary sm" href={row.action.href}>
                  {row.action.label}
                </Link>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="muted" role="status">
          {stopped ? "Sin pedidos pendientes." : "Todo en orden: no hay pedidos esperando ni incidencias."}
        </p>
      )}
    </section>
  );
}
