import "server-only";
import { serverDb } from "./server";

/**
 * Autoriza una pantalla o ruta del equipo. Distingue tres fallos para que la interfaz pueda actuar:
 * SESSION_REQUIRED (sin sesión del equipo → volver a entrar), PASSWORD_CHANGE_REQUIRED (clave temporal pendiente) y
 * NOT_AUTHORIZED (la cuenta no tiene acceso a este local, o se lo quitaron).
 */
export async function requireVenue(venueId: string, adminOnly = false) {
  const db = await serverDb();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user || user.is_anonymous) throw new Error("SESSION_REQUIRED");
  const { data, error: permissionError } = await db.rpc("has_venue_access", {
    venue: venueId,
    admin_only: adminOnly,
  });
  if (permissionError) throw new Error("CONNECTION_ERROR");
  if (!data) {
    if (await passwordChangePending(db))
      throw new Error("PASSWORD_CHANGE_REQUIRED");
    throw new Error("NOT_AUTHORIZED");
  }
  return { db, user };
}

/** ¿La cuenta del equipo debe cambiar su contraseña temporal antes de operar? */
export async function passwordChangePending(
  db: Awaited<ReturnType<typeof serverDb>>,
) {
  const { data } = await db.rpc("current_account");
  const value = data as { mustChangePassword?: boolean } | null;
  return value?.mustChangePassword === true;
}
