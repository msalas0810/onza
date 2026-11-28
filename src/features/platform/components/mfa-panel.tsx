"use client";
import { useCallback, useEffect, useState } from "react";
import { browserDb } from "@/lib/supabase/browser";
import { Button, Notice, TextField } from "@/components/ui/primitives";
import styles from "./platform.module.css";

type Factor = { id: string; status: string; friendly_name?: string | null };

/** Segundo factor (TOTP). Sin él, el panel solo permite lectura: las acciones sensibles piden un código de los últimos 15 minutos. */
export function MfaPanel({ mfaRecent }: { mfaRecent: boolean }) {
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const { data } = await browserDb().auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as Factor[]);
  }, []);
  useEffect(() => {
    let alive = true;
    browserDb()
      .auth.mfa.listFactors()
      .then(({ data }) => alive && setFactors((data?.totp ?? []) as Factor[]));
    return () => {
      alive = false;
    };
  }, []);

  async function start() {
    setBusy(true);
    setMessage(null);
    const { data, error } = await browserDb().auth.mfa.enroll({ factorType: "totp", friendlyName: `Plataforma ${new Date().toISOString().slice(0, 10)}` });
    setBusy(false);
    if (error || !data) return setMessage({ tone: "danger", text: "No pudimos iniciar la activación. Intente de nuevo." });
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }
  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (!enroll) return;
    setBusy(true);
    const { error } = await browserDb().auth.mfa.challengeAndVerify({ factorId: enroll.id, code: code.trim() });
    setBusy(false);
    if (error) return setMessage({ tone: "danger", text: "El código no es válido o venció. Intente con el siguiente." });
    setEnroll(null);
    setCode("");
    setMessage({ tone: "success", text: "Segundo factor activado. Ya puede realizar acciones sensibles." });
    await reload();
  }

  const verified = factors?.some((f) => f.status === "verified") ?? false;
  return (
    <div className={styles.stack}>
      <p>
        Estado: {factors === null ? "consultando…" : verified ? "segundo factor activo" : "sin segundo factor (solo lectura)"}.{" "}
        {mfaRecent ? "Verificado hace menos de 15 minutos." : "Sin verificación reciente: las acciones sensibles le pedirán un código."}
      </p>
      {message && <Notice tone={message.tone === "success" ? "success" : "danger"} title={message.tone === "success" ? "Listo" : "No se pudo"}>{message.text}</Notice>}
      {!verified && !enroll && <Button onClick={start} loading={busy}>Activar segundo factor</Button>}
      {enroll && (
        <form className={styles.stack} onSubmit={confirm}>
          <p>Escanee este código con su aplicación de autenticación (por ejemplo Google Authenticator) y escriba el código que muestra.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.qr} src={enroll.qr} alt="Código QR para su aplicación de autenticación" />
          <p className={styles.muted}>¿No puede escanear? Escriba esta clave: <code>{enroll.secret}</code></p>
          <TextField label="Código de 6 dígitos" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
          <Button type="submit" loading={busy} disabled={code.trim().length !== 6}>Confirmar</Button>
        </form>
      )}
    </div>
  );
}
