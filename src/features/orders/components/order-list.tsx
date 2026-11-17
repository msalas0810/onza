"use client";
import Link from "next/link";
import { useLiveOrders } from "../use-live-orders";
import { statusLabels } from "../types";
import {
  EmptyState,
  ErrorState,
  Price,
  Button,
  StatusBadge,
  buttonClass,
} from "@/components/ui/primitives";
import { ReconnectingBanner } from "@/components/ui/connection-banner";
import { SessionExpiredSheet } from "./session-expired-sheet";

const FINAL = ["delivered", "canceled", "expired", "uncollected"];
const tone = (status: string) =>
  status === "ready"
    ? "brand"
    : status === "delivered"
      ? "success"
      : status === "preparing"
        ? "warning"
        : FINAL.includes(status)
          ? "danger"
          : "neutral";

export function OrderList() {
  const { orders, loading, error, connection, refresh, sessionExpired } =
    useLiveOrders();
  if (sessionExpired) return <SessionExpiredSheet open next="/orders" />;
  if (error)
    return (
      <ErrorState message={error}>
        <Button variant="secondary" onClick={refresh}>
          Volver a consultar
        </Button>
      </ErrorState>
    );
  if (loading)
    return (
      <div className="stack" aria-busy="true" aria-label="Cargando pedidos">
        {[1, 2].map((n) => (
          <div className="sk" style={{ height: 72 }} key={n} />
        ))}
      </div>
    );
  const sorted = [...orders].sort(
    (a, b) =>
      Number(FINAL.includes(a.status)) - Number(FINAL.includes(b.status)) ||
      Date.parse(b.created_at) - Date.parse(a.created_at),
  );
  const active = sorted.filter((o) => !FINAL.includes(o.status));
  const past = sorted.filter((o) => FINAL.includes(o.status));
  const row = (o: (typeof orders)[number]) => (
    <Link href={`/orders/${o.id}`} key={o.id} className="vrow">
      <div className="grow">
        <div className="row between">
          <h3>{o.venue.name}</h3>
          <Price amount={o.total_minor} />
        </div>
        <div className="row between">
          <span className="muted t-label">
            #{o.public_code} ·{" "}
            {o.items.map((i) => `${i.quantity}× ${i.name_snapshot}`).join(", ")}
          </span>
          <StatusBadge tone={tone(o.status)}>{statusLabels[o.status]}</StatusBadge>
        </div>
      </div>
    </Link>
  );
  return (
    <>
      <ReconnectingBanner show={/Reconect/.test(connection)} />
      {!orders.length ? (
        <EmptyState
          brand
          title="Todavía no pediste"
          action={
            <Link className={buttonClass()} href="/">
              Explorar locales
            </Link>
          }
        >
          Tus pedidos y tickets aparecen acá.
        </EmptyState>
      ) : (
        <>
          {active.length > 0 && (
            <>
              <h2 className="eyebrow section-label" style={{ marginTop: 0 }}>
                En curso
              </h2>
              <div>{active.map(row)}</div>
            </>
          )}
          {past.length > 0 && (
            <>
              <h2 className="eyebrow section-label">Anteriores</h2>
              <div>{past.map(row)}</div>
            </>
          )}
        </>
      )}
    </>
  );
}
