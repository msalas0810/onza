import { NextResponse } from "next/server";
import { getVenueSummary } from "@/features/analytics/server/queries";
import { errorMessage } from "@/lib/errors";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const venue = z.string().uuid().parse(params.get("venue"));
    const day = z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .parse(params.get("day"));
    return NextResponse.json(await getVenueSummary(venue, day), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { message: errorMessage(error) },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
}
