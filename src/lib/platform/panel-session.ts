import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serverDb } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.generated";
import type { PanelOrg } from "@/features/platform/types";

/** Sesión del panel de empresa: sin sesión viva va al acceso; con sesión, las empresas y locales a los que pertenece. */
export async function loadPanel(path: string, params: { empresa?: string; local?: string }) {
  const db = (await serverDb()) as SupabaseClient<Database>;
  const { data, error } = await db.auth.getUser();
  if (error || !data.user || data.user.is_anonymous) redirect(`/panel/acceso?next=${encodeURIComponent(path)}`);
  const mine = await db.rpc("org_my");
  if (mine.error) throw new Error(mine.error.message);
  const orgs = (mine.data ?? []) as unknown as PanelOrg[];
  const org = orgs.find((o) => o.organization_id === params.empresa) ?? orgs[0] ?? null;
  const venue = org?.venues.find((v) => v.id === params.local) ?? null;
  return { db, orgs, org, venue, email: data.user.email ?? "" };
}
