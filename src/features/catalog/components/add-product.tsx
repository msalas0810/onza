"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
const VenueChangeDialog = dynamic(() => import("./venue-change-dialog"), {
  ssr: false,
});
import type { Product, Venue } from "../server/queries";
import {
  Button,
  QuantityStepper,
  StatusBadge,
} from "@/components/ui/primitives";
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
  const venueBlocked = venue.paused || venue.open_state !== "open";
  const unavailable = !product.available || venueBlocked;
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
  // Lo que ya está en el carrito siempre se puede bajar o quitar, aunque el producto se haya agotado: nada queda atrapado.
  const stepper = (
    <QuantityStepper
      enter
      value={inCart}
      max={unavailable ? inCart : 10}
      onChange={(value) => {
        try {
          setProductQuantity(product.id, value);
        } catch {
          setError("No pudimos guardar el carrito. Intentá nuevamente.");
        }
      }}
    />
  );
  return (
    <>
      <div className={detail ? "stack" : undefined}>
        {detail && !inCart && !unavailable && (
          <QuantityStepper
            value={quantity}
            min={1}
            onChange={(value) => setQuantity(value)}
          />
        )}
        {inCart > 0 ? (
          stepper
        ) : !product.available ? (
          <StatusBadge plain>Agotado</StatusBadge>
        ) : (
          <Button
            variant={detail ? "primary" : "secondary"}
            size={detail ? "md" : "sm"}
            block={detail}
            className={detail ? "" : "add-btn"}
            disabled={venueBlocked}
            title={
              venueBlocked ? "El local no recibe pedidos ahora" : undefined
            }
            onClick={() => add()}
          >
            Agregar
          </Button>
        )}
        <span role="status" className="sr-only">
          {feedback}
        </span>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
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
