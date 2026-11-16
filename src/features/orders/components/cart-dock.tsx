"use client";
import Link from "next/link";
import { useCart, cartTotal } from "../cart-store";
import { Price } from "@/components/ui/primitives";
export function CartDock() {
  const cart = useCart();
  if (!cart?.items.length) return null;
  return (
    <div className="dock">
      <Link className="button primary between" href="/cart">
        <span>
          Ver pedido · {cart.items.reduce((n, item) => n + item.quantity, 0)}
        </span>
        <Price amount={cartTotal(cart)} />
      </Link>
    </div>
  );
}
