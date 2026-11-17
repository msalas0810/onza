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
      <h1>Cuenta</h1>
      {profile && (
        <p className="muted" style={{ marginTop: 8 }}>
          {profile.full_name} · @{profile.username}
          {email ? ` · ${email}` : ""}
        </p>
      )}
      <section className="stack tight">
        <h2>Apariencia</h2>
        <ThemeControl />
      </section>
      {profile && (
        <section className="stack tight">
          <h2>Preferencias</h2>
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
            {new Date(profile.terms_accepted_at).toLocaleDateString("es-CR")} ·
            versión {profile.terms_version}
          </p>
        )}
      </section>
      <div className="stack tight">
        <LogoutButton />
      </div>
    </div>
  );
}
