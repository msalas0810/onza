"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { browserDb } from "@/lib/supabase/browser";
import { Button, TextField, Notice } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/errors";

/** Ingreso del equipo: solo correo y contraseña (sin registro abierto ni Google). Una cuenta personal no entra por acá. */
export function StaffLogin({
  next,
  email: initialEmail = "",
}: {
  next?: string;
  email?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="stack tight"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          const db = browserDb();
          const { error: failure } = await db.auth.signInWithPassword({
            email,
            password,
          });
          if (failure)
            throw new Error(
              failure.name === "AuthRetryableFetchError" ||
                (failure.status && failure.status >= 500)
                ? "CONNECTION_ERROR"
                : "Correo o contraseña incorrectos.",
            );
          // El tipo de cuenta lo decide la base: una cuenta personal no queda abierta en el portal del equipo.
          const { data } = await db.rpc("current_account");
          const kind = (data as { kind?: string } | null)?.kind;
          if (kind !== "staff") {
            await db.auth.signOut();
            throw new Error(
              "Esta es una cuenta personal. Para pedir, usá el acceso de clientes.",
            );
          }
          // La página de acceso decide el destino según los locales de la cuenta y el cambio de clave pendiente.
          router.replace(
            next ? `/equipo/acceso?next=${encodeURIComponent(next)}` : "/equipo/acceso",
          );
          router.refresh();
        } catch (e) {
          setError(
            e instanceof Error &&
              /SUPABASE_NOT_CONFIGURED|CONNECTION_ERROR/.test(e.message)
              ? errorMessage(e)
              : e instanceof Error
                ? e.message
                : "No pudimos iniciar sesión.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <TextField
        label="Correo del trabajo"
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <TextField
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" loading={busy}>
        Ingresar
      </Button>
      <p className="muted center t-label" style={{ marginTop: 16 }}>
        ¿Querés pedir tragos?{" "}
        <Link href="/acceso" style={{ color: "inherit" }}>
          Acceso para clientes
        </Link>
      </p>
    </form>
  );
}
