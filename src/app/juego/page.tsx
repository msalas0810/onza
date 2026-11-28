import Link from "next/link";
import { ErrorState } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/errors";
import { getAvatarMe, getWallet } from "@/features/game/server/game-service";
import { getLoyaltyAccount } from "@/features/loyalty/server/loyalty-service";
import { AvatarView } from "@/features/game/components/avatar-view";
import styles from "@/features/game/components/game.module.css";

export const dynamic = "force-dynamic";

type Cashback = { balances: { venueId: string; venueName: string; points: number }[] };

export default async function Page() {
  let data;
  try {
    const [wallet, me, cashback] = await Promise.all([
      getWallet(),
      getAvatarMe(),
      getLoyaltyAccount().catch(() => ({ balances: [] })),
    ]);
    data = { wallet, me, cashback: cashback as unknown as Cashback };
  } catch (error) {
    return (
      <div className="page">
        <div className="page-head"><h1>Juego</h1></div>
        <ErrorState message={errorMessage(error)} />
      </div>
    );
  }
  const { wallet, me, cashback } = data;
  const span = wallet.next_level ? wallet.next_level.xp_required - wallet.level_xp : 0;
  const pct = wallet.next_level && span > 0 ? Math.min(100, Math.round(((wallet.xp - wallet.level_xp) / span) * 100)) : 100;
  return (
    <div className="page">
      <div className="page-head"><h1>Juego</h1></div>
      <div className="stack">
        <div className={styles.wallet}>
          <AvatarView card={me} size={96} label={`Avatar de @${me.username}`} />
          <div className="stack tight" style={{ flex: "1 1 220px" }}>
            <strong>
              @{me.username} · {wallet.level_title}
            </strong>
            <div
              className={styles.bar}
              role="progressbar"
              aria-label="Progreso al próximo nivel"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
            >
              <span style={{ width: `${pct}%` }} />
            </div>
            <p className={styles.muted}>
              {wallet.next_level
                ? `${wallet.xp} XP · faltan ${Math.max(wallet.next_level.xp_required - wallet.xp, 0)} para ${wallet.next_level.title}`
                : `${wallet.xp} XP · nivel máximo`}
            </p>
          </div>
          <div className={styles.metric}>
            <span className={styles.muted}>Avatar Coins</span>
            <strong>{wallet.coins}</strong>
          </div>
          <div className={styles.metric}>
            <span className={styles.muted}>Bares desbloqueados</span>
            <strong>{wallet.venues_unlocked}</strong>
          </div>
        </div>

        <nav className={styles.links} aria-label="Juego">
          <Link className="btn secondary" href="/avatar">Mi avatar</Link>
          <Link className="btn secondary" href="/tienda">Tienda</Link>
          <Link className="btn secondary" href="/ranking">Ranking</Link>
          <Link className="btn secondary" href="/bares">Mapa de bares</Link>
          <Link className="btn secondary" href="/historias">Drink Stories</Link>
          <Link className="btn secondary" href="/amigos">Amigos</Link>
        </nav>

        <section aria-labelledby="ach-title" className="stack tight">
          <h2 id="ach-title">Logros</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }} className="stack tight">
            {wallet.achievements.map((a) => (
              <li key={a.code} className={styles.card}>
                <div className={styles.row}>
                  <strong className={styles.grow}>{a.name}</strong>
                  <span className={styles.muted}>{a.unlocked_at ? "Desbloqueado" : `${a.progress}/${a.threshold}`}</span>
                </div>
                <p className={styles.muted}>{a.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="cash-title" className="stack tight">
          <h2 id="cash-title">Cashback</h2>
          <p className={styles.muted}>
            Puntos con valor monetario (1 punto = ₡1) que financia cada local. Son independientes de las Avatar Coins y del XP.
            El canje en el checkout todavía no está disponible.
          </p>
          {cashback.balances.length === 0 ? (
            <p className={styles.muted}>Todavía no acumulaste cashback.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {cashback.balances.map((b) => (
                <li key={b.venueId} className={styles.entry}>
                  <span className={styles.grow}>{b.venueName}</span>
                  <strong>{b.points} puntos</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
