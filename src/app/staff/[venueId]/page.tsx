import { StaffShell } from "@/components/ui/staff-shell";
import { staffGate } from "@/components/ui/staff-gate";
import { StaffQueue } from "@/features/staff/components/queue";
import { loadStaffContext } from "@/features/team/server/staff-context";

export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  const context = await loadStaffContext(venueId);
  const gate = staffGate(context, `/staff/${venueId}`);
  if (gate || !context.ok) return gate;
  return (
    <StaffShell
      venue={context.venue}
      person={context.person}
      canSwitch={context.venueCount > 1}
    >
      <StaffQueue venue={context.venue} />
    </StaffShell>
  );
}
