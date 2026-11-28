import { requirePlatformPage } from "@/lib/platform/page-guard";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { MfaPanel } from "@/features/platform/components/mfa-panel";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { email, mfaRecent } = await requirePlatformPage("/admin/seguridad");
  return (
    <PlatformShell active="seguridad" email={email}>
      <h1>Seguridad de la cuenta</h1>
      <p>Esta es la única cuenta que administra la plataforma. Para agregar a otra persona se usa un script de operación, nunca esta interfaz.</p>
      <MfaPanel mfaRecent={mfaRecent} />
    </PlatformShell>
  );
}
