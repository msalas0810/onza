import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { isAllowedRequestOrigin } from "@/lib/request-origin";
import { errorCode, errorMessage } from "@/lib/errors";
import { changeTemporaryPassword } from "@/features/team/server/team-service";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request))
    return NextResponse.json(
      { error: "NOT_AUTHORIZED", message: "Origen no autorizado." },
      { status: 403, headers },
    );
  try {
    const { password } = z
      .object({ password: z.string().min(1).max(200) })
      .parse(await request.json());
    return NextResponse.json(await changeTemporaryPassword(password), {
      headers,
    });
  } catch (error) {
    const code = error instanceof ZodError ? "INVALID_INPUT" : errorCode(error);
    return NextResponse.json(
      { error: code, message: errorMessage(new Error(code)) },
      {
        status:
          code === "SESSION_REQUIRED"
            ? 401
            : code === "WEAK_PASSWORD" || code === "SAME_PASSWORD" || code === "INVALID_INPUT"
              ? 422
              : 503,
        headers,
      },
    );
  }
}
