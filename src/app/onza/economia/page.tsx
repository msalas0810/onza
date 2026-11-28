import Link from "next/link";
import { ConfigurationState } from "@/components/ui/configuration-state";
import { requirePlatform } from "@/features/game/server/platform-gate";
import { getAdminCatalog, getEconomyOverview } from "@/features/game/server/onza-service";
import { EconomyAdmin } from "@/features/game/components/economy-admin";

export const dynamic = "force-dynamic";

export default async function Page() {
  let data, catalog;
  try {
    await requirePlatform();
    [data, catalog] = await Promise.all([getEconomyOverview(), getAdminCatalog()]);
  } catch (error) {
    return <div className="page"><ConfigurationState error={error} /></div>;
  }
  return (
    <div className="page wide">
      <div className="page-head"><h1>Economía y monetización</h1></div>
      <p><Link href="/onza">← Plataforma</Link></p>
      <EconomyAdmin data={data} items={catalog.map((i) => ({ id: i.id, name: i.name, sku: i.sku }))} />
    </div>
  );
}
