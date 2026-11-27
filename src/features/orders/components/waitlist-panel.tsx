"use client";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { Clock, Users } from "lucide-react";
import { Button, Notice } from "@/components/ui/primitives";
import { countdownText } from "../countdown";

export const waitlistEntrySchema = z.object({
  id: z.string().optional(),
  status: z.enum(["none", "waiting", "offered", "claimed", "expired", "left"]),
  position: z.number().nullable().optional(),
  offer_expires_at: z.string().nullable().optional(),
  wait_expires_at: z.string().nullable().optional(),
  order_id: z.string().nullable().optional(),
  closed_reason: z.string().nullable().optional(),
  venue_paused: z.boolean().optional(),
  server_now: z.string(),
});
export type WaitlistEntry = z.infer<typeof waitlistEntrySchema>;

export async function waitlistRequest(action: "join" | "status" | "leave", venueId: string) {
  const response = await fetch("/api/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, venueId }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const record = (body ?? {}) as { error?: string; message?: string; detail?: { retryAt?: string } };
    throw Object.assign(new Error(record.message ?? "No pudimos consultar la lista de espera."), {
      code: record.error ?? "UNKNOWN",
      retryAt: record.detail?.retryAt,
    });
  }
  return waitlistEntrySchema.parse(body);
}

/**
 * Lista de espera persistente (vive en el servidor: sobrevive a cerrar la pantalla). Mientras se espera no existe pedido
 * ni reserva de dinero y el carrito queda intacto. Cuando se libera un cupo, la oferta se retiene unos minutos y
 * «Confirmar pedido» crea el pedido revalidando stock, precio, estado del local y capacidad. Sin tiempo estimado inventado.
 */
export function WaitlistPanel({
  venueId,
  entry: initial,
  confirming,
  onConfirm,
  onLeave,
}: {
  venueId: string;
  entry: WaitlistEntry;
  confirming: boolean;
  onConfirm: () => void;
  onLeave: () => void;
}) {
  const [entry, setEntry] = useState(initial);
  const [offset, setOffset] = useState(() => Date.parse(initial.server_now) - Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = useCallback(
    (next: WaitlistEntry) => {
      setEntry(next);
      setOffset(Date.parse(next.server_now) - Date.now());
    },
    [],
  );
  useEffect(() => {
    if (entry.status !== "waiting" && entry.status !== "offered") return;
    const poll = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void waitlistRequest("status", venueId).then(update).catch(() => undefined);
    }, 4000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [entry.status, venueId, update]);
  const act = async (action: "join" | "leave") => {
    setBusy(true);
    setError("");
    try {
      const next = await waitlistRequest(action, venueId);
      update(next);
      if (action === "leave") onLeave();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos actualizar tu lugar.");
    } finally {
      setBusy(false);
    }
  };
  const left = entry.offer_expires_at ? Date.parse(entry.offer_expires_at) - (now + offset) : 0;
  if (entry.status === "offered" && left > 0)
    return (
      <section className="waitlist offered" role="status" aria-live="polite">
        <strong className="t-heading">¡Se liberó un cupo!</strong>
        <p>
          Lo guardamos para vos <span className="num countdown-chip"><Clock size={14} aria-hidden="true" /> {countdownText(left)}</span>.
          Al confirmar revisamos precios, stock y el local.
        </p>
        <Button size="lg" block loading={confirming} onClick={onConfirm}>
          Confirmar pedido
        </Button>
        <Button variant="quiet" block disabled={busy || confirming} onClick={() => void act("leave")}>
          Salir de la lista
        </Button>
        {error && <p className="field-error" role="alert">{error}</p>}
      </section>
    );
  if (entry.status === "waiting" || (entry.status === "offered" && left <= 0))
    return (
      <section className="waitlist" role="status" aria-live="polite">
        <div className="row">
          <Users size={20} aria-hidden="true" />
          <strong className="grow">Estás en la lista de espera</strong>
          <span className="waiting-dots" aria-hidden="true"><i /><i /><i /></span>
        </div>
        {entry.venue_paused ? (
          <Notice tone="warning">El local pausó los pedidos. Conservamos tu lugar; no hay cupos nuevos hasta que reanude.</Notice>
        ) : (
          <p>
            {entry.position === 1 ? "Sos la próxima persona en la fila." : `Sos el ${entry.position ?? "—"}.º en la fila.`} Te avisamos acá cuando se libere un cupo.
          </p>
        )}
        <p className="hint">Tu carrito se conserva. Todavía no hay pedido.</p>
        <Button variant="quiet" block loading={busy} onClick={() => void act("leave")}>
          Salir de la lista
        </Button>
        {error && <p className="field-error" role="alert">{error}</p>}
      </section>
    );
  if (entry.status === "expired")
    return (
      <section className="waitlist" role="status">
        <strong>{entry.closed_reason === "offer_expired" ? "El cupo ofrecido venció" : "Tu lugar en la lista venció"}</strong>
        <p className="hint">Tu carrito sigue acá. Podés volver a entrar en la lista.</p>
        <Button variant="secondary" block loading={busy} onClick={() => void act("join")}>
          Volver a intentar
        </Button>
        {error && <p className="field-error" role="alert">{error}</p>}
      </section>
    );
  return null;
}
