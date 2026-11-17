import Link from "next/link";
import { redirect } from "next/navigation";
import { Store } from "lucide-react";
import { StaffShell } from "@/components/ui/staff-shell";
import {
  EmptyState,
  StatusBadge,
  buttonClass,
} from "@/components/ui/primitives";
import { VenueMark } from "@/features/catalog/components/venue-parts";
import { venueStatus } from "@/features/catalog/components/venue-status";
import {
  personFor,
  roleLabel,
  type StaffRole,
} from "@/features/team/server/staff-context";
import { serverDb } from "@/lib/supabase/server";
import { ConfigurationState } from "@/components/ui/configuration-state";

export const dynamic = "force-dynamic";
export default async function Page() {
  const db = await serverDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user || user.is_anonymous)
    redirect("/equipo/acceso?next=%2Fequipo%2Flocales");
  const { data: account } = await db.rpc("current_account");
  const state = account as {
    kind?: string;
    mustChangePassword?: boolean;
  } | null;
  if (state?.kind === "customer") redirect("/sesion-activa?want=equipo");
  if (state?.mustChangePassword) redirect("/equipo/clave");
  const { person } = await personFor(db, user);
  const { data: memberships, error } = await db
    .from("memberships")
    .select("venue_id,role");
  const ids = (memberships ?? []).map((m) => m.venue_id);
  const { data: venues } = ids.length
    ? await db.from("venues").select("*").in("id", ids).order("name")
    : { data: [] };
  const { data: platform } = await db.rpc("has_platform_access");
  if (error)
    return (
      <StaffShell person={person}>
        <ConfigurationState error={error} />
      </StaffShell>
    );
  return (
    <StaffShell person={person} wide={false}>
      <div className="page-head">
        <h1 className="t-title">Tus locales</h1>
        <p className="muted">Elegí dónde vas a trabajar.</p>
      </div>
      {venues && venues.length > 0 ? (
        <div className="stack">
          {venues.map((venue) => {
            const role = (memberships ?? []).find(
              (m) => m.venue_id === venue.id,
            )?.role as StaffRole;
            const status = venueStatus(venue);
            return (
              <div className="panel row wrap" key={venue.id}>
                <VenueMark venue={venue} />
                <div className="grow">
                  <strong>{venue.name}</strong>
                  <div className="row" style={{ gap: 8, marginTop: 4 }}>
                    <StatusBadge plain>{roleLabel(role)}</StatusBadge>
                    {status.badge}
                  </div>
                </div>
                <div className="row">
                  <Link
                    className={buttonClass({ size: "sm" })}
                    href={`/staff/${venue.id}`}
                  >
                    Abrir barra
                  </Link>
                  {(role === "admin" || role === "onza") && (
                    <Link
                      className={buttonClass({
                        variant: "secondary",
                        size: "sm",
                      })}
                      href={`/admin/${venue.id}`}
                    >
                      Administrar
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={Store} title="No tenés locales asignados">
          Pedile al administrador de tu local que te dé acceso.
        </EmptyState>
      )}
      {platform && (
        <div style={{ marginTop: 24 }}>
          <Link className={buttonClass({ variant: "quiet" })} href="/onza">
            Configuración global Onza
          </Link>
        </div>
      )}
    </StaffShell>
  );
}
