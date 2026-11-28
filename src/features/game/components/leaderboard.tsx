import type { LeaderboardEntry } from "../types";
import { AvatarView } from "./avatar-view";
import styles from "./game.module.css";

/** Lista de posiciones con avatares. `unit` describe el valor que ordena el ranking. */
export function Leaderboard({ entries, unit, empty }: { entries: LeaderboardEntry[]; unit: string; empty: string }) {
  if (entries.length === 0) return <p className={styles.muted}>{empty}</p>;
  return (
    <ol style={{ listStyle: "none", padding: 0, margin: 0 }} aria-label="Posiciones">
      {entries.map((entry) => (
        <li key={entry.avatar.user_id} className={styles.entry} data-me={entry.me}>
          <span className={styles.rank}>{entry.rank}</span>
          <AvatarView card={entry.avatar} size={40} label={`Avatar de @${entry.avatar.username}`} />
          <span className={styles.grow}>
            @{entry.avatar.username}
            {entry.me && " (vos)"}
            <span className={styles.muted}> · Nivel {entry.avatar.level}</span>
          </span>
          <strong>
            {entry.value ?? entry.visits} {unit}
          </strong>
        </li>
      ))}
    </ol>
  );
}
