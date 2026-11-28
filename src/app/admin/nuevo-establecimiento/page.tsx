import { requirePlatformPage } from "@/lib/platform/page-guard";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { NewVenueForm } from "@/features/platform/components/venue-panels";
import type { OrgRow } from "@/features/platform/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { db, email } = await requirePlatformPage("/admin/nuevo-establecimiento");
  const { data, error } = await db.rpc("platform_orgs_list", { input: { status: "active", limit: 200 } });
  if (error) throw new Error(error.message);
  const items = (data as unknown as { items: OrgRow[] }).items;
  return (
    <PlatformShell active="establecimientos" email={email}>
      <h1>Nuevo establecimiento</h1>
      {items.length === 0 ? <p>Primero cree una empresa activa.</p> : <NewVenueForm organizations={items.map((o) => ({ id: o.id, name: o.name }))} />}
    </PlatformShell>
  );
}
