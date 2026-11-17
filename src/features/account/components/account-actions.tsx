"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { browserDb } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/primitives";
/** Voluntary logout clears local data (cart, checkout attempt, drafts); the theme is a device preference and stays. */
export function clearLocalData() {
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith("onza-") && key !== "onza-theme")
        localStorage.removeItem(key);
    sessionStorage.clear();
  } catch {
    /* Storage can be unavailable. */
  }
}
export function LogoutButton({
  to = "/acceso",
  label = "Cerrar sesión",
}: {
  to?: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        await browserDb().auth.signOut();
        clearLocalData();
        router.replace(to);
        router.refresh();
      }}
    >
      <LogOut size={20} aria-hidden="true" />
      {label}
    </Button>
  );
}
export function SwitchAccountButton({ to }: { to: string }) {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        await browserDb().auth.signOut();
        router.replace(to);
        router.refresh();
      }}
    >
      Usar otra cuenta
    </Button>
  );
}
export function PreferenceToggles({
  news,
  offers,
}: {
  news: boolean;
  offers: boolean;
}) {
  const [state, setState] = useState({ news, offers });
  const [message, setMessage] = useState("");
  async function save(next: typeof state) {
    setState(next);
    const { error } = await browserDb().rpc("update_preferences", next);
    setMessage(
      error
        ? "No pudimos guardar tus preferencias. Intentá de nuevo."
        : "Preferencias guardadas.",
    );
  }
  return (
    <div className="stack tight">
      <label className="checkbox">
        <input
          type="checkbox"
          checked={state.news}
          onChange={(e) => void save({ ...state, news: e.target.checked })}
        />
        <span>Novedades de Onza</span>
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={state.offers}
          onChange={(e) => void save({ ...state, offers: e.target.checked })}
        />
        <span>Ofertas de mis discotecas favoritas</span>
      </label>
      {message && (
        <p role="status" className="muted">
          {message}
        </p>
      )}
    </div>
  );
}
