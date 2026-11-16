import { it, expect } from "vitest";
import { parseCart, cartTotal } from "@/features/orders/cart-store";
it("valida el borrador sin cargar un validador general en el catálogo", () => {
  const valid = {
    venueId: "venue",
    venueName: "Local",
    venueSlug: "local",
    items: [
      {
        productId: "product",
        name: "Producto",
        priceMinor: 450000,
        version: 1,
        quantity: 2,
      },
    ],
  };
  expect(cartTotal(parseCart(JSON.stringify(valid)))).toBe(900000);
  expect(parseCart("invalid")).toBeNull();
  expect(
    parseCart(
      JSON.stringify({
        ...valid,
        items: [{ ...valid.items[0], quantity: 11 }],
      }),
    ),
  ).toBeNull();
  expect(
    parseCart(
      JSON.stringify({
        ...valid,
        items: [{ ...valid.items[0], priceMinor: 1.5 }],
      }),
    ),
  ).toBeNull();
});
