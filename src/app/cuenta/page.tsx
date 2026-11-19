import Link from "next/link";
import { ThemeControl } from "@/components/ui/theme-control";
import {
  LogoutButton,
  PreferenceToggles,
} from "@/features/account/components/account-actions";
import { currentAccount } from "@/lib/account";
import { AvatarEditor } from "@/features/account/components/avatar-editor";

export const dynamic = "force-dynamic";
export default async function Page() {
  const { profile, email } = await currentAccount();
  return (
    <div className="page narrow">
      <div className="page-head">
        <h1>Cuenta</h1>
      </div>
      {profile && (
        <section className="identity" aria-label="Tu perfil">
          <AvatarEditor
            name={profile.full_name}
            path={profile.avatar_path ?? null}
          />
          <div className="grow">
            <strong className="identity-name">{profile.full_name}</strong>
            <div className="muted t-label">@{profile.username}</div>
          </div>
        </section>
      )}
      <div className="stack loose">
        {profile && (
          <section className="stack tight">
            <h2>Datos de la cuenta</h2>
            <dl className="facts-list">
              <div>
                <dt>Correo</dt>
                <dd>{email ?? "—"}</dd>
              </div>
              <div>
                <dt>Teléfono</dt>
                <dd>{profile.phone_e164} · privado</dd>
              </div>
            </dl>
            <p className="hint">
              El correo es tu acceso. Teléfono y fecha de nacimiento quedan en
              tu perfil privado; el local no los ve.
            </p>
          </section>
        )}
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
