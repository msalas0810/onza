import { NextResponse } from "next/server";
import { readJson } from "@/lib/audit-log";
import { companySession } from "@/lib/platform/session";
import { inviteUrl, newInviteToken } from "@/lib/platform/invite";
import { panelCommandSchema } from "@/features/platform/panel-schemas";
import { noStore, platformFailure, rejectForeignOrigin } from "@/features/platform/http";

export const dynamic = "force-dynamic";
const unwrap = <T,>(r: { data: unknown; error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
};

/** Acciones del panel de empresa: ajustes del local y personal por invitación. La base valida rol, alcance y empresa activa. */
export async function POST(request: Request) {
  const denied = rejectForeignOrigin(request);
  if (denied) return denied;
  try {
    const { db, meta } = await companySession(request);
    const cmd = panelCommandSchema.parse(await readJson(request, 20_000));
    const origin = process.env.APP_ORIGIN ?? new URL(request.url).origin;
    switch (cmd.command) {
      case "venue_settings":
        return ok(unwrap(await db.rpc("org_venue_settings_save", { input: { venueId: cmd.venueId, values: cmd.values, meta } })));
      case "invitation_create": {
        const { token, hash } = newInviteToken();
        const created = unwrap<{ id: string; expires_at: string }>(
          await db.rpc("org_invitation_create", { input: { organizationId: cmd.organizationId, email: cmd.email, role: cmd.role, venueIds: cmd.venueIds ?? null, tokenHash: hash, meta } }),
        );
        return ok({ ...created, inviteUrl: inviteUrl(token, origin) });
      }
      case "invitation_resend": {
        const { token, hash } = newInviteToken();
        const done = unwrap<{ id: string; expires_at: string }>(await db.rpc("org_invitation_resend", { input: { id: cmd.id, tokenHash: hash, meta } }));
        return ok({ ...done, inviteUrl: inviteUrl(token, origin) });
      }
      case "invitation_revoke":
        return ok(unwrap(await db.rpc("org_invitation_revoke", { input: { id: cmd.id, meta } })));
      case "member_set":
        return ok(unwrap(await db.rpc("org_member_set", { input: { organizationId: cmd.organizationId, userId: cmd.userId, role: cmd.role, venueIds: cmd.venueIds ?? null, meta } })));
      case "member_remove":
        return ok(unwrap(await db.rpc("org_member_remove", { input: { organizationId: cmd.organizationId, userId: cmd.userId, meta } })));
    }
  } catch (error) {
    return platformFailure(error);
  }
}
const ok = (result: unknown) => NextResponse.json({ ok: true, result }, { headers: noStore });
