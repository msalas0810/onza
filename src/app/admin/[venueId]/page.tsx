import Link from "next/link";
import { requireVenue } from "@/lib/supabase/guards";
import { getPublishedMenu } from "@/features/catalog/server/queries";
import { getVenueSummary } from "@/features/analytics/server/queries";
import { businessDate } from "@/features/analytics/business-date";
import { AdminPanel } from "@/features/admin/components/admin-panel";
import { ConfigurationState } from "@/components/ui/configuration-state";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  let venue, menu, summary;
  try {
    const { db } = await requireVenue(venueId, true);
    const [v, m, s] = await Promise.all([
      db.from("venues").select("*").eq("id", venueId).single(),
      getPublishedMenu(venueId),
      getVenueSummary(venueId, businessDate()),
    ]);
    if (v.error) throw v.error;
    venue = v.data;
    menu = m;
    summary = s;
  } catch (error) {
    return (
      <div className="page">
        <ConfigurationState error={error} />
        <Link className="link-button" href="/login">
          Iniciar sesión de personal
        </Link>
      </div>
    );
  }
  return (
    <div className="page operations">
      <AdminPanel venue={venue} {...menu} summary={summary} />
    </div>
  );
}
