import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/audit-log";
import { adminDb } from "@/lib/supabase/admin";
import { hashInviteToken, validInviteToken } from "@/lib/platform/invite";
import { noStore, platformFailure, rejectForeignOrigin } from "@/features/platform/http";

export const dynamic = "force-dynamic";
const body = z.object({ token: z.string(), password: z.string().min(10, "WEAK_PASSWORD").max(200) });

/**
 * Activa una invitación: la persona define su propia contraseña. La cuenta se crea con el correo de la invitación ya confirmado
 * (solo quien tiene el enlace llega acá) y la invitación se consume en la base (un solo uso). La contraseña viaja solo en el
 * cuerpo de esta petición: no se registra ni se guarda en ningún otro lugar.
 */
export async function POST(request: Request) {
  const denied = rejectForeignOrigin(request);
  if (denied) return denied;
  let createdUser: string | null = null;
  try {
    const parsed = body.safeParse(await readJson(request, 2000));
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message === "WEAK_PASSWORD" ? "WEAK_PASSWORD" : "INVALID_INPUT");
    const { token, password } = parsed.data;
    if (!validInviteToken(token)) throw new Error("INVITATION_INVALID");
    const admin = adminDb();
    const hash = hashInviteToken(token);
    const { data: info, error: lookupError } = await admin.rpc("invitation_lookup", { p_hash: hash });
    if (lookupError) throw new Error(lookupError.message);
    const invite = info as { email: string; account_exists: boolean };
    if (invite.account_exists) throw new Error("ACCOUNT_EXISTS");
    const created = await admin.auth.admin.createUser({ email: invite.email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error(created.error?.message?.includes("weak") ? "WEAK_PASSWORD" : "AUTH_ADMIN_FAILED");
    createdUser = created.data.user.id;
    const { error } = await admin.rpc("invitation_accept", { p_hash: hash, p_user: createdUser });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, result: { email: invite.email } }, { headers: noStore });
  } catch (error) {
    // Si la invitación no se pudo consumir, no queda una cuenta huérfana.
    if (createdUser) await adminDb().auth.admin.deleteUser(createdUser).catch(() => undefined);
    return platformFailure(error);
  }
}
