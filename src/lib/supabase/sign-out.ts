"use client";
import { browserDb } from "./browser";

/**
 * Cierra la sesión de ESTE dispositivo. Decisión de auditoría (D-2026-11-21-01): supabase-js cierra por defecto en
 * `global` (todas las sesiones de la cuenta); un empleado que sale de la tablet de la barra no puede perder su sesión
 * en el teléfono ni al revés. Cerrar en todos los dispositivos es una acción explícita (`everywhere`).
 */
export async function signOutDevice({
  everywhere = false,
}: { everywhere?: boolean } = {}) {
  return browserDb().auth.signOut({ scope: everywhere ? "global" : "local" });
}
