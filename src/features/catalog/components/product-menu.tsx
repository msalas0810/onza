"use client";
import { useState } from "react";
import Link from "next/link";
import type { Venue, Product } from "../server/queries";
import { TextField, Price, EmptyState } from "@/components/ui/primitives";
import { CartDock } from "@/features/orders/components/cart-dock";
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
  const visible = products.filter((p) =>
    (p.name + " " + p.description)
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  return (
    <>
      <div className="stack menu-search">
        <TextField
          label="Buscar en el menú"
          placeholder="¿Qué te servimos?"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <nav className="category-tabs" aria-label="Categorías">
        {categories.map((c) => (
          <a href={`#category-${c.id}`} key={c.id}>
            {c.label}
          </a>
        ))}
      </nav>
      {categories
        .filter((c) => visible.some((p) => p.category_id === c.id))
        .map((c) => (
          <section className="category" id={`category-${c.id}`} key={c.id}>
            <h2>{c.label}</h2>
            {visible
              .filter((p) => p.category_id === c.id)
              .map((p) => (
                <article className="product-row" key={p.id}>
                  <div className="product-copy">
                    <Link href={`/v/${venue.slug}/p/${p.id}`}>
                      <h3>{p.name}</h3>
                      <p>{p.description}</p>
                    </Link>
                    <div className="product-footer">
                      <Price amount={p.price_minor} />
                      <AddProduct product={p} venue={venue} />
                    </div>
                  </div>
                  <ProductImage
                    name={p.name}
                    src={productImageSrc(p)}
                    eager={visible.indexOf(p) < 3}
                  />
                </article>
              ))}
          </section>
        ))}
      {!visible.length && (
        <EmptyState
          title={search ? "Sin resultados" : "El menú todavía está vacío"}
        >
          {search
            ? "Probá otro nombre o borrá la búsqueda."
            : "El local aún no publicó sus tragos. Volvé más tarde."}
        </EmptyState>
      )}
      <CartDock venueId={venue.id} />
    </>
  );
}
