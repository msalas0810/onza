import Link from "next/link";
import { requireVenue } from "@/lib/supabase/guards";
import { ConfigurationState } from "@/components/ui/configuration-state";
import { StaffQueue } from "@/features/staff/components/queue";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  let venue;
  try {
    const { db } = await requireVenue(venueId);
    const result = await db
      .from("venues")
      .select("*")
      .eq("id", venueId)
      .single();
    if (result.error) throw result.error;
    venue = result.data;
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
      <StaffQueue venue={venue} />
    </div>
  );
}
