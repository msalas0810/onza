"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { onzaApi } from "../client-api";

/** Ejecuta comandos de administración de ONZA y deja el resultado a la vista (en pantalla, no en un aviso que desaparece). */
export function useOnza() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  async function run<T = unknown>(key: string, command: Record<string, unknown>, ok: string): Promise<T | null> {
    setBusy(key);
    setMessage(null);
    const result = await onzaApi<T>(command);
    setBusy(null);
    if (result.ok) {
      setMessage({ tone: "success", text: ok });
      router.refresh();
      return result.result;
    }
    setMessage({ tone: "danger", text: result.message });
    return null;
  }
  return { run, busy, message };
}
