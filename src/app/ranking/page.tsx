import Link from "next/link";
import { ErrorState } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/errors";
import { getVenues } from "@/features/catalog/server/queries";
import { getFriendsBoard, getVenueBoard } from "@/features/game/server/game-service";
import { Leaderboard } from "@/features/game/components/leaderboard";
import styles from "@/features/game/components/game.module.css";

export const dynamic = "force-dynamic";
const METRICS = [
  { id: "xp", label: "Actividad (XP)", unit: "XP" },
  { id: "venues", label: "Exploración", unit: "bares" },
  { id: "achievements", label: "Logros", unit: "logros" },
] as const;

async function load(view: "amigos" | "bar", metric: (typeof METRICS)[number]["id"], local?: string) {
  try {
    const venues = (await getVenues()).filter((v) => v.open_state === "open" || v.id === local);
    const venue = venues.find((v) => v.id === local) ?? venues[0];
    const friends = view === "amigos" ? await getFriendsBoard(metric) : [];
    const board = view === "bar" && venue ? await getVenueBoard(venue.id) : null;
    return { ok: true as const, venues, venue, friends, board };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; metrica?: string; local?: string }>;
}) {
  const { vista, metrica, local } = await searchParams;
  const view = vista === "bar" ? "bar" : "amigos";
  const metric = METRICS.find((m) => m.id === metrica) ?? METRICS[0];
  const data = await load(view, metric.id, local);
  if (!data.ok)
    return (
      <div className="page">
        <div className="page-head"><h1>Ranking</h1></div>
        <ErrorState message={data.error} />
      </div>
    );
  const { venues, venue, friends, board } = data;
  return (
    <div className="page">
      <div className="page-head"><h1>Ranking</h1></div>
      <div className="stack">
        <nav className="chips" aria-label="Tipo de ranking">
          <Link className="chip" href="/ranking?vista=amigos" aria-current={view === "amigos"}>Entre amigos</Link>
          <Link className="chip" href="/ranking?vista=bar" aria-current={view === "bar"}>Por bar</Link>
        </nav>
        {view === "amigos" ? (
          <section className="stack tight" aria-labelledby="friends-title">
            <h2 id="friends-title">Entre amigos</h2>
            <p className={styles.muted}>Solo lo ven las amistades aceptadas entre sí.</p>
            <nav className="chips" aria-label="Qué se mide">
              {METRICS.map((m) => (
                <Link key={m.id} className="chip" href={`/ranking?vista=amigos&metrica=${m.id}`} aria-current={m.id === metric.id}>
                  {m.label}
                </Link>
              ))}
            </nav>
            <Leaderboard entries={friends} unit={metric.unit} empty="Agregá amistades para competir con ellas." />
          </section>
        ) : (
          <section className="stack tight" aria-labelledby="bar-title">
            <h2 id="bar-title">Por bar</h2>
            <p className={styles.muted}>
              Visitas verificadas (pedidos entregados). Solo aparece quien activó «Aparecer en el ranking de cada bar» en su avatar.
            </p>
            <nav className="chips" aria-label="Bar">
              {venues.map((v) => (
                <Link key={v.id} className="chip" href={`/ranking?vista=bar&local=${v.id}`} aria-current={v.id === venue?.id}>
                  {v.name}
                </Link>
              ))}
            </nav>
            {board && (
              <>
                {!board.participating && (
                  <p className={styles.muted}>
                    No estás participando. <Link href="/avatar">Activalo en tu avatar</Link> para aparecer.
                  </p>
                )}
                <Leaderboard entries={board.entries} unit="visitas" empty="Todavía nadie participa en el ranking de este bar." />
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
