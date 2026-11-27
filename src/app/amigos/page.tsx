import { ErrorState } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/errors";
import { getVenues } from "@/features/catalog/server/queries";
import { getSocialOverview } from "@/features/social/server/social-service";
import { FriendsPanel } from "@/features/social/components/friends-panel";

export const dynamic = "force-dynamic";

async function load() {
  try {
    const [overview, venues] = await Promise.all([getSocialOverview(), getVenues()]);
    return { overview, open: venues.filter((v) => v.open_state === "open") };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ agregar?: string; local?: string }>;
}) {
  const { agregar, local } = await searchParams;
  const data = await load();
  return (
    <div className="page">
      <div className="page-head">
        <h1>Amigos</h1>
      </div>
      {"error" in data ? (
        <ErrorState message={data.error ?? ""} />
      ) : (
        <FriendsPanel
          initial={data.overview}
          venues={data.open.map((v) => ({ id: v.id, name: v.name, zone: v.zone }))}
          invite={agregar?.slice(0, 40)}
          preselectVenue={data.open.find((v) => v.slug === local)?.id}
        />
      )}
    </div>
  );
}
