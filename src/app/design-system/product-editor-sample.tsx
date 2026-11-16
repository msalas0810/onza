"use client";
import { ProductEditor } from "@/features/admin/components/product-editor";
import type { Product } from "@/features/catalog/server/queries";

/** Client wrapper so the server-rendered design-system page can show the drink editor (its callback is a function). */
export function ProductEditorSample({
  venueId,
  product,
  categories,
}: {
  venueId: string;
  product: Product;
  categories: { id: string; label: string }[];
}) {
  return (
    <ProductEditor
      venueId={venueId}
      product={product}
      categories={categories}
      onSaved={() => undefined}
    />
  );
}
