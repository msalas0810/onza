import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { logPlatformDenied, type DenyReason } from "./log";
import { unverifiedEmailOf } from "./token";

export type PageDecision = { action: "allow" } | { action: "notfound" } | { action: "redirect"; to: string };

type Ids = { requestId: string; ip: string; path: string };

/**
 * Decisión para las PÁGINAS del panel de plataforma, tomada en el proxy para que el 404 sea un 404 real (una página que llama a
 * notFound() después de empezar a transmitirse responde 200). Cualquier cuenta que no sea el operador recibe 404; solo el
 * operador cuya sesión murió vuelve al inicio de sesión. Sin esta clave de servicio no se puede saber quién era: 404.
 * No importa «server-only» porque el proxy no admite ese paquete.
 */
export async function platformPageDecision(
  db: SupabaseClient,
  user: User | null,
  authError: { name?: string } | null,
  ids: Ids,
): Promise<PageDecision> {
  const deny = (reason: DenyReason): PageDecision => {
    logPlatformDenied({ requestId: ids.requestId, ip: ids.ip, path: ids.path, method: "GET", reason });
    return { action: "notfound" };
  };
  if (authError) {
    if (authError.name === "AuthSessionMissingError") return deny("no_session");
    const { data: session } = await db.auth.getSession();
    const email = unverifiedEmailOf(session.session?.access_token);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (email && url && key) {
      try {
        const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: yes } = await admin.rpc("platform_is_operator_email", { p_email: email });
        if (yes === true) {
          logPlatformDenied({ requestId: ids.requestId, ip: ids.ip, path: ids.path, method: "GET", reason: "session_revoked_operator" });
          return { action: "redirect", to: "/admin/acceso?motivo=sesion" };
        }
      } catch {
        /* sin respuesta: se cierra */
      }
    }
    return deny("session_revoked_other");
  }
  if (!user || user.is_anonymous || !user.email_confirmed_at || !user.email) return deny("email_unverified");
  const { error } = await db.rpc("platform_access", { sensitive: false });
  if (error) return deny(error.message?.includes("NOT_FOUND") ? "not_operator" : "check_unavailable");
  return { action: "allow" };
}
