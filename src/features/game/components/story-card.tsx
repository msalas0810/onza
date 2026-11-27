"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Notice } from "@/components/ui/primitives";
import type { Story } from "../types";
import { gameApi } from "../client-api";
import { AvatarView } from "./avatar-view";
import styles from "./game.module.css";

export type StoryWithUrl = Story & { url: string | null };

export function StoryCard({ story }: { story: StoryWithUrl }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");

  async function act(action: Record<string, unknown>, ok: string) {
    setBusy(true);
    setMessage("");
    const result = await gameApi(action);
    setBusy(false);
    if (result.ok) {
      setMessage(ok);
      setReporting(false);
      router.refresh();
    } else setMessage(result.message);
  }

  return (
    <article className={`${styles.card} ${styles.story}`} aria-label={`Historia de @${story.author.username}`}>
      <div className={styles.row}>
        <AvatarView card={story.author} size={36} label={`Avatar de @${story.author.username}`} />
        <span className={styles.grow}>
          @{story.author.username}
          <span className={styles.muted}> · {story.venue_name}</span>
        </span>
      </div>
      {story.url ? (
        story.media_type === "video" ? (
          <video src={story.url} controls playsInline preload="metadata" aria-label={story.caption || "Video del trago"} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={story.url} alt={story.caption || "Foto del trago"} loading="lazy" />
        )
      ) : (
        <p className={styles.muted}>No pudimos cargar el archivo.</p>
      )}
      {story.caption && <p>{story.caption}</p>}
      {story.product_link && (
        <Link className="btn secondary" href={story.product_link}>Ver este trago en el menú</Link>
      )}
      <div className={styles.row}>
        {story.mine ? (
          <Button variant="secondary" size="sm" loading={busy} onClick={() => act({ action: "story_delete", storyId: story.id }, "Historia borrada.")}>
            Borrar
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setReporting((v) => !v)}>Reportar</Button>
        )}
      </div>
      {reporting && (
        <div className="stack tight">
          <label className="field">
            <span>¿Qué pasa con esta historia?</span>
            <input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
          </label>
          <Button size="sm" loading={busy} disabled={reason.trim().length < 3} onClick={() => act({ action: "story_report", storyId: story.id, reason }, "Gracias, lo vamos a revisar.")}>
            Enviar reporte
          </Button>
        </div>
      )}
      {message && (
        <div aria-live="polite">
          <Notice tone="neutral" title="Historias">{message}</Notice>
        </div>
      )}
    </article>
  );
}
