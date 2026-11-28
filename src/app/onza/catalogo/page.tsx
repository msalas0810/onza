import Link from "next/link";
import { ConfigurationState } from "@/components/ui/configuration-state";
import { requirePlatform } from "@/features/game/server/platform-gate";
import { getAdminCatalog, listImports } from "@/features/game/server/onza-service";
import { CatalogAdmin } from "@/features/game/components/catalog-admin";

export const dynamic = "force-dynamic";

export default async function Page() {
  let items, imports;
  try {
    await requirePlatform();
    [items, imports] = await Promise.all([getAdminCatalog(), listImports()]);
  } catch (error) {
    return <div className="page"><ConfigurationState error={error} /></div>;
  }
  return (
    <div className="page wide">
      <div className="page-head"><h1>Catálogo de avatares</h1></div>
      <p><Link href="/onza">← Plataforma</Link></p>
      <CatalogAdmin items={items} imports={imports} />
    </div>
  );
}
