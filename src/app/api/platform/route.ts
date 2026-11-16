import { isAllowedRequestOrigin } from "@/lib/request-origin";
import { NextResponse } from "next/server";
import { z } from "zod";
import { serverDb } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/errors";
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("venue_create"),
    name: z.string().min(1).max(100),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .max(100),
    zone: z.string().max(100),
  }),
  z.object({
    action: z.literal("membership_save"),
    venueId: z.string().uuid(),
    userId: z.string().uuid(),
    role: z.enum(["admin", "bartender"]),
  }),
]);
export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request))
    return NextResponse.json(
      { message: "Origen no autorizado" },
      { status: 403 },
    );
  try {
    const input = schema.parse(await request.json());
    const db = await serverDb();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) throw new Error("NOT_AUTHORIZED");
    const { data, error } = await db.rpc("platform_command", { input });
    if (error) throw new Error(error.message);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json({ message: errorMessage(e) }, { status: 403 });
  }
}
