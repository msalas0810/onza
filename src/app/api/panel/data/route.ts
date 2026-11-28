import { NextResponse } from "next/server";
import { companySession } from "@/lib/platform/session";
import { panelViewSchema } from "@/features/platform/panel-schemas";
import { noStore, platformFailure } from "@/features/platform/http";

export const dynamic = "force-dynamic";

/** Lecturas del panel de empresa. Cada función de la base exige membresía, rol y alcance de locales (NOT_FOUND si no corresponde). */
export async function GET(request: Request) {
  try {
    const { db } = await companySession(request);
    const q = panelViewSchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    const call = async () => {
      switch (q.view) {
        case "my":
          return db.rpc("org_my");
        case "summary":
          return db.rpc("org_summary", { input: { organizationId: q.organizationId, venueId: q.venueId ?? "", days: q.days ?? 7 } });
        case "customers":
          return db.rpc("org_customers", { input: { organizationId: q.organizationId } });
        case "menu":
          return db.rpc("org_menu", { p_venue: q.venueId });
        case "staff":
          return db.rpc("org_staff_list", { p_org: q.organizationId });
      }
    };
    const { data, error } = await call();
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data }, { headers: noStore });
  } catch (error) {
    return platformFailure(error);
  }
}
