import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isAllowedRequestOrigin } from "@/lib/request-origin";
import { errorCode, errorMessage } from "@/lib/errors";
import { readJson } from "@/lib/audit-log";
import { getSocialOverview, runSocialAction } from "@/features/social/server/social-service";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

function failure(error: unknown) {
  const code = error instanceof ZodError ? "INVALID_INPUT" : errorCode(error);
  const status =
    code === "INVALID_INPUT"
      ? 422
      : code === "SESSION_REQUIRED" || code === "ACCOUNT_REQUIRED"
        ? 401
        : code === "STAFF_NOT_SOCIAL" || code === "ONBOARDING_REQUIRED" || code === "NOT_AUTHORIZED"
          ? 403
          : code === "FRIEND_NOT_FOUND" || code === "RESOURCE_NOT_FOUND"
            ? 404
            : code === "RATE_LIMITED"
              ? 429
              : code === "CONNECTION_ERROR" || code === "SUPABASE_NOT_CONFIGURED"
                ? 503
                : 409;
  return NextResponse.json({ error: code, message: errorMessage(new Error(code)) }, { status, headers });
}

/** Amigos, solicitudes y el check-in propio. Nunca devuelve datos de pedidos ni ubicaciones precisas. */
export async function GET() {
  try {
    return NextResponse.json(await getSocialOverview(), { headers });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request))
    return NextResponse.json({ error: "NOT_AUTHORIZED", message: "Origen no autorizado." }, { status: 403, headers });
  try {
    return NextResponse.json(await runSocialAction(await readJson(request, 2000)), { headers });
  } catch (error) {
    return failure(error);
  }
}
