import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serverDb } from "@/lib/supabase/server";
import { adminDb } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.generated";
import { clientIpOf, logPlatformDenied, requestIdOf, type DenyReason } from "./log";

const noStore = { "Cache-Control": "no-store" };

export type PlatformContext = {
  db: SupabaseClient<Database>;
  requestId: string;
  ip: string;
  /** Datos de la petición que viajan a la auditoría (nunca el token). */
  meta: { requestId: string; ip: string };
  mfaRecent: boolean;
};
export type Guard = { ok: true; ctx: PlatformContext } | { ok: false; response: NextResponse };

/** Respuesta idéntica para cualquier cuenta que no sea el operador: 404 sin pistas de que el panel existe. */
export const notFoundResponse = () => NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: noStore });

function denied(request: Request, reason: DenyReason, ids: { requestId: string; ip: string }): Guard {
  logPlatformDenied({ requestId: ids.requestId, ip: ids.ip, path: new URL(request.url).pathname, method: request.method, reason });
  return { ok: false, response: notFoundResponse() };
}

export { unverifiedEmailOf } from "./token";
import { unverifiedEmailOf } from "./token";

type AuthFailure = { name?: string; status?: number; code?: string };
const isTransient = (e: AuthFailure) => e.name === "AuthRetryableFetchError" || (typeof e.status === "number" && e.status >= 500);

/**
 * Comprobación de CADA petición al panel:
 *  1. La sesión debe seguir viva en el proveedor de autenticación (getUser consulta al proveedor, no confía en el token).
 *     Una sesión revocada del operador responde SESSION_REVOKED; para cualquier otra cuenta, 404.
 *  2. Correo verificado y no anónimo.
 *  3. La base decide si es el operador (correo del token = correo vigente de la cuenta = correo autorizado) y, en acciones
 *     sensibles, si hay un segundo factor de los últimos 15 minutos (REAUTH_REQUIRED).
 * Todo lo que no sea el operador recibe 404 y deja un registro estructurado (sin token).
 */
export async function guardPlatformRequest(request: Request, opts: { sensitive: boolean }): Promise<Guard> {
  const ids = { requestId: requestIdOf(request), ip: clientIpOf(request) };
  let db: SupabaseClient<Database>;
  try {
    db = (await serverDb()) as SupabaseClient<Database>;
  } catch {
    return denied(request, "auth_unavailable", ids);
  }
  const { data, error } = await db.auth.getUser();
  if (error) {
    if (error.name === "AuthSessionMissingError") return denied(request, "no_session", ids);
    if (isTransient(error)) {
      logPlatformDenied({ ...ids, path: new URL(request.url).pathname, method: request.method, reason: "auth_unavailable" });
      return { ok: false, response: NextResponse.json({ error: "CONNECTION_ERROR" }, { status: 503, headers: noStore }) };
    }
    // Hay un token pero el proveedor ya no lo acepta (sesión revocada o vencida). ¿Era el del operador?
    const { data: session } = await db.auth.getSession();
    const email = unverifiedEmailOf(session.session?.access_token);
    let wasOperator = false;
    if (email) {
      try {
        const { data: yes } = await adminDb().rpc("platform_is_operator_email", { p_email: email });
        wasOperator = yes === true;
      } catch {
        wasOperator = false; // sin clave de servicio no se puede saber: se cierra (404)
      }
    }
    if (wasOperator) {
      logPlatformDenied({ ...ids, path: new URL(request.url).pathname, method: request.method, reason: "session_revoked_operator" });
      return {
        ok: false,
        response: NextResponse.json(
          { error: "SESSION_REVOKED", message: "Su sesión fue revocada o venció. Inicie sesión de nuevo." },
          { status: 401, headers: noStore },
        ),
      };
    }
    return denied(request, "session_revoked_other", ids);
  }
  const user = data.user;
  if (!user) return denied(request, "no_session", ids);
  if (user.is_anonymous || !user.email_confirmed_at || !user.email) return denied(request, "email_unverified", ids);

  const { data: access, error: accessError } = await db.rpc("platform_access", { sensitive: opts.sensitive });
  if (accessError) {
    const text = accessError.message ?? "";
    if (text.includes("REAUTH_REQUIRED"))
      return {
        ok: false,
        response: NextResponse.json(
          { error: "REAUTH_REQUIRED", message: "Esta acción requiere un código de verificación reciente. Ingréselo para continuar." },
          { status: 401, headers: noStore },
        ),
      };
    if (text.includes("NOT_FOUND")) return denied(request, "not_operator", ids);
    return denied(request, "check_unavailable", ids);
  }
  const mfaRecent = (access as { mfa_recent?: boolean } | null)?.mfa_recent === true;
  return { ok: true, ctx: { db, requestId: ids.requestId, ip: ids.ip, meta: { requestId: ids.requestId, ip: ids.ip }, mfaRecent } };
}
