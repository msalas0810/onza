"use client";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { browserDb } from "@/lib/supabase/browser";
import { Button, Notice, TextField } from "@/components/ui/primitives";
import styles from "./platform.module.css";

export type ApiResult<T> = { ok: true; result: T } | { ok: false; code: string; message: string };
type Ctx = { command: <T = unknown>(body: Record<string, unknown>) => Promise<ApiResult<T>>; get: <T = unknown>(view: Record<string, string>) => Promise<ApiResult<T>> };
const PlatformApi = createContext<Ctx | null>(null);

/**
 * Cliente del panel. Si el servidor responde REAUTH_REQUIRED, pide el código del segundo factor, lo verifica con el proveedor de
 * autenticación y reintenta UNA vez la acción. Si responde SESSION_REVOKED, vuelve al inicio de sesión.
 */
export function PlatformApiProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const waiter = useRef<((ok: boolean) => void) | null>(null);

  const raw = useCallback(async <T,>(url: string, init?: RequestInit): Promise<{ status: number; body: { ok?: boolean; result?: T; data?: T; error?: string; message?: string } | null }> => {
    try {
      const response = await fetch(url, { cache: "no-store", ...init });
      return { status: response.status, body: await response.json().catch(() => null) };
    } catch {
      return { status: 0, body: { error: "CONNECTION_ERROR", message: "No pudimos conectar con el servicio. Intente de nuevo." } };
    }
  }, []);

  const askForCode = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        waiter.current = resolve;
        setCode("");
        setError("");
        setAsking(true);
      }),
    [],
  );

  // Dos intentos como máximo: si el primero pide REAUTH_REQUIRED y la persona verifica su código, se reintenta una sola vez.
  const run = useCallback(
    async <T,>(url: string, init: RequestInit | undefined, canRetry: boolean): Promise<ApiResult<T>> => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const { status, body } = await raw<T>(url, init);
        if (status === 200 && body?.ok) return { ok: true, result: (body.result ?? body.data) as T };
        if (body?.error === "SESSION_REVOKED") {
          router.replace("/admin/acceso?motivo=sesion");
          return { ok: false, code: "SESSION_REVOKED", message: body.message ?? "Su sesión fue revocada." };
        }
        if (body?.error === "REAUTH_REQUIRED" && canRetry && attempt === 0 && (await askForCode())) continue;
        if (status === 404) return { ok: false, code: "NOT_FOUND", message: "No encontramos lo que busca." };
        return { ok: false, code: body?.error ?? "UNKNOWN_ERROR", message: body?.message ?? "No pudimos completar la operación. Intente de nuevo." };
      }
      return { ok: false, code: "REAUTH_REQUIRED", message: "No pudimos verificar su identidad. Intente de nuevo." };
    },
    [raw, router, askForCode],
  );

  const command: Ctx["command"] = useCallback(
    (body) => run("/api/platform-admin/commands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, true),
    [run],
  );
  const get: Ctx["get"] = useCallback((view) => run(`/api/platform-admin/data?${new URLSearchParams(view).toString()}`, undefined, false), [run]);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const db = browserDb();
    const { data: factors, error: listError } = await db.auth.mfa.listFactors();
    const factor = factors?.totp.find((f) => f.status === "verified");
    if (listError || !factor) {
      setBusy(false);
      return setError("No hay un segundo factor activo. Actívelo en Seguridad.");
    }
    const { error: verifyError } = await db.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
    setBusy(false);
    if (verifyError) return setError("El código no es válido o venció. Intente con el siguiente.");
    setAsking(false);
    waiter.current?.(true);
  }
  function cancel() {
    setAsking(false);
    waiter.current?.(false);
  }

  return (
    <PlatformApi.Provider value={{ command, get }}>
      {children}
      {asking && (
        <div className={styles.modal}>
          <form className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="reauth-title" onSubmit={verify}>
            <h2 id="reauth-title" style={{ margin: 0 }}>Confirme su identidad</h2>
            <p className={styles.muted}>Esta acción es sensible. Ingrese el código de 6 dígitos de su aplicación de autenticación.</p>
            <TextField label="Código de verificación" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
            {error && <Notice tone="danger" title="No se pudo verificar">{error}</Notice>}
            <div className={styles.actions}>
              <Button type="submit" loading={busy} disabled={code.trim().length !== 6}>Verificar y continuar</Button>
              <Button type="button" variant="secondary" onClick={cancel}>Cancelar</Button>
            </div>
          </form>
        </div>
      )}
    </PlatformApi.Provider>
  );
}

export function usePlatformApi() {
  const ctx = useContext(PlatformApi);
  if (!ctx) throw new Error("PlatformApiProvider ausente");
  return ctx;
}
