"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/features/orders/cart-store";
export function CustomerNavigation() {
  const path = usePathname();
  const staff = /^\/(staff|admin|onza)(\/|$)/.test(path);
  return (
    <nav
      className="bottom-nav"
      aria-label={staff ? "Navegación del personal" : "Navegación principal"}
    >
      {staff ? (
        <>
          <Link href="/login">Espacios de trabajo</Link>
          <Link href="/settings">Ajustes</Link>
        </>
      ) : (
        <>
          <Link href="/" aria-current={path === "/" ? "page" : undefined}>
            Explorar
          </Link>
          <Link
            href="/orders"
            aria-current={path.startsWith("/orders") ? "page" : undefined}
          >
            Pedidos
          </Link>
        </>
      )}
    </nav>
  );
}
export function SavedCartLink() {
  const cart = useCart();
  const path = usePathname();
  if (
    !cart?.items.length ||
    path === `/v/${cart.venueSlug}` ||
    path.startsWith(`/v/${cart.venueSlug}/`) ||
    /^\/(staff|admin|onza|cart|checkout)(\/|$)/.test(path)
  )
    return null;
  return (
    <div className="saved-cart">
      <Link className="link-button" href="/cart">
        Carrito de {cart.venueName} →
      </Link>
    </div>
  );
}
