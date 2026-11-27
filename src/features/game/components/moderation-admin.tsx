"use client";
import { Button, Notice } from "@/components/ui/primitives";
import type { ReportedStory } from "../server/onza-service";
import { useOnza } from "./use-onza";
import styles from "./game.module.css";

export function ModerationAdmin({ reports }: { reports: ReportedStory[] }) {
  const { run, busy, message } = useOnza();
  return (
    <div className="stack">
      <div aria-live="polite">
        {message && <Notice tone={message.tone === "success" ? "success" : "danger"} title={message.tone === "success" ? "Listo" : "No se pudo"}>{message.text}</Notice>}
      </div>
      {reports.length === 0 ? <p className={styles.muted}>No hay historias reportadas.</p> : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }} className="stack tight">
          {reports.map((r) => (
            <li key={r.story_id} className={styles.card}>
              <div className={styles.row}>
                <strong className={styles.grow}>{r.reports} {r.reports === 1 ? "reporte" : "reportes"} · {r.hidden ? "Oculta" : "Visible"}</strong>
                <span className={styles.muted}>{new Date(r.created_at).toLocaleString("es-CR")}</span>
              </div>
              {r.caption && <p>{r.caption}</p>}
              <p className={styles.muted}>Motivos: {r.reasons.join(" · ")}</p>
              <div className={styles.row}>
                <Button size="sm" variant="secondary" loading={busy === r.story_id}
                  onClick={() => run(r.story_id, { command: "story_moderate", storyId: r.story_id, hide: !r.hidden, reason: r.hidden ? undefined : "Moderación de ONZA" }, r.hidden ? "Historia restaurada." : "Historia ocultada.")}>
                  {r.hidden ? "Restaurar" : "Ocultar"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
