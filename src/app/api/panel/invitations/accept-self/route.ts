import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/audit-log";
import { companySession } from "@/lib/platform/session";
import { hashInviteToken, validInviteToken } from "@/lib/platform/invite";
import { noStore, platformFailure, rejectForeignOrigin } from "@/features/platform/http";

export const dynamic = "force-dynamic";

/** Una cuenta laboral que ya existe acepta con su propia sesión: el correo verificado debe ser el de la invitación. */
export async function POST(request: Request) {
  const denied = rejectForeignOrigin(request);
  if (denied) return denied;
  try {
    const { db } = await companySession(request);
    const { token } = z.object({ token: z.string() }).parse(await readJson(request, 1000));
    if (!validInviteToken(token)) throw new Error("INVITATION_INVALID");
    const { data, error } = await db.rpc("invitation_accept_self", { p_hash: hashInviteToken(token) });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, result: data }, { headers: noStore });
  } catch (error) {
    return platformFailure(error);
  }
}
