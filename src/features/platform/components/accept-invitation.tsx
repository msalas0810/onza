"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserDb } from "@/lib/supabase/browser";
import { Button, Notice, TextField } from "@/components/ui/primitives";
import { ROLE_LABELS, type OrgRole } from "../schemas";
import styles from "./platform.module.css";

type Info = { email: string; role: OrgRole; organization: string; expires_at: string; account_exists: boolean };

/** Activación de una invitación: la persona define su propia contraseña (nadie más la conoce ni la ve). */
export function AcceptInvitation({ token }: { token: string }) {
  const router = useRouter();
  const [info, setInfo] = useState<Info | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "invalid">("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/panel/invitations/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (res) => ({ ok: res.ok, body: await res.json().catch(() => null) }))
      .then(({ ok, body }) => {
        if (!alive) return;
        if (ok && body?.data) { setInfo(body.data as Info); setState("ready"); } else setState("invalid");
      });
    return () => { alive = false; };
  }, [token]);

  async function activate(event: React.FormEvent) {
    event.preventDefault();
    if (!info) return;
    setError("");
    if (password.length < 10) return setError("Use al menos 10 caracteres.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    const res = await fetch("/api/panel/invitations/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
    const body = await res.json().catch(() => null);
    if (!res.ok) { setBusy(false); return setError(body?.message ?? "No pudimos activar la invitación."); }
    const { error: signInError } = await browserDb().auth.signInWithPassword({ email: info.email, password });
    setBusy(false);
    if (signInError) return router.replace("/panel/acceso");
    router.replace("/panel");
    router.refresh();
  }

  async function acceptWithSession() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/panel/invitations/accept-self", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return setError(body?.message ?? "No pudimos aceptar la invitación con esta cuenta.");
    router.replace("/panel");
    router.refresh();
  }

  return (
    <div className={styles.auth}>
      <div className={styles.authBox}>
        <h1>Invitación a Onza</h1>
        {state === "loading" && <p>Verificando la invitación…</p>}
        {state === "invalid" && <Notice tone="danger" title="Invitación no válida">La invitación no existe, ya se usó o venció. Pida una nueva a quien se la envió.</Notice>}
        {state === "ready" && info && (
          <form className={styles.stack} onSubmit={activate}>
            <p>Lo invitaron a <strong>{info.organization}</strong> como <strong>{ROLE_LABELS[info.role] ?? info.role}</strong>.</p>
            <p className={styles.muted}>Su correo de acceso será {info.email}. Vence el {new Date(info.expires_at).toLocaleDateString("es-CR")}.</p>
            {info.account_exists ? (
              <>
                <p>Ya existe una cuenta con ese correo. Inicie sesión con ella y acepte la invitación.</p>
                <div className={styles.actions}>
                  <a className="btn" href={`/panel/acceso?next=${encodeURIComponent(`/panel/invitacion/${token}`)}`}>Iniciar sesión</a>
                  <Button type="button" variant="secondary" loading={busy} onClick={acceptWithSession}>Ya inicié sesión: aceptar</Button>
                </div>
              </>
            ) : (
              <>
                <TextField label="Elija su contraseña" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} hint="Al menos 10 caracteres. Solo usted la conocerá." />
                <TextField label="Repita la contraseña" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                <Button type="submit" loading={busy} disabled={!password || !confirm}>Activar mi cuenta</Button>
              </>
            )}
            {error && <div aria-live="polite"><Notice tone="danger" title="No se pudo completar">{error}</Notice></div>}
          </form>
        )}
      </div>
    </div>
  );
}
