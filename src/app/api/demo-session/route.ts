import { NextResponse } from "next/server";
import { z } from "zod";
import { isAllowedRequestOrigin } from "@/lib/request-origin";
import { serverDb } from "@/lib/supabase/server";
import {
  demoCredentials,
  demoEnabled,
} from "@/features/demo/server/demo-accounts";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const Body = z.object({ role: z.enum(["customer", "bartender", "admin"]) });

/** Inicia sesión con una cuenta demo leyendo sus credenciales del servidor. */
export async function POST(request: Request) {
  if (!demoEnabled())
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers });
  if (!isAllowedRequestOrigin(request))
    return NextResponse.json(
      { error: "FORBIDDEN_ORIGIN" },
      { status: 403, headers },
    );
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "INVALID_INPUT" },
      { status: 422, headers },
    );
  const credentials = demoCredentials(parsed.data.role);
  if (!credentials)
    return NextResponse.json(
      { error: "DEMO_NOT_CONFIGURED" },
      { status: 503, headers },
    );
  const { error } = await (await serverDb()).auth.signInWithPassword(
    credentials,
  );
  if (error)
    return NextResponse.json(
      { error: error.status && error.status >= 500 ? "CONNECTION_ERROR" : "DEMO_LOGIN_FAILED" },
      { status: error.status && error.status >= 500 ? 503 : 401, headers },
    );
  return NextResponse.json({ ok: true }, { headers });
}
