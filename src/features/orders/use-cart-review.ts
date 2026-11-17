"use client";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { browserDb } from "@/lib/supabase/browser";
import { readCart, writeCart, type Cart } from "./cart-store";

export type CartIssue =
  | { code: "OUT_OF_STOCK" }
  | { code: "PRICE_CHANGED"; priceMinor: number; version: number };
export type VenueState = "open" | "paused" | "closed";
const products = z.array(
  z.object({
    id: z.string(),
    price_minor: z.number(),
    version: z.number(),
    available: z.boolean(),
  }),
);

/**
 * Contrasta el carrito local con el menú vigente: productos agotados, precios nuevos y estado del local. Es solo una ayuda
 * visual; el servidor vuelve a verificar precio, stock y estado al pedir.
 */
export function useCartReview(cart: Cart | null) {
  const [issues, setIssues] = useState<Record<string, CartIssue>>({});
  const [venue, setVenue] = useState<VenueState>("open");
  const [reviewing, setReviewing] = useState(false);
  const [failed, setFailed] = useState(false);
  const venueId = cart?.venueId;
  const signature = cart?.items
    .map((i) => `${i.productId}:${i.version}:${i.priceMinor}`)
    .join("|");
  const review = useCallback(async () => {
    if (!venueId || !navigator.onLine) return;
    setReviewing(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/catalog?venue=${venueId}`, {
        cache: "no-store",
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error();
      const menu = products.parse(body);
      const next: Record<string, CartIssue> = {};
      const current = readCart();
      for (const item of current?.items ?? []) {
        const product = menu.find((p) => p.id === item.productId);
        if (!product || !product.available) next[item.productId] = { code: "OUT_OF_STOCK" };
        else if (product.version !== item.version) {
          if (product.price_minor === item.priceMinor && current)
            // Cambió el producto pero no el precio: se actualiza la versión sin molestar a la persona.
            writeCart({
              ...current,
              items: current.items.map((i) =>
                i.productId === item.productId ? { ...i, version: product.version } : i,
              ),
            });
          else
            next[item.productId] = {
              code: "PRICE_CHANGED",
              priceMinor: product.price_minor,
              version: product.version,
            };
        }
      }
      setIssues(next);
      const { data } = await browserDb()
        .from("venues")
        .select("open_state,paused")
        .eq("id", venueId)
        .maybeSingle();
      if (data)
        setVenue(
          data.open_state !== "open" ? "closed" : data.paused ? "paused" : "open",
        );
    } catch {
      setFailed(true);
    } finally {
      setReviewing(false);
    }
  }, [venueId]);
  useEffect(() => {
    // Diferido un tick: la revisión actualiza estado y no debe hacerlo de forma síncrona dentro del efecto.
    const timer = setTimeout(() => void review(), 0);
    return () => clearTimeout(timer);
  }, [review, signature]);
  return { issues, venue, reviewing, failed, review };
}
