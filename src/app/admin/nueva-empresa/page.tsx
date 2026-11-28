import { requirePlatformPage } from "@/lib/platform/page-guard";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { NewOrganizationWizard } from "@/features/platform/components/new-organization-wizard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { email } = await requirePlatformPage("/admin/nueva-empresa");
  return (
    <PlatformShell active="empresas" email={email}>
      <h1>Nueva empresa</h1>
      <NewOrganizationWizard />
    </PlatformShell>
  );
}
