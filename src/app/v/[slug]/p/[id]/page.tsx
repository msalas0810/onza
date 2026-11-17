import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getVenue, getPublishedMenu } from "@/features/catalog/server/queries";
import { AddProduct } from "@/features/catalog/components/add-product";
import { Notice, Price, buttonClass } from "@/components/ui/primitives";
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
        <div style={{ marginTop: 16 }}>
          <Notice title="Cerrado">
            Este local no recibe pedidos ahora.
          </Notice>
        </div>
        <Link
          className={buttonClass({ variant: "secondary", className: "" })}
          style={{ marginTop: 16 }}
          href="/"
        >
          Explorar locales
        </Link>
      </div>
    );
  const { products } = await getPublishedMenu(venue.id);
  const product = products.find((p) => p.id === id);
  if (!product) notFound();
  return (
    <div className="page menu">
      <Link className="back" href={`/v/${slug}`}>
        <ChevronLeft size={16} aria-hidden="true" />
        {venue.name}
      </Link>
      <div className="stack" style={{ marginTop: 8 }}>
        <ProductImage
          name={product.name}
          src={productImageSrc(product)}
          size="detail"
          eager
        />
        <div>
          <h1 className="t-title">{product.name}</h1>
          <p className="t-heading" style={{ marginTop: 4 }}>
            <Price amount={product.price_minor} />
          </p>
        </div>
        {product.description && <p>{product.description}</p>}
        <p className="muted t-label">
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
