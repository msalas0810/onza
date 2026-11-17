import { redirect } from "next/navigation";
import { StaffShell } from "@/components/ui/staff-shell";
import { PasswordChangeForm } from "@/features/team/components/password-change-form";
import { personFor } from "@/features/team/server/staff-context";
import { staffHome } from "@/features/team/server/staff-home";
import { serverDb } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const db = await serverDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user || user.is_anonymous) redirect("/equipo/acceso");
  const { data: account } = await db.rpc("current_account");
  const state = account as { kind?: string; mustChangePassword?: boolean } | null;
  if (state?.kind === "customer") redirect("/sesion-activa?want=equipo");
  // Sin cambio pendiente no hay nada que hacer acá.
  if (!state?.mustChangePassword) redirect(await staffHome(next));
  const { person } = await personFor(db, user);
  return (
    <StaffShell person={person} wide={false}>
      <div className="page-head">
        <h1 className="t-title">Creá tu contraseña</h1>
        <p className="muted">
          Tu contraseña temporal sirve solo para entrar esta vez. Hasta cambiarla
          no podés operar.
        </p>
      </div>
      <PasswordChangeForm next={next} />
    </StaffShell>
  );
}
