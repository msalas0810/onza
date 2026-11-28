import Link from "next/link";
import { ConfigurationState } from "@/components/ui/configuration-state";
import { requirePlatform } from "@/features/game/server/platform-gate";
import { getStoryReports } from "@/features/game/server/onza-service";
import { ModerationAdmin } from "@/features/game/components/moderation-admin";

export const dynamic = "force-dynamic";

export default async function Page() {
  let reports;
  try {
    await requirePlatform();
    reports = await getStoryReports();
  } catch (error) {
    return <div className="page"><ConfigurationState error={error} /></div>;
  }
  return (
    <div className="page">
      <div className="page-head"><h1>Moderación de historias</h1></div>
      <p><Link href="/onza">← Plataforma</Link></p>
      <ModerationAdmin reports={reports} />
    </div>
  );
}
