"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Apple, Mail } from "lucide-react";
import { browserDb } from "@/lib/supabase/browser";
import { Button, TextField } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/errors";
import { safeNext } from "@/lib/access-policy";
type Mode = "in" | "up";
const callback = (next: string) =>
  `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
export function AuthForm({ next, notice }: { next: string; notice?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(notice ?? "");
  const [errorLocation, setErrorLocation] = useState<"email" | "provider">(
    "email",
  );
  const [busy, setBusy] = useState(false);
  const up = mode === "up";
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrorLocation("email");
    setError("");
    if (password.length < 8) return setError("Usá al menos 8 caracteres.");
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
  async function google() {
    setErrorLocation("provider");
    setError("");
    const { error: e } = await browserDb().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback(next) },
    });
    if (e) setError("Google todavía no está disponible. Usá tu correo.");
  }
  return (
    <>
      {error && errorLocation === "provider" && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="stack tight">
        <Button className="auth-provider" variant="primary" onClick={google}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.61 4.61 0 0 1-1.99 3.03v2.52h3.23c1.89-1.74 2.98-4.3 2.98-7.38ZM12 22c2.7 0 4.96-.9 6.62-2.39l-3.23-2.52c-.9.6-2.04.97-3.39.97-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22ZM6.41 13.94A6 6 0 0 1 6.1 12c0-.67.11-1.32.31-1.94V7.47H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.53l3.34-2.59ZM12 5.94c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.61 9.61 0 0 0 12 2a10 10 0 0 0-8.93 5.47l3.34 2.59A5.99 5.99 0 0 1 12 5.94Z" />
          </svg>
          Continuar con Google
        </Button>
        <Button
          className="auth-provider"
          variant="secondary"
          disabled
          aria-disabled="true"
        >
          <Apple size={20} aria-hidden="true" />
          Continuar con Apple <span className="soon">Próximamente</span>
        </Button>
      </div>
      <details className="email-access" open={notice ? true : undefined}>
        <summary className="btn secondary auth-provider">
          <Mail size={20} aria-hidden="true" />
          Continuar con correo
        </summary>
        <div className="email-fields">
          <div className="segmented" role="group" aria-label="Modo de acceso">
            <button
              type="button"
              aria-pressed={!up}
              onClick={() => setMode("in")}
            >
              Ingresar
            </button>
            <button
              type="button"
              aria-pressed={up}
              onClick={() => setMode("up")}
            >
              Crear cuenta
            </button>
          </div>
          <form className="stack tight" onSubmit={submit} noValidate>
            <TextField
              label="Correo"
              type="email"
              autoComplete="email"
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
            {error && errorLocation === "email" && (
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
          </form>
        </div>
      </details>
    </>
  );
}
export { safeNext };
