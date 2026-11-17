import { StaffShell } from "@/components/ui/staff-shell";
import { staffGate } from "@/components/ui/staff-gate";
import { getPublishedMenu } from "@/features/catalog/server/queries";
import { getVenueSummary } from "@/features/analytics/server/queries";
import { businessDate } from "@/features/analytics/business-date";
import {
  AdminPanel,
  adminTabs,
  type AdminTab,
} from "@/features/admin/components/admin-panel";
import { loadStaffContext } from "@/features/team/server/staff-context";
import { ConfigurationState } from "@/components/ui/configuration-state";

export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { venueId } = await params;
  const { tab } = await searchParams;
  const current: AdminTab = adminTabs.some((t) => t.id === tab)
    ? (tab as AdminTab)
    : "resumen";
  const context = await loadStaffContext(venueId, true);
  const gate = staffGate(context, `/admin/${venueId}?tab=${current}`);
  if (gate || !context.ok) return gate;
  let data;
  try {
    const [menu, summary] = await Promise.all([
      getPublishedMenu(venueId),
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
        venue={context.venue}
        {...data.menu}
        summary={data.summary}
        tab={current}
      />
    </StaffShell>
  );
}
