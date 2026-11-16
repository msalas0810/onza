"use client";
import Link from "next/link";
import { useLiveOrders } from "../use-live-orders";
import { statusLabels } from "../types";
import {
  EmptyState,
  ErrorState,
  Price,
  Button,
} from "@/components/ui/primitives";
export function OrderList() {
  const { orders, loading, error, connection, refresh } = useLiveOrders();
  if (error)
    return (
      <ErrorState message={error}>
        <Button onClick={refresh}>Volver a consultar</Button>
      </ErrorState>
    );
  if (loading) return <p>Consultando pedidos…</p>;
  const sorted = [...orders].sort(
    (a, b) =>
      Number(
        ["delivered", "canceled", "expired", "uncollected"].includes(a.status),
      ) -
      Number(
        ["delivered", "canceled", "expired", "uncollected"].includes(b.status),
      ),
  );
  return (
    <>
      <p className="muted">{connection} · pedidos de esta sesión</p>
      {!orders.length && (
        <EmptyState title="Todavía no hay pedidos">
          <Link href="/">Explorá los locales</Link>
        </EmptyState>
      )}
      {sorted.map((o) => (
        <Link href={`/orders/${o.id}`} key={o.id} className="venue-link">
          <div className="row between">
            <h2>{o.venue.name}</h2>
            <Price amount={o.total_minor} />
          </div>
          <p>
            {statusLabels[o.status]} · #{o.public_code}
          </p>
          <time className="muted">
            {new Date(o.created_at).toLocaleString("es-CR", {
              timeZone: "America/Costa_Rica",
            })}
          </time>
        </Link>
      ))}
    </>
  );
}
