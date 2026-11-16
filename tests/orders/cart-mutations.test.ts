import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  readCart,
  writeCart,
  setProductQuantity,
} from "@/features/orders/cart-store";
const values = new Map<string, string>();
beforeEach(() => {
  values.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  vi.stubGlobal("window", new EventTarget());
  writeCart({
    venueId: "a",
    venueName: "Local A",
    venueSlug: "a",
    pickupLabel: "Barra",
    items: [
      {
        productId: "p",
        name: "Trago",
        priceMinor: 100,
        version: 1,
        quantity: 2,
      },
    ],
  });
});
afterEach(() => vi.unstubAllGlobals());
it("removing final unit removes persistence and cannot resurrect on reload", () => {
  setProductQuantity("p", 1);
  expect(readCart()?.items[0].quantity).toBe(1);
  setProductQuantity("p", 0);
  expect(readCart()).toBeNull();
  expect(values.has("onza-cart-draft")).toBe(false);
});
it("clear removes entire draft and invalid quantity leaves it intact", () => {
  setProductQuantity("p", 11);
  expect(readCart()?.items[0].quantity).toBe(2);
  writeCart(null);
  expect(readCart()).toBeNull();
});
