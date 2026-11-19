import { NextResponse } from "next/server";
import {
  getVenueSummary,
  getVenueSummaryRange,
} from "@/features/analytics/server/queries";
import { errorMessage } from "@/lib/errors";
import { z } from "zod";
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const venue = z.string().uuid().parse(params.get("venue"));
    if (params.has("from")) {
      const from = day.parse(params.get("from"));
      const to = day.parse(params.get("to") ?? from);
      const range = await getVenueSummaryRange(venue, from, to);
      if (!range) throw new Error("RESOURCE_NOT_FOUND");
      return NextResponse.json(range, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    return NextResponse.json(
      await getVenueSummary(venue, day.parse(params.get("day"))),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { message: errorMessage(error) },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
}
