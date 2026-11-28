import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { readJson } from "@/lib/audit-log";
import { adminDb } from "@/lib/supabase/admin";
import { guardPlatformRequest } from "@/lib/platform/guard";
import { inviteUrl, newInviteToken } from "@/lib/platform/invite";
import { commandSchema, normalizeOrganization } from "@/features/platform/schemas";
import { noStore, platformFailure, rejectForeignOrigin } from "@/features/platform/http";

export const dynamic = "force-dynamic";

function unwrap<T>(result: { data: unknown; error: { message: string } | null }) {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

/**
 * Acciones del panel de plataforma. TODAS son sensibles: exigen el operador verificado, la sesión viva y un segundo factor de los
 * últimos 15 minutos (REAUTH_REQUIRED si no). El orden es: comprobación del operador → origen → datos → acción, de modo que una
 * cuenta ajena recibe 404 aunque el origen o los datos sean incorrectos.
 */
export async function POST(request: Request) {
  const guard = await guardPlatformRequest(request, { sensitive: true });
  if (!guard.ok) return guard.response;
  const { db, meta } = guard.ctx;
  const denied = rejectForeignOrigin(request);
  if (denied) return denied;
  try {
    const cmd = commandSchema.parse(await readJson(request, 30_000));
    switch (cmd.command) {
      case "onboard": {
        const { token, hash } = newInviteToken();
        const { notes, ...org } = normalizeOrganization(cmd.organization);
        const created = unwrap<{ organization_id: string; venue_id: string; invitation_id: string; expires_at: string; menu_path: string }>(
          await db.rpc("platform_onboard", {
            input: { organization: { ...org, notes }, venue: cmd.venue, owner: { email: cmd.owner.email, tokenHash: hash }, meta },
          }),
        );
        const origin = process.env.APP_ORIGIN ?? new URL(request.url).origin;
        const menuUrl = `${origin}${created.menu_path}`;
        const qr = await QRCode.toDataURL(menuUrl, { width: 480, margin: 2, errorCorrectionLevel: "M" });
        // El enlace con el token se muestra UNA vez en esta respuesta; la base solo guarda su hash.
        return NextResponse.json({ ok: true, result: { ...created, menuUrl, qr, inviteUrl: inviteUrl(token, origin) } }, { headers: noStore });
      }
      case "org_update":
        return ok(unwrap(await db.rpc("platform_org_update", { input: { id: cmd.id, values: cmd.values, meta } })));
      case "org_status":
        return ok(unwrap(await db.rpc("platform_org_set_status", { input: { id: cmd.id, status: cmd.status, reason: cmd.reason ?? "", meta } })));
      case "org_delete":
        return ok(unwrap(await db.rpc("platform_org_delete", { input: { id: cmd.id, confirmSlug: cmd.confirmSlug, meta } })));
      case "venue_create":
        return ok(unwrap(await db.rpc("platform_venue_create", { input: { organizationId: cmd.organizationId, ...cmd.venue, meta } })));
      case "venue_update":
        return ok(unwrap(await db.rpc("platform_venue_update", { input: { id: cmd.id, values: cmd.values, meta } })));
      case "venue_status":
        return ok(unwrap(await db.rpc("platform_venue_set_status", { input: { id: cmd.id, action: cmd.action, reason: cmd.reason ?? "", meta } })));
      case "venue_delete":
        return ok(unwrap(await db.rpc("platform_venue_delete", { input: { id: cmd.id, confirmSlug: cmd.confirmSlug, meta } })));
      case "invitation_create": {
        const { token, hash } = newInviteToken();
        const created = unwrap<{ id: string; expires_at: string }>(
          await db.rpc("platform_invitation_create", {
            input: { organizationId: cmd.organizationId, email: cmd.email, role: cmd.role, venueIds: cmd.venueIds ?? null, tokenHash: hash, meta },
          }),
        );
        return ok({ ...created, inviteUrl: inviteUrl(token, process.env.APP_ORIGIN ?? new URL(request.url).origin) });
      }
      case "invitation_revoke":
        return ok(unwrap(await db.rpc("platform_invitation_revoke", { input: { id: cmd.id, meta } })));
      case "user": {
        // La base autoriza (nunca sobre el operador) y registra; el proveedor de autenticación aplica la suspensión o el borrado.
        unwrap(await db.rpc("platform_user_target", { p_user: cmd.userId }));
        const admin = adminDb();
        const recorded = unwrap(await db.rpc("platform_user_record", { input: { userId: cmd.userId, action: cmd.action, meta } }));
        const done =
          cmd.action === "delete"
            ? await admin.auth.admin.deleteUser(cmd.userId)
            : await admin.auth.admin.updateUserById(cmd.userId, { ban_duration: cmd.action === "suspend" ? "876000h" : "none" });
        if (done.error) throw new Error("AUTH_ADMIN_FAILED");
        return ok(recorded);
      }
    }
  } catch (error) {
    return platformFailure(error);
  }
}

const ok = (result: unknown) => NextResponse.json({ ok: true, result }, { headers: noStore });
