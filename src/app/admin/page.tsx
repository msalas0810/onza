import { requirePlatformPage } from "@/lib/platform/page-guard";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { OverviewView } from "@/features/platform/components/overview-view";
import type { Overview } from "@/features/platform/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { db, email } = await requirePlatformPage("/admin");
  const { data, error } = await db.rpc("platform_overview", { input: {} });
  if (error) throw new Error(error.message);
  return (
    <PlatformShell active="resumen" email={email}>
      <OverviewView data={data as unknown as Overview} />
    </PlatformShell>
  );
}
