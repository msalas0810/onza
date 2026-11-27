import Link from "next/link";
import { Activity, ChevronLeft, MapPin } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/errors";
import { getSocialOverview, getVenueActivity } from "@/features/social/server/social-service";
import { formatClock } from "@/lib/clock";
import { ActivityMap, projectVenues, type ActivityPoint } from "@/features/social/components/activity-map";

export const dynamic = "force-dynamic";

async function loadPoints(): Promise<{ points: readonly ActivityPoint[] } | { error: string }> {
  try {
    const venues = await getVenueActivity();
    return { points: projectVenues(venues).map((v) => ({ ...v, id: v.venueId })) };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

/** Amigos que comparten su local ahora (solo amistades aceptadas: lo decide social_overview en la base). */
async function loadSharingFriends() {
  try {
    return (await getSocialOverview()).friends.flatMap((f) => (f.venue ? [{ ...f, venue: f.venue }] : []));
  } catch {
    return null; // la actividad se muestra igual; la sección de amigos queda oculta
  }
}

export default async function ActivityPage() {
  const [result, sharing] = await Promise.all([loadPoints(), loadSharingFriends()]);
  return (
    <div className="page">
      <Link className="back" href="/">
        <ChevronLeft size={16} aria-hidden="true" />
        Explorar
      </Link>
      <div className="page-head">
        <h1>Actividad</h1>
      </div>
      <p className="muted activity-lead">
        Personas que marcaron «Estoy acá» en las últimas horas, sin nombres ni números exactos.
      </p>
      {"error" in result ? (
        <ErrorState message={result.error} />
      ) : result.points.length ? (
        <ActivityMap points={result.points} />
      ) : (
        <EmptyState
          title="Todavía no hay actividad visible"
          icon={Activity}
          action={
            <div className="row wrap center">
              <Link className="btn primary" href="/amigos">
                Marcar que estoy acá
              </Link>
            </div>
          }
        >
          Aparece un local cuando 5 o más personas marcan que están ahí.
        </EmptyState>
      )}
      {sharing && (
        <section className="block-card" aria-labelledby="friends-here">
          <h2 id="friends-here">Tus amigos</h2>
          {sharing.length ? (
            <ul className="rows">
              {sharing.map((f) => (
                <li className="r" key={f.id}>
                  <span className="grow">
                    <strong>{f.name}</strong> <span className="muted">@{f.username}</span>
                    <br />
                    <Link className="friend-venue t-label" href={`/v/${f.venue.slug}`}>
                      <MapPin size={14} aria-hidden="true" />
                      {f.venue.name}, hasta las {formatClock(f.venue.expiresAt)}
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              Ningún amigo comparte su local ahora. <Link href="/amigos">Ir a Amigos</Link>
            </p>
          )}
        </section>
      )}
    </div>
  );
}
