import { isAllowedRequestOrigin } from "@/lib/request-origin";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { executeCommand } from "@/features/orders/server/order-service";
import { errorCode, errorMessage } from "@/lib/errors";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request))
    return NextResponse.json(
      { error: "NOT_AUTHORIZED", message: "Origen no autorizado." },
      { status: 403 },
    );
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 20000)
      throw new Error("INVALID_INPUT");
    const result = await executeCommand(await request.json());
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
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
    return NextResponse.json(
      { error: code, message: errorMessage(new Error(code)) },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
