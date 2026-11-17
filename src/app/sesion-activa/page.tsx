import Link from "next/link";
import { SwitchAccountButton } from "@/features/account/components/account-actions";
import { currentAccount } from "@/lib/account";
export const dynamic = "force-dynamic";
/** Opening the wrong access never closes a valid session: continue to the right area or switch account. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ want?: string }>;
}) {
  const { want } = await searchParams;
  const { account, email, profile } = await currentAccount();
  const staff = account.kind === "staff";
  const wantsStaff = want === "equipo";
  return (
    <div className="page narrow auth-page">
      <h1>Ya hay una sesión iniciada</h1>
      <div className="notice">
        <strong>{profile?.full_name ?? email ?? "Tu cuenta"}</strong>
        <p className="muted">
          {staff ? "Cuenta del equipo" : "Cuenta personal"}
          {email && profile ? ` · ${email}` : ""}
        </p>
      </div>
      {staff && !wantsStaff && (
        <p className="muted">Esta cuenta es del equipo y no puede pedir.</p>
      )}
      {!staff && wantsStaff && (
        <p className="muted">
          Esta cuenta es personal y no tiene acceso al equipo.
        </p>
      )}
      <div className="stack tight">
        <Link className="button primary" href={staff ? "/equipo/acceso" : "/"}>
          {staff ? "Continuar al espacio del equipo" : "Continuar a Explorar"}
        </Link>
        <SwitchAccountButton to={wantsStaff ? "/equipo/acceso" : "/acceso"} />
      </div>
    </div>
  );
}
