import { NextResponse } from "next/server";
import { listOrders } from "@/features/orders/server/order-service";
import { z } from "zod";
import { errorMessage } from "@/lib/errors";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const venue = z
      .string()
      .uuid()
      .optional()
      .parse(params.get("venue") ?? undefined);
    const order = z
      .string()
      .uuid()
      .optional()
      .parse(params.get("order") ?? undefined);
    const before = z.iso
      .datetime()
      .optional()
      .parse(params.get("before") ?? undefined);
    return NextResponse.json(await listOrders(venue, order, before), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { message: errorMessage(error) },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
