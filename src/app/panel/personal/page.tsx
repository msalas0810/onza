import { loadPanel } from "@/lib/platform/panel-session";
import { PanelShell } from "@/features/platform/components/panel-shell";
import { StaffPanel } from "@/features/platform/components/staff-panel";
import type { StaffList } from "@/features/platform/types";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ empresa?: string; local?: string }> }) {
  const sp = await searchParams;
  const { db, orgs, org, venue } = await loadPanel("/panel/personal", sp);
  if (!org) return null;
  if (!["owner", "admin"].includes(org.role))
    return <PanelShell active="personal" orgs={orgs} org={org} venueId={venue?.id}><h1>Personal</h1><p>Solo el propietario y los administradores gestionan al personal.</p></PanelShell>;
  const { data, error } = await db.rpc("org_staff_list", { p_org: org.organization_id });
  if (error) throw new Error(error.message);
  return (
    <PanelShell active="personal" orgs={orgs} org={org} venueId={venue?.id}>
      <h1>Personal</h1>
      <StaffPanel organizationId={org.organization_id} role={org.role} canGrantAdmin={org.role === "owner"} venues={org.venues.map((v) => ({ id: v.id, name: v.name }))} staff={data as unknown as StaffList} />
    </PanelShell>
  );
}
