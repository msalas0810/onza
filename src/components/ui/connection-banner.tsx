"use client";
import { RefreshCw, WifiOff } from "lucide-react";
import { useOnline } from "@/lib/use-online";

/** Aviso persistente mientras el dispositivo no tenga conexión. Nunca un aviso efímero: el estado vive en la pantalla. */
export function ConnectionBanner({ message }: { message?: string }) {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="banner" role="status">
      <WifiOff size={16} aria-hidden="true" />
      <span className="grow">
        {message ??
          "Sin conexión. Mostramos lo último que cargamos; no se puede pedir hasta reconectar."}
      </span>
    </div>
  );
}
/** Aviso de reconexión del canal en vivo (Realtime). */
export function ReconnectingBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="banner" role="status">
      <RefreshCw size={16} aria-hidden="true" />
      <span className="grow">
        Reconectando… volvemos a consultar al conectar.
      </span>
    </div>
  );
}
