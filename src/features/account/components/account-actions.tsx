"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { browserDb } from "@/lib/supabase/browser";
import { signOutDevice } from "@/lib/supabase/sign-out";
import { Button, Toggle } from "@/components/ui/primitives";
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
  compact = false,
  everywhere = false,
}: {
  to?: string;
  label?: string;
  /** Cierra la cuenta en todos los dispositivos (por defecto solo en este). */
  everywhere?: boolean;
  /** Botón chico para cabeceras: en pantallas angostas queda solo el ícono (con nombre accesible). */
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={compact || everywhere ? "secondary" : "danger"}
      size={compact ? "sm" : "md"}
      block={!compact}
      aria-label={label}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        await signOutDevice({ everywhere });
        clearLocalData();
        router.replace(to);
        router.refresh();
      }}
    >
      <LogOut size={compact ? 16 : 20} aria-hidden="true" />
      <span className="label">{label}</span>
    </Button>
  );
}
export function SwitchAccountButton({ to }: { to: string }) {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      block
      onClick={async () => {
        await signOutDevice();
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
      <Toggle
        label="Novedades de Onza"
        checked={state.news}
        onChange={(checked) => void save({ ...state, news: checked })}
      />
      <Toggle
        label="Ofertas de mis locales favoritos"
        checked={state.offers}
        onChange={(checked) => void save({ ...state, offers: checked })}
      />
      {message && (
        <p role="status" className="hint">
          {message}
        </p>
      )}
    </div>
  );
}
