"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@/components/ui/primitives";

export function PasswordChangeForm({ next }: { next?: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState<{
    password?: string;
    repeat?: string;
    form?: string;
  }>({});
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="stack"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        const found: typeof errors = {};
        if (password.length < 10)
          found.password = "Usá al menos 10 caracteres.";
        else if (password !== repeat)
          found.repeat = "Las contraseñas no coinciden.";
        setErrors(found);
        if (Object.keys(found).length) return;
        setBusy(true);
        try {
          const response = await fetch("/api/team/password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
          });
          const body: { message?: string; error?: string } = await response
            .json()
            .catch(() => ({}));
          if (!response.ok) {
            setErrors(
              body.error === "SAME_PASSWORD" || body.error === "WEAK_PASSWORD"
                ? { password: body.message }
                : { form: body.message ?? "No pudimos guardar la contraseña." },
            );
            return;
          }
          router.replace(
            next
              ? `/equipo/acceso?next=${encodeURIComponent(next)}`
              : "/equipo/acceso",
          );
          router.refresh();
        } catch {
          setErrors({
            form: "No pudimos conectar. Revisá tu conexión y probá de nuevo.",
          });
        } finally {
          setBusy(false);
        }
      }}
    >
      <TextField
        label="Contraseña nueva"
        type="password"
        autoComplete="new-password"
        hint="Al menos 10 caracteres y distinta de la temporal."
        error={errors.password}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <TextField
        label="Repetir contraseña"
        type="password"
        autoComplete="new-password"
        error={errors.repeat}
        value={repeat}
        onChange={(e) => setRepeat(e.target.value)}
      />
      {errors.form && (
        <p role="alert" className="field-error">
          {errors.form}
        </p>
      )}
      <Button type="submit" block loading={busy}>
        Guardar y continuar
      </Button>
    </form>
  );
}
