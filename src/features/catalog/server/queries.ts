import "server-only";
import { serverDb } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.generated";
export type Venue = Database["public"]["Tables"]["venues"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export async function getVenues() {
  const db = await serverDb();
  const { data, error } = await db
    .from("venues")
    .select("*")
    .order("name")
    .limit(50);
  if (error) throw error;
  return data;
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
  if (error) throw error;
  return data;
}
