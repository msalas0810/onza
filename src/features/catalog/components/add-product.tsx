"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
const VenueChangeDialog = dynamic(() => import("./venue-change-dialog"), {
  ssr: false,
});
import type { Product, Venue } from "../server/queries";
import { Button, QuantityStepper } from "@/components/ui/primitives";
import { addProduct } from "@/features/orders/cart-store";
export function AddProduct({
  product,
  venue,
  detail = false,
}: {
  product: Product;
  venue: Venue;
  detail?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const add = (replace = false) => {
    try {
      if (addProduct(product, venue, quantity, replace)) {
        setOpen(false);
        setFeedback("Agregado al pedido");
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
        {detail && (
          <QuantityStepper
            value={quantity}
            onChange={(value) => setQuantity(Math.max(1, value))}
          />
        )}
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
        <span role="status" className="sr-only">
          {feedback}
        </span>
        {error && <p role="alert">{error}</p>}
      </div>
      {open && (
        <VenueChangeDialog
          venueName={venue.name}
          onOpenChange={setOpen}
          onReplace={() => add(true)}
        />
      )}
    </>
  );
}
