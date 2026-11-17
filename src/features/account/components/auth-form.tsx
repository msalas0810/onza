"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const [busy, setBusy] = useState(false);
  const up = mode === "up";
  async function submit(event: React.FormEvent) {
    event.preventDefault();
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
    setError("");
    const { error: e } = await browserDb().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback(next) },
    });
    if (e) setError("Google todavía no está disponible. Usá tu correo.");
  }
  return (
    <>
      <div className="segmented" role="group" aria-label="Modo de acceso">
        <button type="button" aria-pressed={!up} onClick={() => setMode("in")}>
          Ingresar
        </button>
        <button type="button" aria-pressed={up} onClick={() => setMode("up")}>
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
      </form>
      <p className="divider-label">o</p>
      <div className="stack tight">
        <Button variant="secondary" onClick={google}>
          Continuar con Google
        </Button>
        <Button variant="secondary" disabled aria-disabled="true">
          Continuar con Apple <span className="soon">Próximamente</span>
        </Button>
      </div>
    </>
  );
}
export { safeNext };
