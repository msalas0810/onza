import { NextResponse } from "next/server";
import { z } from "zod";
import { exportVenueOrders } from "@/features/delivery/server/export";
import { errorCode, errorMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** CSV de pedidos del período (noches operativas). Solo administración del local; la base vuelve a comprobarlo. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const venue = z.string().uuid().parse(params.get("venue"));
    const from = day.parse(params.get("from"));
    const to = day.parse(params.get("to") ?? from);
    const { csv, truncated } = await exportVenueOrders(venue, from, to);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="onza-pedidos-${from}_${to}.csv"`,
        "Cache-Control": "no-store",
        "X-Onza-Truncated": truncated ? "1" : "0",
      },
    });
  } catch (error) {
    const code = error instanceof z.ZodError ? "INVALID_INPUT" : errorCode(error);
    return NextResponse.json(
      { error: code, message: errorMessage(new Error(code)) },
      {
        status:
          code === "INVALID_INPUT" ? 422 : code === "SESSION_REQUIRED" ? 401 : code === "CONNECTION_ERROR" ? 503 : 403,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
