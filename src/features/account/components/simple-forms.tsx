"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { browserDb } from "@/lib/supabase/browser";
import { Button, TextField } from "@/components/ui/primitives";
export function ResendConfirmation({
  email,
  next,
}: {
  email: string;
  next: string;
}) {
  const [state, setState] = useState("");
  return (
    <>
      <Button
        variant="secondary"
        onClick={async () => {
          const { error } = await browserDb().auth.resend({
            type: "signup",
            email,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
            },
          });
          setState(
            error
              ? "No pudimos reenviarlo ahora. Esperá un minuto."
              : "Correo reenviado.",
          );
        }}
      >
        Reenviar correo
      </Button>
      {state && (
        <p role="status" className="muted">
          {state}
        </p>
      )}
      <Link className="link-button" href="/acceso">
        Usar otro correo
      </Link>
    </>
  );
}
export function RecoverForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  if (sent)
    return (
      <div className="stack tight">
        <p role="status" className="notice">
          Si {email} tiene una cuenta, te enviamos un enlace para crear una
          contraseña nueva.
        </p>
        <Link className="button secondary" href="/acceso">
          Volver al acceso
        </Link>
      </div>
    );
  return (
    <form
      className="stack tight"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await browserDb().auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/restablecer`,
        });
        setSent(true);
        setBusy(false);
      }}
    >
      <TextField
        label="Correo"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button type="submit" loading={busy}>
        Enviar enlace
      </Button>
      <Link className="link-button" href="/acceso">
        Volver
      </Link>
    </form>
  );
}
export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      className="stack tight"
      onSubmit={async (e) => {
        e.preventDefault();
        if (password.length < 8) return setError("Usá al menos 8 caracteres.");
        if (password !== confirm)
          return setError("Las contraseñas no coinciden.");
        const { error: failure } = await browserDb().auth.updateUser({
          password,
        });
        if (failure)
          return setError(
            "El enlace venció. Pedí uno nuevo desde Recuperar contraseña.",
          );
        router.replace("/");
        router.refresh();
      }}
    >
      <TextField
        label="Contraseña nueva"
        type="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <TextField
        label="Confirmá la contraseña"
        type="password"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit">Guardar contraseña</Button>
    </form>
  );
}
