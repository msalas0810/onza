"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
const VenueChangeDialog = dynamic(() => import("./venue-change-dialog"), {
  ssr: false,
});
import type { Product, Venue } from "../server/queries";
import { Button, QuantityStepper } from "@/components/ui/primitives";
import {
  addProduct,
  useCart,
  setProductQuantity,
} from "@/features/orders/cart-store";
export function AddProduct({
  product,
  venue,
  detail = false,
}: {
  product: Product;
  venue: Venue;
  detail?: boolean;
}) {
  const cart = useCart();
  const inCart =
    cart?.venueId === venue.id
      ? (cart.items.find((item) => item.productId === product.id)?.quantity ??
        0)
      : 0;
  const unavailable =
    !product.available || venue.paused || venue.open_state !== "open";
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const add = (replace = false) => {
    try {
      if (addProduct(product, venue, quantity, replace)) {
        setOpen(false);
        setFeedback("Agregado al carrito");
        setTimeout(() => setFeedback(""), 2000);
      } else setOpen(true);
    } catch {
      setError(
        "No pudimos guardar el carrito en este navegador. Revisá el espacio disponible.",
      );
    }
  };
  return (
    <>
      <div className={detail ? "stack" : "product-actions"}>
        {detail && !inCart && (
          <QuantityStepper
            value={quantity}
            onChange={(value) => setQuantity(Math.max(1, value))}
          />
        )}
        {inCart > 0 && !unavailable ? (
          <QuantityStepper
            value={inCart}
            onChange={(value) => {
              try {
                setProductQuantity(product.id, value);
              } catch {
                setError("No pudimos guardar el carrito. Intentá nuevamente.");
              }
            }}
          />
        ) : (
          <Button
            variant={detail ? "primary" : "secondary"}
            disabled={
              !product.available || venue.paused || venue.open_state !== "open"
            }
            onClick={() => add()}
          >
            {!product.available
              ? "Agotado"
              : venue.paused || venue.open_state !== "open"
                ? "Pedidos no disponibles"
                : "Agregar"}
          </Button>
        )}
        <span role="status" className="sr-only">
          {feedback}
        </span>
        {error && <p role="alert">{error}</p>}
      </div>
      {open && (
        <VenueChangeDialog
          venueName={venue.name}
          currentVenueName={cart?.venueName ?? "otro local"}
          onOpenChange={setOpen}
          onReplace={() => add(true)}
        />
      )}
    </>
  );
}
