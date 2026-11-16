import type { Product } from "./server/queries";

/**
 * The image to show for a drink: the new image_url first; products that only have the legacy photo_path keep showing it
 * (menu-photos bucket) until the admin uploads a new image. null means "show the placeholder".
 */
export function productImageSrc(
  product: Pick<Product, "image_url" | "photo_path">,
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
) {
  if (product.image_url) return product.image_url;
  if (product.photo_path && supabaseUrl)
    return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/menu-photos/${product.photo_path}`;
  return null;
}
