"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart, cartTotal } from "../cart-store";
import { Price } from "@/components/ui/primitives";
export function CartDock({ venueId }: { venueId: string }) {
  const cart = useCart();
  const path = usePathname();
  if (
    !cart?.items.length ||
    cart.venueId !== venueId ||
    !path.startsWith(`/v/${cart.venueSlug}`)
  )
    return null;
  return (
    <div className="dock">
      <Link className="button primary between" href="/cart">
        <span>
          Ver carrito · {cart.items.reduce((n, item) => n + item.quantity, 0)}
        </span>
        <Price amount={cartTotal(cart)} />
      </Link>
    </div>
  );
}
