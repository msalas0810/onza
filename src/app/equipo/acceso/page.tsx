import { redirect } from "next/navigation";
import { AccessFrame } from "@/components/ui/access-frame";
import { Notice } from "@/components/ui/primitives";
import { StaffLogin } from "@/features/staff/components/login";
import { staffHome } from "@/features/team/server/staff-home";
import { currentAccount } from "@/lib/account";
import { safeNext } from "@/lib/access-policy";

export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; vencida?: string; email?: string }>;
}) {
  const { next, vencida, email } = await searchParams;
  const { account } = await currentAccount();
  // Con sesión del equipo nunca se muestra el formulario: se entra directo a su espacio.
  if (account.kind === "staff") redirect(await staffHome(next));
  // Una cuenta personal vigente no se cierra sola: se elige continuar o usar otra cuenta.
  if (account.kind === "customer") redirect("/sesion-activa?want=equipo");
  return (
    <AccessFrame
      eyebrow="Equipo"
      title="Acceso del equipo"
      subtitle="Las cuentas del equipo las crea el administrador de tu local."
    >
      {vencida && (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="warning" title="Tu sesión venció">
            Volvé a entrar para seguir operando.
          </Notice>
        </div>
      )}
      <StaffLogin next={safeNext(next, "") || undefined} email={email} />
    </AccessFrame>
  );
}
