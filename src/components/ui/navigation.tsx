"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "lucide-react";
import { useCart } from "@/features/orders/cart-store";
const AUTH_PAGES =
  /^\/(acceso|confirmar|recuperar|restablecer|onboarding|sesion-activa|equipo)(\/|$)/;
export function CustomerNavigation() {
  const path = usePathname();
  const staff = /^\/(staff|admin|onza)(\/|$)/.test(path);
  if (AUTH_PAGES.test(path)) return null;
  return (
    <nav
      className="bottom-nav"
      aria-label={staff ? "Navegación del personal" : "Navegación principal"}
    >
      {staff ? (
        <>
          <Link href="/equipo/acceso">Espacios de trabajo</Link>
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
          <Link
            href="/cuenta"
            aria-current={path.startsWith("/cuenta") ? "page" : undefined}
          >
            Cuenta
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
    /^\/(staff|admin|onza|cart|checkout|acceso|equipo|onboarding|sesion-activa)(\/|$)/.test(
      path,
    )
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
export function HeaderAccountLink() {
  const path = usePathname();
  if (AUTH_PAGES.test(path) || /^\/(staff|admin|onza)(\/|$)/.test(path))
    return null;
  return (
    <Link className="settings-link" href="/cuenta" aria-label="Cuenta">
      <User size={20} aria-hidden="true" />
    </Link>
  );
}
