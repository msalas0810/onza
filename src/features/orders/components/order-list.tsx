"use client";
import Link from "next/link";
import { useLiveOrders } from "../use-live-orders";
import { orderStatusLabel } from "../types";
import { spotText } from "@/features/delivery/types";
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
import { ProductImage } from "@/features/catalog/components/product-image";
import { productImageSrc } from "@/features/catalog/product-image-src";
import { groupByNight, nightLabel } from "../night";

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
  const card = (o: (typeof orders)[number]) => {
    const first = o.items[0];
    const units = o.items.reduce((n, i) => n + i.quantity, 0);
    const more = o.items.length - 1;
    return (
      <Link href={`/orders/${o.id}`} key={o.id} className="ocard-c">
        <span className="thumb">
          <ProductImage
            name={first?.name_snapshot ?? o.venue.name}
            src={first ? productImageSrc({ image_url: first.image_url ?? null, photo_path: first.photo_path ?? null }) : null}
          />
        </span>
        <div className="grow">
          <div className="row between">
            <h3>{o.venue.name}</h3>
            <Price amount={o.total_minor} />
          </div>
          <p className="muted t-label">
            {first ? `${first.quantity}× ${first.name_snapshot}` : ""}
            {more > 0 && ` · +${more} más`}
            {` · ${units} ${units === 1 ? "producto" : "productos"}`}
            {o.fulfillment === "location" &&
              ` · ${o.status === "delivered" ? "Entregado en" : "Entrega en"} ${spotText(o)}`}
          </p>
          <div className="row between">
            <span className="num muted t-label">#{o.public_code}</span>
            <StatusBadge tone={tone(o.status)}>
              {orderStatusLabel(o)}
            </StatusBadge>
          </div>
        </div>
      </Link>
    );
  };
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
            <section aria-labelledby="orders-active">
              <h2
                id="orders-active"
                className="eyebrow section-label"
                style={{ marginTop: 0 }}
              >
                En curso
              </h2>
              <div className="order-cards">{active.map(card)}</div>
            </section>
          )}
          {groupByNight(past).map(({ day, items }) => (
            <section key={day} aria-labelledby={`night-${day}`}>
              <h2 id={`night-${day}`} className="eyebrow section-label">
                {nightLabel(day)}
              </h2>
              <div className="order-cards">{items.map(card)}</div>
            </section>
          ))}
        </>
      )}
    </>
  );
}
