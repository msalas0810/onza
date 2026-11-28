import Link from "next/link";
import { Lock, MapPin } from "lucide-react";
import { ErrorState } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/errors";
import { getBarMap } from "@/features/game/server/game-service";
import styles from "@/features/game/components/game.module.css";

export const dynamic = "force-dynamic";

async function load() {
  try {
    return { ok: true as const, map: await getBarMap() };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
}

export default async function Page() {
  const data = await load();
  if (!data.ok)
    return (
      <div className="page">
        <div className="page-head"><h1>Mapa de bares</h1></div>
        <ErrorState message={data.error} />
      </div>
    );
  const { map } = data;
  return (
    <div className="page">
      <div className="page-head"><h1>Mapa de bares</h1></div>
      <div className="stack">
        <p className={styles.muted}>
          Desbloqueaste {map.unlocked} de {map.total}. Un bar se desbloquea con un pedido entregado ahí: una visita verificada, no un check-in.
        </p>
        <ul className={styles.grid} style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {map.venues.map((v) => (
            <li key={v.venueId} className={`${styles.card} ${v.unlocked ? "" : styles.locked}`}>
              {v.unlocked ? <MapPin size={20} aria-hidden="true" /> : <Lock size={20} aria-hidden="true" />}
              <h3>{v.unlocked ? v.name : "Bar por descubrir"}</h3>
              <p className={styles.muted}>{v.zone || "Sin zona"}</p>
              {v.unlocked ? (
                <>
                  <p className={styles.muted}>
                    {v.visits} {v.visits === 1 ? "visita verificada" : "visitas verificadas"}
                  </p>
                  <Link className="btn secondary" href={`/v/${v.slug}`}>Ver el bar</Link>
                </>
              ) : (
                <p className={styles.muted}>Pedí y retirá ahí para desbloquearlo.</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
