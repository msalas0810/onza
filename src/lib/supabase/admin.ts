import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.generated";

/**
 * Cliente con service_role. Existe SOLO en servidor y únicamente para dar de alta cuentas laborales y cerrar un cambio
 * de contraseña temporal. Nunca se importa desde componentes cliente y la clave nunca es NEXT_PUBLIC_*.
 */
export function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("TEAM_ADMIN_NOT_CONFIGURED");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
