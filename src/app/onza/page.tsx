import { serverDb } from "@/lib/supabase/server";
import { getVenues } from "@/features/catalog/server/queries";
import { ConfigurationState } from "@/components/ui/configuration-state";
import { PlatformPanel } from "@/features/admin/components/platform-panel";
export const dynamic = "force-dynamic";
export default async function Page() {
  let venues;
  try {
    const db = await serverDb();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) throw new Error("NOT_AUTHORIZED");
    const { data } = await db.rpc("has_platform_access");
    if (!data) throw new Error("NOT_AUTHORIZED");
    venues = await getVenues();
  } catch (error) {
    return (
      <div className="page">
        <ConfigurationState error={error} />
      </div>
    );
  }
  return (
    <div className="page wide">
      <PlatformPanel venues={venues} />
    </div>
  );
}
