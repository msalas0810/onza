"use client";
import { useEffect, useRef, useState } from "react";
import { Toggle } from "@/components/ui/primitives";
import type { Order } from "@/features/orders/types";

function tone(audio: AudioContext, frequency = 880) {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.08, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.3);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.3);
}

/**
 * Aviso opcional cuando un pedido queda listo: sonido (solo tras un gesto) y, donde el navegador lo ofrece, una vibración
 * corta. El estado visual siempre es la fuente de verdad; esto nunca es la única señal.
 */
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
          if (enabled) {
            if (audio.current?.state === "running") tone(audio.current);
            if ("vibrate" in navigator) navigator.vibrate(200);
          }
        }
      }
      localStorage.setItem(
        "onza-ready-events",
        JSON.stringify(seen.slice(-200)),
      );
    } catch {
      /* El estado visual sigue siendo la fuente de verdad. */
    }
  }, [orders, enabled]);
  useEffect(
    () => () => {
      void audio.current?.close();
    },
    [],
  );
  return (
    <div className="panel">
      <Toggle
        label="Avisarme con sonido cuando esté listo"
        checked={enabled}
        onChange={async (next) => {
          setError("");
          if (!next) return setEnabled(false);
          try {
            const context = audio.current ?? new AudioContext();
            audio.current = context;
            await context.resume();
            if (context.state !== "running") throw new Error();
            tone(context, 660);
            setEnabled(true);
          } catch {
            setError(
              "Este navegador no pudo activar el sonido. El aviso en pantalla sigue disponible.",
            );
          }
        }}
      />
      <p className="hint">
        Funciona con esta pestaña abierta. No se garantiza con el teléfono
        bloqueado.
      </p>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
