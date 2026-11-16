import "server-only";
import { serverDb } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.generated";
export type Venue = Database["public"]["Tables"]["venues"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export async function getVenues() {
  const db = await serverDb();
  const venues: Venue[] = [];
  // Paginate all candidates before distance ranking; a name-based cap can hide the nearest venue.
  for (let from = 0; ; from += 200) {
    const { data, error } = await db
      .from("venues")
      .select("*")
      .order("id")
      .range(from, from + 199);
    if (error) throw error;
    venues.push(...data);
    if (data.length < 200) return venues;
  }
}
export async function getPublishedMenu(venueId: string) {
  const db = await serverDb();
  const [products, categories] = await Promise.all([
    db
      .from("products")
      .select("*")
      .eq("venue_id", venueId)
      .eq("archived", false)
      .order("available", { ascending: false })
      .order("name")
      .limit(200),
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
