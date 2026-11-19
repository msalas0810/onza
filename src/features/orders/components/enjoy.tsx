"use client";
import Link from "next/link";
import { buttonClass } from "@/components/ui/primitives";

/**
 * Momento final tras la entrega física confirmada por el servidor: una mano levanta el vasito de Onza. Ilustración
 * original en trazo (sin tono de piel) con el vasito rojo oficial como máscara. La animación dura menos de un segundo,
 * ocurre una vez y, con movimiento reducido, queda la ilustración quieta.
 */
export function EnjoyMoment({
  venueName,
  menuHref,
}: {
  venueName: string;
  /** Menú del mismo local, o null si ya no está disponible (se ofrece Explorar). */
  menuHref: string | null;
}) {
  return (
    <section className="enjoy" role="status" aria-labelledby="enjoy-title">
      <div className="enjoy-art" aria-hidden="true">
        <svg viewBox="0 0 160 170" className="enjoy-hand">
          <g className="enjoy-raise">
            <foreignObject x="54" y="18" width="52" height="64">
              <span className="enjoy-shot" />
            </foreignObject>
            <g
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Puño que envuelve la base del vasito: dedos horizontales y pulgar por delante. */}
              <path
                className="enjoy-fist"
                d="M52 66h50a10 10 0 0 1 10 10v20a14 14 0 0 1-14 14H58a10 10 0 0 1-10-10V70a4 4 0 0 1 4-4z"
              />
              <path d="M60 78h40M60 88h44M62 98h36" />
              <path d="M48 74c-9 5-8 16 3 17 11 1 22-3 30-9" />
              {/* Muñeca y puño de la manga. */}
              <path d="M66 110v34M96 110v34M60 132h42" />
            </g>
          </g>
          <g
            className="enjoy-spark"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          >
            <path d="M38 30l-10-8M122 30l10-8M80 6v-2" />
            <path d="M30 56h-12M130 56h12" />
          </g>
        </svg>
      </div>
      <h2 id="enjoy-title" className="enjoy-title">
        ¡Disfrutá!
      </h2>
      <p className="muted">Tu pedido en {venueName} está entregado.</p>
      <Link className={buttonClass({ size: "lg", block: true })} href={menuHref ?? "/"}>
        {menuHref ? "Volver al menú" : "Explorar locales"}
      </Link>
    </section>
  );
}
