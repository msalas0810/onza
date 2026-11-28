import "server-only";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serverDb } from "@/lib/supabase/server";
import { adminDb } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.generated";
import { clientIpOf, logPlatformDenied, requestIdOf } from "./log";
import { unverifiedEmailOf } from "./token";

/**
 * Comprobación de las PÁGINAS del panel: cualquier cuenta que no sea el operador recibe 404 (notFound). Solo el operador cuya
 * sesión fue revocada vuelve al inicio de sesión del operador. La lectura no exige segundo factor; las acciones sí (API).
 */
export async function requirePlatformPage(path: string) {
  const h = await headers();
  const fake = new Request(`http://panel${path}`, { headers: h, method: "GET" });
  const ids = { requestId: requestIdOf(fake), ip: clientIpOf(fake) };
  const deny = (reason: Parameters<typeof logPlatformDenied>[0]["reason"]) => {
    logPlatformDenied({ ...ids, path, method: "GET", reason });
    notFound();
  };
  const db = (await serverDb()) as SupabaseClient<Database>;
  const { data, error } = await db.auth.getUser();
  if (error) {
    if (error.name === "AuthSessionMissingError") return deny("no_session");
    const { data: session } = await db.auth.getSession();
    const email = unverifiedEmailOf(session.session?.access_token);
    if (email) {
      try {
        const { data: yes } = await adminDb().rpc("platform_is_operator_email", { p_email: email });
        if (yes === true) redirect("/admin/acceso?motivo=sesion");
      } catch {
        /* sin clave de servicio: se cierra */
      }
    }
    return deny("session_revoked_other");
  }
  const user = data.user;
  if (!user || user.is_anonymous || !user.email_confirmed_at) return deny("email_unverified");
  const { data: access, error: accessError } = await db.rpc("platform_access", { sensitive: false });
  if (accessError) return deny(accessError.message?.includes("NOT_FOUND") ? "not_operator" : "check_unavailable");
  return { db, email: (access as { email?: string } | null)?.email ?? user.email ?? "", mfaRecent: (access as { mfa_recent?: boolean } | null)?.mfa_recent === true };
}
