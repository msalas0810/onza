import { getVenues } from "@/features/catalog/server/queries";
import { VenueList } from "@/features/catalog/components/venue-list";
import Link from "next/link";
import { Activity } from "lucide-react";
import { ConfigurationState } from "@/components/ui/configuration-state";

export const dynamic = "force-dynamic";
export default async function Home() {
  let venues;
  try {
    venues = await getVenues();
  } catch (error) {
    return (
      <div className="page wide">
        <div className="page-head">
          <h1>Explorar</h1>
        </div>
        <ConfigurationState error={error} />
      </div>
    );
  }
  return (
    <div className="page wide">
      <div className="page-head row between wrap">
        <h1>Explorar</h1>
        <Link className="btn secondary sm" href="/actividad">
          <Activity size={16} aria-hidden="true" /> Actividad
        </Link>
      </div>
      <VenueList venues={venues} />
    </div>
  );
}
