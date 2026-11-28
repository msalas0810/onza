import { NextResponse } from "next/server";
import { guardPlatformRequest } from "@/lib/platform/guard";
import { dataViewSchema } from "@/features/platform/schemas";
import { noStore, platformFailure } from "@/features/platform/http";

export const dynamic = "force-dynamic";

/** Lecturas del panel de plataforma. Solo el operador verificado; cualquier otra cuenta recibe 404 (no 403). No exige segundo factor. */
export async function GET(request: Request) {
  const guard = await guardPlatformRequest(request, { sensitive: false });
  if (!guard.ok) return guard.response;
  const { db } = guard.ctx;
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const q = dataViewSchema.parse(params);
    const call = async () => {
      switch (q.view) {
        case "overview":
          return db.rpc("platform_overview", { input: { from: q.from ?? "", to: q.to ?? "" } });
        case "organizations":
          return db.rpc("platform_orgs_list", { input: { status: q.status ?? "", demo: q.demo ?? "", q: q.q ?? "" } });
        case "organization":
          return db.rpc("platform_org_get", { p_id: q.id });
        case "inventory":
          return db.rpc("platform_org_inventory", { p_id: q.id });
        case "venues":
          return db.rpc("platform_venues_list", { input: { filter: q.filter ?? "", organizationId: q.organizationId ?? "", q: q.q ?? "" } });
        case "venue":
          return db.rpc("platform_venue_get", { p_id: q.id });
        case "venue_menu":
          return db.rpc("platform_venue_menu", { p_id: q.id });
        case "users":
          return db.rpc("platform_users_list", { input: { kind: q.kind ?? "members", q: q.q ?? "" } });
        case "audit":
          return db.rpc("platform_audit_list", { input: { organizationId: q.organizationId ?? "", action: q.action ?? "", before: q.before ?? "" } });
      }
    };
    const { data, error } = await call();
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data }, { headers: noStore });
  } catch (error) {
    return platformFailure(error);
  }
}
