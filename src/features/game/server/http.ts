import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { errorCode, errorMessage } from "@/lib/errors";
import { isAllowedRequestOrigin } from "@/lib/request-origin";

export const noStore = { "Cache-Control": "no-store" };

const forbidden = new Set(["NOT_AUTHORIZED", "STAFF_NOT_PLAYER", "STAFF_NOT_SOCIAL", "ONBOARDING_REQUIRED", "ADULT_REQUIRED"]);
const unavailable = new Set([
  "CONNECTION_ERROR",
  "SUPABASE_NOT_CONFIGURED",
  "PROVIDER_NOT_CONFIGURED",
  "TEAM_ADMIN_NOT_CONFIGURED",
  "DEMO_NOT_CONFIGURED",
]);

/** Traduce un error a respuesta HTTP con código estable y mensaje en español. Nunca incluye detalles internos. */
export function failure(error: unknown) {
  const code =
    error instanceof ZodError || error instanceof SyntaxError ? "INVALID_INPUT" : errorCode(error);
  const status =
    code === "INVALID_INPUT" || code === "EMPTY_IMPORT"
      ? 422
      : code === "SESSION_REQUIRED" || code === "ACCOUNT_REQUIRED"
        ? 401
        : forbidden.has(code)
          ? 403
          : code === "NOT_FOUND" || code === "ITEM_NOT_FOUND" || code === "RESOURCE_NOT_FOUND"
            ? 404
            : code === "RATE_LIMITED"
              ? 429
              : unavailable.has(code)
                ? 503
                : 409;
  return NextResponse.json({ error: code, message: errorMessage(new Error(code)) }, { status, headers: noStore });
}

/** Defensa CSRF: toda escritura exige el origen configurado. */
export function rejectForeignOrigin(request: Request) {
  return isAllowedRequestOrigin(request)
    ? null
    : NextResponse.json({ error: "NOT_AUTHORIZED", message: "Origen no autorizado." }, { status: 403, headers: noStore });
}
