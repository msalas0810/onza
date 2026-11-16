import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { executeCommand } from "@/features/orders/server/order-service";
import { errorCode, errorMessage } from "@/lib/errors";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (
    !origin ||
    origin !== (process.env.APP_ORIGIN ?? new URL(request.url).origin)
  )
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
    const code = errorCode(error);
    const status =
      error instanceof ZodError
        ? 422
        : code === "NOT_AUTHORIZED"
          ? 403
          : code === "SUPABASE_NOT_CONFIGURED"
            ? 503
            : code === "RATE_LIMITED"
              ? 429
              : 409;
    return NextResponse.json(
      { error: code, message: errorMessage(error) },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
