"use client";
import type { FailureDetail } from "@/lib/errors";
export class CommandError extends Error {
  constructor(
    message: string,
    public code: string,
    public detail?: FailureDetail,
  ) {
    super(message);
  }
}
/** El servidor no reconoce la sesión (venció o se revocó): la pantalla ofrece volver a entrar sin perder lo local. */
export const isSessionError = (error: unknown) =>
  error instanceof CommandError &&
  ["SESSION_REQUIRED", "ACCOUNT_REQUIRED"].includes(error.code);
/** La cuenta del equipo tiene una contraseña temporal pendiente de cambio. */
export const isPasswordChangeError = (error: unknown) =>
  error instanceof CommandError && error.code === "PASSWORD_CHANGE_REQUIRED";
export async function sendCommand(input: Record<string, unknown>) {
  if (!navigator.onLine)
    throw new CommandError(
      "Sin conexión. No se hizo ningún cambio. Volvé a intentar al reconectar.",
      "OFFLINE",
    );
  let response: Response;
  try {
    response = await fetch("/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new CommandError(
      "No pudimos conectar con el servicio. Revisá tu conexión y consultá el estado antes de reintentar.",
      "CONNECTION_ERROR",
    );
  }
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof result === "object" && result && "message" in result
        ? String(result.message)
        : "No pudimos completar la operación.";
    const code =
      typeof result === "object" && result && "error" in result
        ? String(result.error)
        : "UNKNOWN_ERROR";
    const detail =
      typeof result === "object" && result && "detail" in result
        ? (result.detail as FailureDetail | undefined)
        : undefined;
    throw new CommandError(message, code, detail ?? undefined);
  }
  return result;
}
