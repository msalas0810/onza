import { getVenues } from "@/features/catalog/server/queries";
import { VenueList } from "@/features/catalog/components/venue-list";
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
      <div className="page-head">
        <h1>Explorar</h1>
      </div>
      <VenueList venues={venues} />
    </div>
  );
}
