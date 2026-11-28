"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserDb } from "@/lib/supabase/browser";
import { Button, Notice, TextField } from "@/components/ui/primitives";
import styles from "./platform.module.css";

/**
 * Inicio de sesión de los portales (operador de la plataforma y empresas). No revela si el correo existe ni si es el del operador:
 * cualquier fallo dice lo mismo. El operador con segundo factor activo escribe además su código de 6 dígitos.
 */
export function PortalLogin({ mode, next, notice }: { mode: "operator" | "company"; next: string; notice?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"password" | "code">("password");
  const [error, setError] = useState(notice ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const db = browserDb();
    if (step === "password") {
      const { error: failure } = await db.auth.signInWithPassword({ email, password });
      if (failure) {
        setBusy(false);
        return setError("Correo o contraseña incorrectos.");
      }
      if (mode === "operator") {
        // Si no se puede consultar el nivel de verificación se sigue como sin segundo factor (solo lectura): nunca se bloquea el acceso.
        const level = await db.auth.mfa.getAuthenticatorAssuranceLevel().catch(() => null);
        if (level?.data?.nextLevel === "aal2" && level.data.currentLevel === "aal1") {
          setBusy(false);
          setStep("code");
          return;
        }
      }
      router.replace(next);
      router.refresh();
      return;
    }
    const { data: factors } = await db.auth.mfa.listFactors();
    const factor = factors?.totp.find((f) => f.status === "verified");
    if (!factor) {
      setBusy(false);
      return setError("No encontramos un segundo factor activo.");
    }
    const { error: verifyError } = await db.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
    setBusy(false);
    if (verifyError) return setError("El código no es válido o venció. Intente con el siguiente.");
    router.replace(next);
    router.refresh();
  }

  return (
    <div className={styles.auth}>
      <form className={styles.authBox} onSubmit={submit} noValidate>
        <h1>{mode === "operator" ? "Acceso de plataforma" : "Acceso de empresa"}</h1>
        {step === "password" ? (
          <>
            <TextField label="Correo" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <TextField label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </>
        ) : (
          <>
            <p className={styles.muted}>Ingrese el código de 6 dígitos de su aplicación de autenticación.</p>
            <TextField label="Código de verificación" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} autoFocus required />
          </>
        )}
        {error && (
          <div aria-live="polite">
            <Notice tone="danger" title="No pudimos iniciar sesión">{error}</Notice>
          </div>
        )}
        <Button type="submit" loading={busy} disabled={step === "password" ? !email || !password : code.trim().length !== 6}>
          {step === "password" ? "Ingresar" : "Verificar"}
        </Button>
      </form>
    </div>
  );
}
