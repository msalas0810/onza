import { NextResponse } from "next/server";
import { serverDb } from "@/lib/supabase/server";
import { safeNext } from "@/lib/access-policy";
export const dynamic = "force-dynamic";
/** Email confirmation, password recovery and Google return here with a one-time code. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (code) {
    const db = await serverDb();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/acceso?error=enlace", url.origin));
}
