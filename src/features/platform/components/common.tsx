"use client";
import { useState, type ReactNode } from "react";
import { Button, Notice, TextField } from "@/components/ui/primitives";
import styles from "./platform.module.css";

/** Campo de solo lectura con botón «Copiar» (los enlaces de invitación se entregan copiándolos: no hay servicio de correo propio). */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={styles.stack}>
      <label className="field">
        <span>{label}</span>
        <span className={styles.copy}>
          <input readOnly value={value} onFocus={(e) => e.currentTarget.select()} />
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(value);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </span>
      </label>
    </div>
  );
}

/** Acción con confirmación en pantalla: opcionalmente exige un motivo o escribir una palabra para confirmar. */
export function ConfirmAction({
  label,
  title,
  description,
  danger = false,
  requireText,
  requireReason = false,
  onConfirm,
  disabled,
}: {
  label: string;
  title: string;
  description: ReactNode;
  danger?: boolean;
  requireText?: string;
  requireReason?: boolean;
  onConfirm: (input: { reason: string; typed: string }) => Promise<string | null>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = (!requireText || typed === requireText) && (!requireReason || reason.trim().length >= 5);

  if (!open)
    return (
      <Button type="button" variant={danger ? "danger" : "secondary"} onClick={() => setOpen(true)} disabled={disabled}>
        {label}
      </Button>
    );
  return (
    <div className={styles.card} role="group" aria-label={title}>
      <div className={styles.stack}>
        <strong>{title}</strong>
        <div className={styles.muted}>{description}</div>
        {requireReason && <TextField label="Motivo (obligatorio)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />}
        {requireText && <TextField label={`Escriba «${requireText}» para confirmar`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />}
        {error && <Notice tone="danger" title="No se pudo completar">{error}</Notice>}
        <div className={styles.actions}>
          <Button
            type="button"
            variant={danger ? "danger" : "primary"}
            loading={busy}
            disabled={!ready}
            onClick={async () => {
              setBusy(true);
              setError("");
              const failure = await onConfirm({ reason: reason.trim(), typed });
              setBusy(false);
              if (failure) setError(failure);
              else setOpen(false);
            }}
          >
            Confirmar
          </Button>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
        </div>
      </div>
    </div>
  );
}
