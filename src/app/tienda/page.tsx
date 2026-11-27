import { ErrorState } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/errors";
import { getCoinPackages, getStore } from "@/features/game/server/game-service";
import { StorePanel } from "@/features/game/components/store-panel";

export const dynamic = "force-dynamic";

export default async function Page() {
  let data;
  try {
    const [store, packages] = await Promise.all([getStore(), getCoinPackages()]);
    data = { store, packages };
  } catch (error) {
    return (
      <div className="page">
        <div className="page-head"><h1>Tienda</h1></div>
        <ErrorState message={errorMessage(error)} />
      </div>
    );
  }
  return (
    <div className="page wide">
      <div className="page-head"><h1>Tienda de avatares</h1></div>
      <StorePanel store={data.store} packages={data.packages} />
    </div>
  );
}
