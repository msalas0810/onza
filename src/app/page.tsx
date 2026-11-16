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
        <h1>Explorar</h1>
        <div className="stack">
          <ConfigurationState error={error} />
        </div>
      </div>
    );
  }
  return (
    <div className="page wide">
      <h1>Explorar</h1>
      <VenueList venues={venues} />
      <p className="muted">
        Locales ficticios. Todos los montos y cobros de esta demo son simulados.
      </p>
    </div>
  );
}
