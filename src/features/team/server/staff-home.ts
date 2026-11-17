import "server-only";
import { serverDb } from "@/lib/supabase/server";
import { safeNext } from "@/lib/access-policy";

/**
 * A dónde va una persona del equipo con sesión: cambio de clave pendiente, el destino pedido (si es del área del equipo),
 * su único local, o la lista de locales cuando son varios (o ninguno).
 */
export async function staffHome(next?: string) {
  const db = await serverDb();
  const { data: account } = await db.rpc("current_account");
  if ((account as { mustChangePassword?: boolean } | null)?.mustChangePassword)
    return "/equipo/clave";
  const destination = safeNext(next, "");
  if (/^\/(staff|admin)\/[0-9a-f-]{36}/.test(destination)) return destination;
  const { data: memberships } = await db
    .from("memberships")
    .select("venue_id,role");
  const rows = memberships ?? [];
  if (rows.length === 1 && rows[0].role !== "onza")
    return `/staff/${rows[0].venue_id}`;
  return "/equipo/locales";
}
