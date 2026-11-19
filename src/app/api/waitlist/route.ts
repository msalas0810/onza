import { NextResponse } from "next/server";
import { z } from "zod";
import { isAllowedRequestOrigin } from "@/lib/request-origin";
import { serverDb } from "@/lib/supabase/server";
import { errorCode, errorMessage, failureDetail } from "@/lib/errors";
export const dynamic = "force-dynamic";
const input = z.object({
  action: z.enum(["join", "status", "leave"]),
  venueId: z.string().uuid(),
});
/** Lista de espera del cliente. La base decide posición, ofertas y vencimientos; acá solo se valida y se traduce. */
export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request))
    return NextResponse.json(
      { error: "NOT_AUTHORIZED", message: "Origen no autorizado." },
      { status: 403 },
    );
  try {
    const body = input.parse(await request.json());
    const db = await serverDb();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) throw new Error("SESSION_REQUIRED");
    const { data, error } = await db.rpc("waitlist_command", { input: body });
    if (error) throw new Error(error.message);
    if (data && typeof data === "object" && !Array.isArray(data) && "error" in data) {
      const code = String(data.error);
      return NextResponse.json(
        { error: code, message: errorMessage(new Error(code)), detail: failureDetail(data) },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof z.ZodError ? "INVALID_INPUT" : errorCode(error);
    return NextResponse.json(
      { error: code, message: errorMessage(new Error(code)) },
      {
        status: code === "SESSION_REQUIRED" ? 401 : code === "STAFF_CANNOT_ORDER" ? 403 : 409,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
