import "server-only";
import { serverDb } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.generated";
export type Venue = Database["public"]["Tables"]["venues"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export async function getVenues() {
  const db = await serverDb();
  // Solo los locales publicados. Si la migración demo_listing aún no está aplicada (columna inexistente), se
  // listan todos como antes: el frontend nuevo nunca deja Explorar sin datos por ir por delante de la base.
  for (const listedOnly of [true, false]) {
    const venues: Venue[] = [];
    let missingColumn = false;
    // Se pagina todo antes de ordenar por distancia; un tope por nombre puede ocultar el local más cercano.
    for (let from = 0; ; from += 200) {
      let query = db
        .from("venues")
        .select("*")
        .order("id")
        .range(from, from + 199);
      if (listedOnly) query = query.eq("demo_listed", true);
      const { data, error } = await query;
      if (error) {
        if (listedOnly && error.code === "42703") {
          missingColumn = true;
          break;
        }
        throw error;
      }
      venues.push(...data);
      if (data.length < 200) break;
    }
    if (!missingColumn) return venues;
  }
  return [];
}
/**
 * Menú publicado. Orden estable por nombre: agotar un producto no lo mueve de lugar (antes saltaba al final y parecía
 * desaparecer). Los agotados siguen visibles con su etiqueta; los archivados no se publican.
 */
export async function getPublishedMenu(venueId: string) {
  return menuQuery(venueId, false);
}
/** Menú completo para administración: incluye archivados (la política products_read solo se los muestra al admin). */
export async function getAdminMenu(venueId: string) {
  return menuQuery(venueId, true);
}
async function menuQuery(venueId: string, includeArchived: boolean) {
  const db = await serverDb();
  let productQuery = db
    .from("products")
    .select("*")
    .eq("venue_id", venueId)
    .order("name")
    .order("id")
    .limit(300);
  if (!includeArchived) productQuery = productQuery.eq("archived", false);
  const [products, categories] = await Promise.all([
    productQuery,
    db
      .from("categories")
      .select("*")
      .eq("venue_id", venueId)
      .order("position")
      .limit(50),
  ]);
  if (products.error) throw products.error;
  if (categories.error) throw categories.error;
  return { products: products.data, categories: categories.data };
}
export async function getVenue(slug: string) {
  const db = await serverDb();
  const { data, error } = await db
    .from("venues")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error?.code === "PGRST116") throw new Error("RESOURCE_NOT_FOUND");
  if (error) throw error;
  return data;
}
