import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/audit-log";
import { adminDb } from "@/lib/supabase/admin";
import { hashInviteToken, validInviteToken } from "@/lib/platform/invite";
import { noStore, platformFailure, rejectForeignOrigin } from "@/features/platform/http";

export const dynamic = "force-dynamic";
const body = z.object({ token: z.string() });

/** Muestra a quien tiene el enlace a qué empresa y rol corresponde la invitación (el token de 256 bits es el secreto). */
export async function POST(request: Request) {
  const denied = rejectForeignOrigin(request);
  if (denied) return denied;
  try {
    const { token } = body.parse(await readJson(request, 1000));
    if (!validInviteToken(token)) throw new Error("INVITATION_INVALID");
    const { data, error } = await adminDb().rpc("invitation_lookup", { p_hash: hashInviteToken(token) });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data }, { headers: noStore });
  } catch (error) {
    return platformFailure(error);
  }
}
