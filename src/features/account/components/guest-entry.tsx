"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserDb } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/errors";

/** Entrada sin cuenta: abre una sesión invitada y sigue al destino. El perfil y la cuenta quedan opcionales. */
export function GuestEntry({ next }: { next: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function enter() {
    setBusy(true);
    setError("");
    try {
      const db = browserDb();
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) {
        const { error: failure } = await db.auth.signInAnonymously();
        if (failure) throw failure;
      }
      router.replace(next);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error && /SUPABASE_NOT_CONFIGURED/.test(e.message)
          ? errorMessage(e)
          : "No pudimos entrar como invitado. Volvé a intentarlo en unos minutos.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="stack tight">
      <Button variant="secondary" loading={busy} onClick={() => void enter()}>
        Entrar como invitado
      </Button>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <p className="hint">
        Podés pedir sin cuenta. Con una cuenta guardás tu historial y tu perfil.
      </p>
    </div>
  );
}
