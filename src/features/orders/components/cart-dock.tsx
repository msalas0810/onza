"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ShoppingBag } from "lucide-react";
import { useCart, cartTotal } from "../cart-store";
import { Price } from "@/components/ui/primitives";

/** Solo aparece dentro del local dueño del carrito. El ícono baja 4 px y el total cambia al agregar (una vez). */
export function CartDock({ venueId }: { venueId: string }) {
  const cart = useCart();
  const path = usePathname();
  const count = cart?.items.reduce((n, item) => n + item.quantity, 0) ?? 0;
  const previous = useRef(count);
  const [bump, setBump] = useState(false);
  useEffect(() => {
    const grew = count > previous.current;
    previous.current = count;
    if (!grew) return;
    setBump(true);
    const timer = setTimeout(() => setBump(false), 400);
    return () => clearTimeout(timer);
  }, [count]);
  if (
    !cart?.items.length ||
    cart.venueId !== venueId ||
    !path.startsWith(`/v/${cart.venueSlug}`)
  )
    return null;
  return (
    <Link className="dock" href="/cart">
      <span className={`bag ${bump ? "drop" : ""}`}>
        <ShoppingBag size={20} aria-hidden="true" />
      </span>
      <span className="t-label" style={{ fontWeight: 600 }}>
        {count} {count === 1 ? "producto" : "productos"}
      </span>
      <span className={`total ${bump ? "tick" : ""}`}>
        <Price amount={cartTotal(cart)} />
      </span>
      <span className="go">
        Ver carrito <ChevronRight size={16} aria-hidden="true" />
      </span>
    </Link>
  );
}
