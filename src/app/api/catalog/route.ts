import { NextResponse } from "next/server";
import { getPublishedMenu } from "@/features/catalog/server/queries";
import { errorMessage } from "@/lib/errors";
export async function GET(request: Request) {
  try {
    const venue = new URL(request.url).searchParams.get("venue");
    if (!venue) throw new Error("INVALID_INPUT");
    return NextResponse.json((await getPublishedMenu(venue)).products, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({ message: errorMessage(error) }, { status: 503 });
  }
}
