"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { browserDb } from "@/lib/supabase/browser";
import { Button, TextField } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/errors";
import { safeNext } from "@/lib/access-policy";
type Mode = "in" | "up";
const callback = (next: string) =>
  `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
export function AuthForm({
  next,
  notice,
  guestEntry = false,
}: {
  next: string;
  notice?: string;
  /** Solo demo: muestra «Entrar como invitado» (la bandera la decide el servidor). */
  guestEntry?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(notice ?? "");
  const [busy, setBusy] = useState(false);
  const [guestError, setGuestError] = useState("");
  const [guestBusy, setGuestBusy] = useState(false);
  const up = mode === "up";

  async function enterAsGuest() {
    setGuestError("");
    setGuestBusy(true);
    try {
      const db = browserDb();
      const {
        data: { user },
      } = await db.auth.getUser();
      // Una sesión existente no se reemplaza en silencio: signInAnonymously cambiaría la cuenta del navegador.
      if (user) {
        setGuestError(
          "Ya hay una sesión iniciada en este navegador. Continuá con esa cuenta o cerrala antes de entrar como invitado.",
        );
        return;
      }
      const { error: e } = await db.auth.signInAnonymously();
      if (e) throw e;
      router.replace(next);
      router.refresh();
    } catch {
      setGuestError(
        "No pudimos abrir una sesión de invitado. Intentá de nuevo en unos minutos.",
      );
    } finally {
      setGuestBusy(false);
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (up && password.length < 8)
      return setError("Usá al menos 8 caracteres.");
    if (up && password !== confirm)
      return setError("Las contraseñas no coinciden.");
    setBusy(true);
    try {
      const db = browserDb();
      if (up) {
        const { data, error: e } = await db.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: callback(next) },
        });
        if (e) throw e;
        if (data.session) router.replace(next);
        else
          router.replace(
            `/confirmar?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`,
          );
      } else {
        const { error: e } = await db.auth.signInWithPassword({
          email,
          password,
        });
        if (e)
          throw new Error(
            /not confirmed/i.test(e.message)
              ? "Confirmá tu correo antes de ingresar."
              : e.status && e.status >= 500
                ? "CONNECTION_ERROR"
                : "Correo o contraseña incorrectos.",
          );
        router.replace(next);
      }
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error &&
          /SUPABASE_NOT_CONFIGURED|CONNECTION_ERROR/.test(e.message)
          ? errorMessage(e)
          : e instanceof Error
            ? e.message.startsWith("Correo") || e.message.startsWith("Confirmá")
              ? e.message
              : "No pudimos completar el registro. Revisá los datos e intentá de nuevo."
            : "No pudimos continuar.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="stack tight">
        {(["Google", "Apple"] as const).map((provider) => (
          <Button
            key={provider}
            className="auth-provider"
            variant="secondary"
            disabled
          >
            <span
              className={`auth-icon auth-icon-${provider.toLowerCase()}`}
              aria-hidden="true"
            />
            Continuar con {provider} <span className="soon">Próximamente</span>
          </Button>
        ))}
      </div>
      <details className="email-access" open={notice ? true : undefined}>
        <summary className="btn secondary auth-provider">
          <Mail size={20} aria-hidden="true" />
          Continuar con correo
        </summary>
        <div className="email-fields">
          <form className="stack tight" onSubmit={submit} noValidate>
            <h2 className="email-title">
              {up ? "Creá tu cuenta" : "Ingresá con tu correo"}
            </h2>
            <TextField
              label="Correo"
              type="email"
              autoComplete={up ? "email" : "username"}
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Contraseña"
              type="password"
              autoComplete={up ? "new-password" : "current-password"}
              required
              hint={up ? "Al menos 8 caracteres." : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {up && (
              <TextField
                label="Confirmá la contraseña"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            )}
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" loading={busy}>
              {up ? "Crear cuenta" : "Ingresar"}
            </Button>
            {!up && (
              <Link className="link-button" href="/recuperar">
                ¿Olvidaste tu contraseña?
              </Link>
            )}
            <p className="switch-mode">
              {up ? "¿Ya tenés cuenta?" : "¿No tenés cuenta?"}{" "}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setMode(up ? "in" : "up");
                  setError("");
                }}
              >
                {up ? "Ingresá" : "Creá una"}
              </button>
            </p>
          </form>
        </div>
      </details>
      {guestEntry && (
        <div className="stack tight">
          <Button
            variant="quiet"
            className="auth-provider"
            loading={guestBusy}
            onClick={enterAsGuest}
          >
            Entrar como invitado <span className="soon">Solo demo</span>
          </Button>
          <p className="notice" role={guestError ? "alert" : undefined}>
            {guestError ||
              "Sin cuenta: la sesión de invitado se guarda en este navegador."}
          </p>
        </div>
      )}
    </>
  );
}
export { safeNext };
