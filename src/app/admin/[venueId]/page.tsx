import { StaffShell } from "@/components/ui/staff-shell";
import { staffGate } from "@/components/ui/staff-gate";
import { getAdminMenu } from "@/features/catalog/server/queries";
import { getVenueSummary } from "@/features/analytics/server/queries";
import { businessDate } from "@/features/analytics/business-date";
import { AdminPanel } from "@/features/admin/components/admin-panel";
import { isAdminTab, type AdminTab } from "@/features/admin/admin-tabs";
import { loadStaffContext } from "@/features/team/server/staff-context";
import { ConfigurationState } from "@/components/ui/configuration-state";

export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ tab?: string; editar?: string }>;
}) {
  const { venueId } = await params;
  const { tab, editar } = await searchParams;
  const current: AdminTab = isAdminTab(tab) ? tab : "resumen";
  const context = await loadStaffContext(venueId, true);
  const gate = staffGate(context, `/admin/${venueId}?tab=${current}`);
  if (gate || !context.ok) return gate;
  let data;
  try {
    const [menu, summary] = await Promise.all([
      getAdminMenu(venueId),
      getVenueSummary(venueId, businessDate()),
    ]);
    data = { menu, summary };
  } catch (error) {
    return (
      <StaffShell venue={context.venue} person={context.person}>
        <ConfigurationState error={error} />
      </StaffShell>
    );
  }
  return (
    <StaffShell
      venue={context.venue}
      person={context.person}
      canSwitch={context.venueCount > 1}
    >
      <AdminPanel
        key={`${current}:${editar ?? ""}`}
        venue={context.venue}
        {...data.menu}
        summary={data.summary}
        tab={current}
        editId={editar}
      />
    </StaffShell>
  );
}
