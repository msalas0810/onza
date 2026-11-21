import { isAllowedRequestOrigin } from "@/lib/request-origin";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { executeCommand } from "@/features/orders/server/order-service";
import { CommandFailure, errorCode, errorMessage } from "@/lib/errors";
import { auditFields, logEvent, readJson, requestId } from "@/lib/audit-log";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const id = requestId(request);
  const started = Date.now();
  let fields: ReturnType<typeof auditFields> = {};
  if (!isAllowedRequestOrigin(request)) {
    logEvent({ event: "command", requestId: id, status: 403, code: "NOT_AUTHORIZED" });
    return NextResponse.json(
      { error: "NOT_AUTHORIZED", message: "Origen no autorizado." },
      { status: 403, headers: { "x-onza-request-id": id } },
    );
  }
  try {
    const body = await readJson(request, 20000);
    fields = auditFields(body);
    const result = await executeCommand(body);
    logEvent({ event: "command", requestId: id, status: 200, ms: Date.now() - started, ...fields });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store", "x-onza-request-id": id },
    });
  } catch (error) {
    const code = error instanceof ZodError ? "INVALID_INPUT" : errorCode(error);
    const status =
      error instanceof ZodError
        ? 422
        : code === "SESSION_REQUIRED"
          ? 401
          : code === "RESOURCE_NOT_FOUND"
            ? 404
            : code === "NOT_AUTHORIZED" ||
                code === "PASSWORD_CHANGE_REQUIRED" ||
                code === "STAFF_CANNOT_ORDER" ||
                code === "ONBOARDING_REQUIRED"
              ? 403
              : code === "ACCOUNT_REQUIRED"
                ? 401
                : code === "SUPABASE_NOT_CONFIGURED" ||
                    code === "CONNECTION_ERROR"
                  ? 503
                  : code === "RATE_LIMITED"
                    ? 429
                    : 409;
    const detail = error instanceof CommandFailure ? error.detail : undefined;
    logEvent({ event: "command", requestId: id, status, code, ms: Date.now() - started, ...fields });
    return NextResponse.json(
      { error: code, message: errorMessage(new Error(code)), detail },
      { status, headers: { "Cache-Control": "no-store", "x-onza-request-id": id } },
    );
  }
}
