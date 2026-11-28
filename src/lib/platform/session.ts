import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serverDb } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.generated";
import { clientIpOf, requestIdOf } from "./log";

/** Sesión viva (consultada al proveedor) para las rutas del panel de empresa. Lanza SESSION_REQUIRED o CONNECTION_ERROR. */
export async function companySession(request: Request) {
  const db = (await serverDb()) as SupabaseClient<Database>;
  const { data, error } = await db.auth.getUser();
  if (error && (error.name === "AuthRetryableFetchError" || (error.status ?? 0) >= 500)) throw new Error("CONNECTION_ERROR");
  if (error || !data.user || data.user.is_anonymous) throw new Error("SESSION_REQUIRED");
  return { db, user: data.user, meta: { requestId: requestIdOf(request), ip: clientIpOf(request) } };
}
