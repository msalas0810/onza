import Link from "next/link";
import { ThemeControl } from "@/components/ui/theme-control";
import {
  LogoutButton,
  PreferenceToggles,
} from "@/features/account/components/account-actions";
import { currentAccount } from "@/lib/account";

export const dynamic = "force-dynamic";
export default async function Page() {
  const { profile, email } = await currentAccount();
  return (
    <div className="page narrow">
      <div className="page-head">
        <h1>Cuenta</h1>
      </div>
      {profile && (
        <div className="panel row" style={{ marginBottom: 32 }}>
          <span className="mono" aria-hidden="true">
            {profile.full_name.trim().charAt(0).toLocaleUpperCase("es-CR")}
          </span>
          <div className="grow">
            <strong>{profile.full_name}</strong>
            <div className="muted t-label">
              @{profile.username}
              {email ? ` · ${email}` : ""}
            </div>
          </div>
        </div>
      )}
      <div className="stack loose">
        <section className="stack tight">
          <h2>Apariencia</h2>
          <ThemeControl />
        </section>
        {profile && (
          <section className="stack tight">
            <h2>Avisos</h2>
            <PreferenceToggles
              news={profile.news_opt_in}
              offers={profile.offers_opt_in}
            />
          </section>
        )}
        <section className="stack tight">
          <h2>Privacidad</h2>
          <Link className="link-button" href="/policies">
            Condiciones y política de privacidad (borrador)
          </Link>
          {profile && (
            <p className="hint">
              Aceptadas el{" "}
              {new Date(profile.terms_accepted_at).toLocaleDateString("es-CR")}{" "}
              · versión {profile.terms_version}
            </p>
          )}
        </section>
        <LogoutButton />
      </div>
    </div>
  );
}
