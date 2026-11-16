"use client";
import { useSyncExternalStore } from "react";
import type { Product, Venue } from "@/features/catalog/server/queries";
export type CartItem = {
  productId: string;
  name: string;
  priceMinor: number;
  version: number;
  quantity: number;
};
export type Cart = {
  venueId: string;
  venueName: string;
  venueSlug: string;
  pickupLabel: string;
  items: CartItem[];
};
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function parseCart(raw: string): Cart | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !record(value) ||
      typeof value.venueId !== "string" ||
      typeof value.venueName !== "string" ||
      typeof value.venueSlug !== "string" ||
      !Array.isArray(value.items) ||
      value.items.length > 20
    )
      return null;
    const items: CartItem[] = [];
    for (const item of value.items) {
      if (
        !record(item) ||
        typeof item.productId !== "string" ||
        typeof item.name !== "string" ||
        typeof item.priceMinor !== "number" ||
        !Number.isSafeInteger(item.priceMinor) ||
        item.priceMinor < 0 ||
        typeof item.version !== "number" ||
        !Number.isSafeInteger(item.version) ||
        item.version < 1 ||
        typeof item.quantity !== "number" ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 10
      )
        return null;
      items.push({
        productId: item.productId,
        name: item.name,
        priceMinor: item.priceMinor,
        version: item.version,
        quantity: item.quantity,
      });
    }
    return {
      venueId: value.venueId,
      venueName: value.venueName,
      venueSlug: value.venueSlug,
      pickupLabel:
        typeof value.pickupLabel === "string"
          ? value.pickupLabel
          : "Barra principal",
      items,
    };
  } catch {
    return null;
  }
}
const storageKey = "onza-cart-draft";
const change = "onza-cart-change";
function subscribe(callback: () => void) {
  window.addEventListener(change, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(change, callback);
    window.removeEventListener("storage", callback);
  };
}
function snapshot() {
  try {
    return localStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}
export function readCart(): Cart | null {
  try {
    const raw = snapshot();
    return raw ? parseCart(raw) : null;
  } catch {
    return null;
  }
}
export function writeCart(cart: Cart | null) {
  if (cart && cart.items.length)
    localStorage.setItem(storageKey, JSON.stringify(cart));
  else localStorage.removeItem(storageKey);
  window.dispatchEvent(new Event(change));
}
export function useCart() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  try {
    return raw ? parseCart(raw) : null;
  } catch {
    return null;
  }
}
export function addProduct(
  product: Product,
  venue: Venue,
  quantity = 1,
  replace = false,
) {
  const old = readCart();
  if (old && old.venueId !== venue.id && !replace) return false;
  const cart =
    old?.venueId === venue.id
      ? old
      : {
          venueId: venue.id,
          venueName: venue.name,
          venueSlug: venue.slug,
          pickupLabel: venue.pickup_label,
          items: [],
        };
  const found = cart.items.find((item) => item.productId === product.id);
  if (found) {
    found.quantity = Math.min(10, found.quantity + quantity);
    found.version = product.version;
    found.priceMinor = product.price_minor;
  } else
    cart.items.push({
      productId: product.id,
      name: product.name,
      priceMinor: product.price_minor,
      version: product.version,
      quantity,
    });
  writeCart(cart);
  return true;
}
export function cartTotal(cart: Cart | null) {
  return (
    cart?.items.reduce(
      (total, item) => total + item.priceMinor * item.quantity,
      0,
    ) ?? 0
  );
}
