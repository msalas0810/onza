import Link from "next/link";
import { SwitchAccountButton } from "@/features/account/components/account-actions";
import { buttonClass } from "@/components/ui/primitives";
import { currentAccount } from "@/lib/account";

export const dynamic = "force-dynamic";
/** Abrir el acceso equivocado nunca cierra una sesión vigente: se continúa al área correcta o se cambia de cuenta. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ want?: string }>;
}) {
  const { want } = await searchParams;
  const { account, email, profile } = await currentAccount();
  const staff = account.kind === "staff";
  const wantsStaff = want === "equipo";
  const name = profile?.full_name ?? email ?? "Tu cuenta";
  return (
    <div className="page narrow">
      <div className="page-head">
        <h1 className="t-title">Ya hay una sesión iniciada</h1>
      </div>
      <div className="panel row" style={{ marginBottom: 16 }}>
        <span className="mono" aria-hidden="true">
          {name.trim().charAt(0).toLocaleUpperCase("es-CR")}
        </span>
        <div className="grow">
          <strong>{name}</strong>
          <div className="muted t-label">
            {staff ? "Cuenta del equipo" : "Cuenta personal"}
            {email ? ` · ${email}` : ""}
          </div>
        </div>
      </div>
      {staff && !wantsStaff && (
        <p className="muted" style={{ marginBottom: 24 }}>
          Esta cuenta es del equipo y no puede pedir.
        </p>
      )}
      {!staff && wantsStaff && (
        <p className="muted" style={{ marginBottom: 24 }}>
          Esta cuenta es personal y no tiene acceso al equipo.
        </p>
      )}
      <div className="stack tight">
        <Link
          className={buttonClass({ block: true })}
          href={staff ? "/equipo/acceso" : "/"}
        >
          {staff ? "Continuar al espacio del equipo" : "Continuar a Explorar"}
        </Link>
        <SwitchAccountButton to={wantsStaff ? "/equipo/acceso" : "/acceso"} />
      </div>
      <p className="hint" style={{ marginTop: 16 }}>
        Nada se cierra solo: la sesión actual sigue hasta que elijas otra
        cuenta.
      </p>
    </div>
  );
}
