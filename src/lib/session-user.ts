import "server-only";
import { isConfigured } from "@/lib/supabase/config";
import { serverDb } from "@/lib/supabase/server";

/** Id del usuario con sesión (o null). Solo identifica el carrito local; nunca decide permisos. */
export async function currentUserId() {
  if (!isConfigured()) return null;
  try {
    const db = await serverDb();
    const {
      data: { user },
    } = await db.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}
