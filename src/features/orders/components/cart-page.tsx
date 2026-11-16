"use client";
import { useState } from "react";
import Link from "next/link";
import {
  useCart,
  writeCart,
  cartTotal,
  setProductQuantity,
} from "../cart-store";
import {
  Button,
  Price,
  QuantityStepper,
  EmptyState,
} from "@/components/ui/primitives";
export function CartPage() {
  const cart = useCart();
  const [error, setError] = useState("");
  if (!cart?.items.length)
    return (
      <EmptyState title="Tu carrito está vacío">
        <Link className="link-button" href="/">
          Explorá los locales
        </Link>
      </EmptyState>
    );
  return (
    <>
      <h1>Carrito</h1>
      <p className="muted">{cart.venueName} · un solo local</p>
      {cart.items.map((item) => (
        <article className="product-row" key={item.productId}>
          <div>
            <h2>{item.name}</h2>
            <Price amount={item.priceMinor} />
            <p className="muted">
              Subtotal <Price amount={item.priceMinor * item.quantity} />
            </p>
            <div className="row wrap">
              <QuantityStepper
                value={item.quantity}
                onChange={(value) => {
                  setProductQuantity(item.productId, value);
                }}
              />
              <Button
                variant="quiet"
                aria-label={`Quitar ${item.name}`}
                onClick={() => setProductQuantity(item.productId, 0)}
              >
                Quitar
              </Button>
            </div>
          </div>
        </article>
      ))}
      <div className="stack">
        <div className="row between">
          <h2>Total final</h2>
          <Price amount={cartTotal(cart)} />
        </div>
        <Link className="button primary" href="/checkout">
          Continuar
        </Link>
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              const response = await fetch(
                `/api/catalog?venue=${cart.venueId}`,
              );
              const body = await response.json();
              if (!response.ok) throw new Error(body.message);
              const { z } = await import("zod");
              const products = z
                .array(
                  z.object({
                    id: z.string(),
                    name: z.string(),
                    price_minor: z.number(),
                    version: z.number(),
                    available: z.boolean(),
                  }),
                )
                .parse(body);
              const items = cart.items.flatMap((item) => {
                const p = products.find(
                  (p) => p.id === item.productId && p.available,
                );
                return p
                  ? [
                      {
                        ...item,
                        name: p.name,
                        priceMinor: p.price_minor,
                        version: p.version,
                      },
                    ]
                  : [];
              });
              writeCart({ ...cart, items });
              setError(
                "Precios actualizados. Revisá el total; se quitaron los productos no disponibles.",
              );
            } catch {
              setError("No pudimos actualizar el menú. Revisá tu conexión.");
            }
          }}
        >
          Revisar precios y disponibilidad
        </Button>
        <Link className="link-button" href={`/v/${cart.venueSlug}`}>
          Seguir eligiendo
        </Link>
        <Button
          variant="quiet"
          onClick={() => {
            if (
              confirm(
                `¿Vaciar el carrito de ${cart.venueName}? Se quitarán todos los productos.`,
              )
            )
              writeCart(null);
          }}
        >
          Vaciar carrito
        </Button>
        <p role="status">{error}</p>
      </div>
    </>
  );
}
