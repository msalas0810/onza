import { NextResponse } from "next/server";
import { z } from "zod";
import { getDeliveryOptions } from "@/features/delivery/server/queries";
import { errorCode, errorMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";
/** Cómo entrega un local y sus lugares habilitados, para el checkout. Lectura pública. */
export async function GET(request: Request) {
  try {
    const venue = z
      .string()
      .uuid()
      .parse(new URL(request.url).searchParams.get("venue"));
    return NextResponse.json(await getDeliveryOptions(venue), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const code = error instanceof z.ZodError ? "INVALID_INPUT" : errorCode(error);
    return NextResponse.json(
      { error: code, message: errorMessage(new Error(code)) },
      {
        status: error instanceof z.ZodError ? 422 : code === "RESOURCE_NOT_FOUND" ? 404 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
