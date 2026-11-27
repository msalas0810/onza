"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Receipt, ShoppingBag, User, Users } from "lucide-react";
import { useCart } from "@/features/orders/cart-store";
import { BrandMark } from "./primitives";
import { ConnectionBanner } from "./connection-banner";

/** Rutas con su propio marco completo: acceso (pantalla oscura) y portal del equipo. */
const OWN_FRAME =
  /^\/(acceso|confirmar|recuperar|restablecer)(\/|$)|^\/equipo(\/|$)|^\/(staff|admin|onza)(\/|$)/;
/** Rutas con el dock del local o dentro del carrito: el acceso al carrito ya está en pantalla, sin icono duplicado. */
const DOCKED = /^\/v\/|^\/cart|^\/checkout/;
/** Rutas de una sola tarea: marca y nada más (sin navegación). */
const FOCUSED = /^\/(onboarding|sesion-activa)(\/|$)/;

const items = [
  {
    href: "/",
    match: /^\/$|^\/v(\/|$)|^\/cart|^\/checkout|^\/actividad/,
    label: "Explorar",
    Icon: Compass,
  },
  { href: "/orders", match: /^\/orders/, label: "Pedidos", Icon: Receipt },
  { href: "/amigos", match: /^\/amigos/, label: "Amigos", Icon: Users },
  {
    href: "/cuenta",
    match: /^\/(cuenta|settings|policies)/,
    label: "Cuenta",
    Icon: User,
  },
] as const;

export function AppHeader() {
  const path = usePathname();
  const cart = useCart();
  if (OWN_FRAME.test(path)) return null;
  const focused = FOCUSED.test(path);
  const count = cart?.items.reduce((n, item) => n + item.quantity, 0) ?? 0;
  return (
    <>
      <header className="hdr">
        <Link className="brand" href="/" aria-label="Onza, explorar">
          <BrandMark />
        </Link>
        {!focused && (
          <nav className="topnav" aria-label="Principal">
            {items.map(({ href, match, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={match.test(path) ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
        )}
        <span className="spacer" />
        {!focused && !DOCKED.test(path) && count > 0 && cart && (
          <Link
            className="icon-btn"
            href="/cart"
            aria-label={`Carrito de ${cart.venueName}: ${count} ${count === 1 ? "producto" : "productos"}`}
          >
            <ShoppingBag size={20} aria-hidden="true" />
            <span className="count num">{count}</span>
          </Link>
        )}
      </header>
      <ConnectionBanner />
    </>
  );
}

export function CustomerNavigation() {
  const path = usePathname();
  if (OWN_FRAME.test(path) || FOCUSED.test(path)) return null;
  return (
    <nav className="bnav" aria-label="Principal">
      {items.map(({ href, match, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={match.test(path) ? "page" : undefined}
        >
          <Icon size={20} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
