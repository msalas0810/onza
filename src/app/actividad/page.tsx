import Link from "next/link";
import { Activity, ChevronLeft } from "lucide-react";
import { EmptyState, ErrorState, StatusBadge } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/errors";
import { getVenueActivity } from "@/features/social/server/social-service";
import { ActivityMap, projectVenues, type ActivityPoint } from "@/features/social/components/activity-map";
import { simulatedActivity } from "@/features/social/activity-fixtures";

export const dynamic = "force-dynamic";

/** Real o simulado (rotulado), nunca mezclados. */
async function loadPoints(simulated: boolean): Promise<{ points: readonly ActivityPoint[] } | { error: string }> {
  if (simulated) return { points: simulatedActivity.points };
  try {
    const venues = await getVenueActivity();
    return { points: projectVenues(venues).map((v) => ({ ...v, id: v.venueId })) };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ ejemplo?: string }>;
}) {
  const simulated = (await searchParams).ejemplo === "1";
  const result = await loadPoints(simulated);
  return (
    <div className="page">
      <Link className="back" href="/">
        <ChevronLeft size={16} aria-hidden="true" />
        Explorar
      </Link>
      <div className="page-head row between wrap">
        <h1>Actividad</h1>
        {simulated && <StatusBadge tone="warning">Simulado</StatusBadge>}
      </div>
      <p className="muted activity-lead">
        {simulated
          ? "Ejemplo con lugares ficticios para mostrar cómo se ve. No son datos reales."
          : "Personas que marcaron «Estoy acá» en las últimas horas, sin nombres ni números exactos."}
      </p>
      {"error" in result ? (
        <ErrorState message={result.error} />
      ) : result.points.length ? (
        <ActivityMap points={result.points} simulated={simulated} />
      ) : (
        <EmptyState
          title="Todavía no hay actividad visible"
          icon={Activity}
          action={
            <div className="row wrap center">
              <Link className="btn primary" href="/amigos">
                Marcar que estoy acá
              </Link>
              <Link className="btn secondary" href="/actividad?ejemplo=1">
                Ver ejemplo simulado
              </Link>
            </div>
          }
        >
          Aparece un local cuando 3 o más personas marcan que están ahí.
        </EmptyState>
      )}
      {simulated && (
        <Link className="btn secondary" href="/actividad">
          Volver a la actividad real
        </Link>
      )}
    </div>
  );
}
