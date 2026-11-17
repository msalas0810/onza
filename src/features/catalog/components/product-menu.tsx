"use client";
import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { Venue, Product } from "../server/queries";
import { Price, EmptyState, Button } from "@/components/ui/primitives";
import { CartDock } from "@/features/orders/components/cart-dock";
import { useCart } from "@/features/orders/cart-store";
import { AddProduct } from "./add-product";
import { ProductImage } from "./product-image";
import { productImageSrc } from "../product-image-src";

export function ProductMenu({
  venue,
  products,
  categories,
}: {
  venue: Venue;
  products: Product[];
  categories: { id: string; label: string }[];
}) {
  const [search, setSearch] = useState("");
  const cart = useCart();
  const term = search.trim().toLocaleLowerCase("es-CR");
  const visible = products.filter((p) =>
    `${p.name} ${p.description}`.toLocaleLowerCase("es-CR").includes(term),
  );
  const inCart = (id: string) =>
    cart?.venueId === venue.id
      ? (cart.items.find((item) => item.productId === id)?.quantity ?? 0)
      : 0;
  const shown = categories.filter((c) =>
    visible.some((p) => p.category_id === c.id),
  );
  return (
    <>
      <div className="stack" style={{ marginTop: 8 }}>
        <div className="search">
          <Search size={20} aria-hidden="true" />
          <input
            type="search"
            aria-label="Buscar en el menú"
            placeholder="Buscar en el menú"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {shown.length > 1 && (
          <nav className="chips" aria-label="Categorías">
            {shown.map((c) => (
              <a className="chip" href={`#category-${c.id}`} key={c.id}>
                {c.label}
              </a>
            ))}
          </nav>
        )}
      </div>
      {shown.map((c) => (
        <section className="category" id={`category-${c.id}`} key={c.id}>
          <h2 className="eyebrow section-label">{c.label}</h2>
          {visible
            .filter((p) => p.category_id === c.id)
            .map((p) => (
              <article
                className={`prow ${p.available ? "" : "soldout"}`}
                key={p.id}
              >
                <Link
                  className="thumb"
                  href={`/v/${venue.slug}/p/${p.id}`}
                  aria-label={`Ver ${p.name}`}
                  tabIndex={-1}
                >
                  <ProductImage
                    name={p.name}
                    src={productImageSrc(p)}
                    eager={visible.indexOf(p) < 3}
                  />
                </Link>
                <div className="grow">
                  <Link className="name" href={`/v/${venue.slug}/p/${p.id}`}>
                    <h3>{p.name}</h3>
                  </Link>
                  {p.description && <p className="desc">{p.description}</p>}
                  <div className="price">
                    <Price amount={p.price_minor} />
                  </div>
                  {!p.available && inCart(p.id) > 0 && (
                    <span className="flag">Se agotó · quitalo del carrito</span>
                  )}
                </div>
                <div>
                  <AddProduct product={p} venue={venue} />
                </div>
              </article>
            ))}
        </section>
      ))}
      {!visible.length && (
        <EmptyState
          icon={Search}
          title={search ? "Sin resultados" : "El menú todavía está vacío"}
          action={
            search ? (
              <Button variant="secondary" onClick={() => setSearch("")}>
                Borrar búsqueda
              </Button>
            ) : undefined
          }
        >
          {search
            ? "Probá otro nombre."
            : "El local aún no publicó sus tragos. Volvé más tarde."}
        </EmptyState>
      )}
      <CartDock venueId={venue.id} />
    </>
  );
}
