"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Notice } from "@/components/ui/primitives";

type DemoOption = {
  role: "customer" | "bartender" | "admin";
  label: string;
  next: string;
};

const messages: Record<string, string> = {
  DEMO_NOT_CONFIGURED: "Las cuentas demo no están cargadas en este entorno.",
  CONNECTION_ERROR: "No pudimos conectar. Intentá de nuevo en un momento.",
};

/** Accesos demo junto a los formularios reales. Solo llama a la ruta del servidor; no conoce credenciales. */
export function DemoLogin({
  title,
  options,
}: {
  title: string;
  options: DemoOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function enter({ role, next }: DemoOption) {
    setBusy(role);
    setError("");
    try {
      const response = await fetch("/api/demo-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          messages[body?.error ?? ""] ??
            "No pudimos abrir esa cuenta demo.",
        );
      }
      router.replace(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos abrir esa cuenta demo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-label={title} className="stack tight">
      <p>{title}</p>
      {options.map((option) => (
        <Button
          key={option.role}
          type="button"
          variant="secondary"
          block
          loading={busy === option.role}
          disabled={busy !== null}
          onClick={() => enter(option)}
        >
          {option.label}
        </Button>
      ))}
      {error && (
        <Notice tone="warning" title="No se pudo entrar">
          {error}
        </Notice>
      )}
    </section>
  );
}
