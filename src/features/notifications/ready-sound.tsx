"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/primitives";
import type { Order } from "@/features/orders/types";
function tone(audio: AudioContext) {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.frequency.value = 660;
  gain.gain.setValueAtTime(0.08, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.3);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.3);
}
export function ReadySound({ orders }: { orders: Order[] }) {
  const audio = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      const seen: string[] = JSON.parse(
        localStorage.getItem("onza-ready-events") ?? "[]",
      );
      for (const order of orders) {
        const event = order.events.find((e) => e.type === "ready");
        if (event && !seen.includes(event.id)) {
          seen.push(event.id);
          if (enabled && audio.current?.state === "running")
            tone(audio.current);
        }
      }
      localStorage.setItem(
        "onza-ready-events",
        JSON.stringify(seen.slice(-200)),
      );
    } catch {
      /* Visual state remains authoritative if local preferences are unavailable. */
    }
  }, [orders, enabled]);
  useEffect(
    () => () => {
      void audio.current?.close();
    },
    [],
  );
  return (
    <div>
      <Button
        variant="secondary"
        onClick={async () => {
          try {
            if (enabled) {
              setEnabled(false);
              return;
            }
            const context = audio.current ?? new AudioContext();
            audio.current = context;
            await context.resume();
            if (context.state !== "running") throw new Error();
            tone(context);
            setEnabled(true);
          } catch {
            setError(
              "Este navegador no pudo activar el sonido. El aviso visual sigue disponible.",
            );
          }
        }}
      >
        {enabled ? "Desactivar sonido" : "Activar sonido"}
      </Button>
      <p className="muted">
        Aviso solo con esta web abierta. No se garantiza sonido con el teléfono
        bloqueado.
      </p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
