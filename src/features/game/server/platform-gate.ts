import "server-only";
import { serverDb } from "@/lib/supabase/server";

/** Las páginas de ONZA exigen acceso de plataforma; la base vuelve a comprobarlo en cada función. Lanza NOT_AUTHORIZED si no. */
export async function requirePlatform() {
  const db = await serverDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("NOT_AUTHORIZED");
  const { data } = await db.rpc("has_platform_access");
  if (!data) throw new Error("NOT_AUTHORIZED");
}
