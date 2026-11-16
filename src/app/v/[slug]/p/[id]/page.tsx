import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getVenue, getPublishedMenu } from "@/features/catalog/server/queries";
import { AddProduct } from "@/features/catalog/components/add-product";
import { PhotoFallback, Price } from "@/components/ui/primitives";
import { CartDock } from "@/features/orders/components/cart-dock";
export const dynamic = "force-dynamic";
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const venue = await getVenue(slug);
  const { products } = await getPublishedMenu(venue.id);
  const product = products.find((p) => p.id === id);
  if (!product) notFound();
  return (
    <div className="page">
      <Link className="link-button" href={`/v/${slug}`}>
        ← Menú de {venue.name}
      </Link>
      {product.photo_path ? (
        <Image
          unoptimized
          src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/menu-photos/${product.photo_path}`}
          width={440}
          height={550}
          alt={product.name}
          className="detail-photo"
        />
      ) : (
        <PhotoFallback name={product.name} large />
      )}
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
      <CartDock />
    </div>
  );
}
