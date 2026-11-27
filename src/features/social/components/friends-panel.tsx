"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, Copy, MapPin, UserPlus, Users } from "lucide-react";
import {
  Button,
  EmptyState,
  Notice,
  SegmentedControl,
  StatusBadge,
  TextField,
  Toggle,
} from "@/components/ui/primitives";
import { formatClock } from "@/lib/clock";
import { errorMessage } from "@/lib/errors";
import {
  checkinMinutes,
  socialOverviewSchema,
  type SocialAction,
  type SocialOverview,
} from "../types";

type VenueOption = { id: string; name: string; zone: string | null };
const until = (iso: string) => formatClock(iso);

/**
 * Amigos y «Estoy acá». Compartir el local es una decisión aparte del check-in, apagada por defecto, con su hora de
 * vencimiento a la vista y un botón para dejar de compartir al instante. El servidor valida todo (202611270027).
 */
export function FriendsPanel({
  initial,
  venues,
  invite,
  preselectVenue,
}: {
  initial: SocialOverview;
  venues: VenueOption[];
  /** @usuario que llega por un enlace de invitación (/amigos?agregar=…). */
  invite?: string;
  preselectVenue?: string;
}) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Si quien invitó ya es amigo o ya pidió amistad, no se precarga: la acción es aceptar, arriba.
  const known = (u: string) =>
    initial.friends.some((f) => f.username === u) || initial.incoming.some((r) => r.username === u);
  const [handle, setHandle] = useState(invite && !known(invite) ? invite : "");
  const [venueId, setVenueId] = useState(preselectVenue ?? venues[0]?.id ?? "");
  const [minutes, setMinutes] = useState<(typeof checkinMinutes)[number]>(120);
  const [share, setShare] = useState(false);
  const [copied, setCopied] = useState(false);

  const send = async (key: string, action: SocialAction, done = "") => {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/social", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action),
      });
      const body: unknown = await response.json();
      if (!response.ok)
        throw new Error(
          typeof body === "object" && body && "error" in body ? String(body.error) : "UNKNOWN_ERROR",
        );
      setData(socialOverviewSchema.parse(body));
      if (done) setNotice(done);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(null);
    }
  };

  // El enlace se arma al tocar (en el navegador): durante el render del servidor no hay window.
  const copy = async () => {
    if (!data.me) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/amigos?agregar=${encodeURIComponent(data.me.username)}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No pudimos copiar el enlace. Compartí tu @usuario.");
    }
  };
  const sharing = data.friends.filter((f) => f.venue);

  return (
    <div className="stack loose social">
      {error && <Notice tone="danger">{error}</Notice>}
      {notice && (
        <p role="status" className="saved">
          <Check size={16} aria-hidden="true" /> {notice}
        </p>
      )}

      <section className="block-card" aria-labelledby="here-title">
        <h2 id="here-title">Estoy acá</h2>
        {data.checkin ? (
          <div className="stack">
            <div className="checkin-now">
              <MapPin size={20} aria-hidden="true" />
              <div className="grow">
                <strong>{data.checkin.venueName}</strong>
                <div className="muted t-label">Hasta las {until(data.checkin.expiresAt)}</div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                loading={busy === "checkout"}
                onClick={() => void send("checkout", { action: "checkout" }, "Listo, ya no figurás en ningún local.")}
              >
                Me fui
              </Button>
            </div>
            <Toggle
              label={
                data.checkin.share
                  ? `Tus amigos ven que estás acá hasta las ${until(data.checkin.expiresAt)}`
                  : "Que mis amigos vean este local"
              }
              checked={data.checkin.share}
              disabled={busy === "share"}
              onChange={(next) =>
                void send(
                  "share",
                  { action: "share", share: next },
                  next ? "Tus amigos ya lo ven." : "Dejaste de compartir. Nadie lo ve desde ahora.",
                )
              }
            />
          </div>
        ) : venues.length ? (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void send("checkin", { action: "checkin", venueId, minutes, share }, "Listo, contás para la actividad del local.");
            }}
          >
            <label className="field">
              <span>Local</span>
              <select value={venueId} onChange={(e) => setVenueId(e.target.value)}>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.zone ? `${v.name} (${v.zone})` : v.name}
                  </option>
                ))}
              </select>
            </label>
            <SegmentedControl<string>
              block
              label="Por cuánto tiempo"
              value={String(minutes)}
              options={checkinMinutes.map((m) => ({ value: String(m), label: `${m / 60} h` }))}
              onChange={(next) => setMinutes(Number(next) as (typeof checkinMinutes)[number])}
            />
            <Toggle label="Que mis amigos vean este local" checked={share} onChange={setShare} />
            <Button type="submit" loading={busy === "checkin"} disabled={!venueId}>
              Estoy acá
            </Button>
            <p className="muted t-label">
              Cuenta para el mapa de actividad sin mostrar quién sos. Pedir no te marca en ningún local.
            </p>
          </form>
        ) : (
          <p className="muted">No hay locales abiertos en este momento.</p>
        )}
      </section>

      <section className="block-card" aria-labelledby="friends-title">
        <div className="row between wrap">
          <h2 id="friends-title">Amigos</h2>
          {sharing.length > 0 && (
            <StatusBadge tone="success">{sharing.length} compartiendo</StatusBadge>
          )}
        </div>
        {data.friends.length ? (
          <ul className="rows friend-list">
            {data.friends.map((f) => (
              <li className="r wrap" key={f.id}>
                <div className="grow">
                  <strong>{f.name}</strong> <span className="muted">@{f.username}</span>
                  <div className="t-label">
                    {f.venue ? (
                      <Link href={`/v/${f.venue.slug}`} className="friend-venue">
                        <MapPin size={14} aria-hidden="true" />
                        {f.venue.name}, hasta las {until(f.venue.expiresAt)}
                      </Link>
                    ) : (
                      <span className="muted">No comparte ningún local</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="quiet"
                  size="sm"
                  loading={busy === `remove-${f.id}`}
                  onClick={() =>
                    void send(`remove-${f.id}`, { action: "friend_remove", friendId: f.id }, `Quitaste a @${f.username}.`)
                  }
                >
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Todavía no tenés amigos en Onza" icon={Users}>
            Invitalos con tu enlace o su @usuario. Solo ven tu local si lo compartís.
          </EmptyState>
        )}
      </section>

      {data.incoming.length > 0 && (
        <section className="block-card" aria-labelledby="incoming-title">
          <h2 id="incoming-title">Solicitudes</h2>
          <ul className="rows">
            {data.incoming.map((r) => (
              <li className="r wrap" key={r.id}>
                <div className="grow">
                  <strong>{r.name}</strong> <span className="muted">@{r.username}</span>
                </div>
                <div className="row">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={busy === `no-${r.id}`}
                    onClick={() => void send(`no-${r.id}`, { action: "friend_respond", requestId: r.id, accept: false })}
                  >
                    Rechazar
                  </Button>
                  <Button
                    size="sm"
                    loading={busy === `yes-${r.id}`}
                    onClick={() =>
                      void send(
                        `yes-${r.id}`,
                        { action: "friend_respond", requestId: r.id, accept: true },
                        `@${r.username} ya es tu amigo.`,
                      ).then((ok) => ok && handle.replace(/^@/, "") === r.username && setHandle(""))
                    }
                  >
                    Aceptar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="block-card" aria-labelledby="invite-title">
        <h2 id="invite-title">Invitar</h2>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void send("request", { action: "friend_request", username: handle }, `Solicitud enviada a @${handle.replace(/^@/, "")}.`).then(
              (ok) => ok && setHandle(""),
            );
          }}
        >
          <TextField
            label="@usuario de Onza"
            value={handle}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setHandle(e.target.value)}
          />
          <Button type="submit" variant="secondary" loading={busy === "request"} disabled={!handle.trim()}>
            <UserPlus size={16} aria-hidden="true" /> Enviar solicitud
          </Button>
        </form>
        {data.me && (
          <div className="invite-link">
            <span className="muted t-label">Tu @usuario es @{data.me.username}</span>
            <Button variant="quiet" size="sm" onClick={() => void copy()}>
              {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              {copied ? "Enlace copiado" : "Copiar enlace de invitación"}
            </Button>
          </div>
        )}
        {data.outgoing.length > 0 && (
          <p className="muted t-label">
            Esperando respuesta: {data.outgoing.map((o) => `@${o.username}`).join(", ")}
          </p>
        )}
      </section>
    </div>
  );
}
