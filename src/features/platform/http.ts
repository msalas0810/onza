import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isAllowedRequestOrigin } from "@/lib/request-origin";

export const noStore = { "Cache-Control": "no-store" };

/** Mensajes del panel (trato de «usted»). Cada código es estable; el texto nunca incluye datos internos. */
export const PLATFORM_MESSAGES: Record<string, string> = {
  NOT_FOUND: "No encontramos lo que busca.",
  REAUTH_REQUIRED: "Esta acción requiere un código de verificación reciente. Ingréselo para continuar.",
  SESSION_REVOKED: "Su sesión fue revocada o venció. Inicie sesión de nuevo.",
  SESSION_REQUIRED: "Debe iniciar sesión para continuar.",
  NOT_AUTHORIZED: "Su cuenta no tiene permiso para esta acción.",
  INVALID_INPUT: "Revise los datos e intente de nuevo.",
  INVALID_EMAIL: "Escriba un correo válido.",
  SLUG_TAKEN: "Ese enlace ya está en uso. Elija otro.",
  REASON_REQUIRED: "Escriba un motivo de al menos 5 caracteres.",
  CONFIRMATION_REQUIRED: "Escriba el enlace para confirmar que desea eliminarlo.",
  ORGANIZATION_NOT_ACTIVE: "La empresa no está activa.",
  ORGANIZATION_NOT_CLOSED: "Para eliminar una empresa, primero debe cerrarla.",
  ORGANIZATION_HAS_VENUES: "La empresa todavía tiene establecimientos. Elimínelos primero.",
  ORGANIZATION_SUSPENDED: "La empresa está suspendida y no puede operar.",
  VENUE_NOT_ARCHIVED: "Para eliminar un establecimiento, primero debe archivarlo.",
  VENUE_HAS_DATA: "El establecimiento tiene pedidos u otros datos y no se puede eliminar. Archívelo.",
  VENUE_NOT_IN_ORGANIZATION: "Uno de los establecimientos no pertenece a esta empresa.",
  VENUE_SUSPENDED: "El establecimiento está suspendido.",
  INVITATION_EXISTS: "Ya hay una invitación pendiente para ese correo.",
  INVITATION_INVALID: "La invitación no es válida, ya se usó o venció.",
  OPERATOR_PROTECTED: "La cuenta del operador de la plataforma no se puede modificar desde aquí.",
  SELF_CHANGE: "No puede cambiar su propio rol ni quitarse el acceso.",
  LAST_OWNER: "La empresa necesita al menos un propietario.",
  CUSTOMER_EMAIL: "Ese correo ya es de una cuenta personal. Use otro correo para la cuenta laboral.",
  RATE_LIMITED: "Demasiados intentos. Espere un minuto e intente de nuevo.",
  CONNECTION_ERROR: "No pudimos conectar con el servicio. Intente de nuevo.",
  TEAM_ADMIN_NOT_CONFIGURED: "Esta acción necesita la clave de servidor del proyecto, que no está configurada en este entorno.",
  AUTH_ADMIN_FAILED: "El proveedor de autenticación no completó la acción. Intente de nuevo.",
  ACCOUNT_EXISTS: "Ya existe una cuenta con ese correo. Inicie sesión para aceptar la invitación.",
  WEAK_PASSWORD: "Use al menos 10 caracteres.",
};
const CODES = Object.keys(PLATFORM_MESSAGES);
const status = (code: string) =>
  code === "NOT_FOUND"
    ? 404
    : ["REAUTH_REQUIRED", "SESSION_REVOKED", "SESSION_REQUIRED"].includes(code)
      ? 401
      : ["NOT_AUTHORIZED", "OPERATOR_PROTECTED", "SELF_CHANGE"].includes(code)
        ? 403
        : ["INVALID_INPUT", "INVALID_EMAIL", "REASON_REQUIRED", "CONFIRMATION_REQUIRED", "WEAK_PASSWORD", "INVITATION_INVALID"].includes(code)
          ? 422
          : code === "RATE_LIMITED"
            ? 429
            : ["CONNECTION_ERROR", "TEAM_ADMIN_NOT_CONFIGURED", "AUTH_ADMIN_FAILED"].includes(code)
              ? 503
              : 409;

export function platformCode(error: unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError) return "INVALID_INPUT";
  const text = error instanceof Error ? error.message : String(error);
  return CODES.find((code) => text.includes(code)) ?? "UNKNOWN_ERROR";
}

/** Error → respuesta. Los errores desconocidos no filtran detalles. */
export function platformFailure(error: unknown) {
  const code = platformCode(error);
  const message = PLATFORM_MESSAGES[code] ?? "No pudimos completar la operación. Intente de nuevo.";
  return NextResponse.json({ error: code, message }, { status: code === "UNKNOWN_ERROR" ? 500 : status(code), headers: noStore });
}

export const rejectForeignOrigin = (request: Request) =>
  isAllowedRequestOrigin(request)
    ? null
    : NextResponse.json({ error: "NOT_AUTHORIZED", message: PLATFORM_MESSAGES.NOT_AUTHORIZED }, { status: 403, headers: noStore });
