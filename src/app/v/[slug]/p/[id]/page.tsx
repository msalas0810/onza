import Link from "next/link";
import { notFound } from "next/navigation";
import { getVenue, getPublishedMenu } from "@/features/catalog/server/queries";
import { AddProduct } from "@/features/catalog/components/add-product";
import { Price } from "@/components/ui/primitives";
import { ProductImage } from "@/features/catalog/components/product-image";
import { productImageSrc } from "@/features/catalog/product-image-src";
import { CartDock } from "@/features/orders/components/cart-dock";
export const dynamic = "force-dynamic";
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const venue = await getVenue(slug);
  if (venue.open_state === "closed")
    return (
      <div className="page">
        <h1>{venue.name}</h1>
        <p className="notice">Este local está cerrado y no recibe pedidos.</p>
        <Link className="link-button" href="/">
          Explorar locales
        </Link>
      </div>
    );
  const { products } = await getPublishedMenu(venue.id);
  const product = products.find((p) => p.id === id);
  if (!product) notFound();
  return (
    <div className="page">
      <Link className="link-button" href={`/v/${slug}`}>
        ← Menú de {venue.name}
      </Link>
      <ProductImage
        name={product.name}
        src={productImageSrc(product)}
        size="detail"
        eager
      />
      <div className="stack">
        <h1>{product.name}</h1>
        <Price amount={product.price_minor} />
        <p>{product.description}</p>
        <p className="muted">
          Tamaño: {product.size || "No informado"}
          <br />
          Alérgenos: {product.allergens}
        </p>
        <AddProduct product={product} venue={venue} detail />
      </div>
      <CartDock venueId={venue.id} />
    </div>
  );
}
