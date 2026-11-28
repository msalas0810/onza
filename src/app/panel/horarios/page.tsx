import { loadPanel } from "@/lib/platform/panel-session";
import { PanelShell } from "@/features/platform/components/panel-shell";
import { PlatformApiProvider } from "@/features/platform/components/platform-api";
import { VenueEditor } from "@/features/platform/components/venue-panels";
import type { VenueDetail } from "@/features/platform/types";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ empresa?: string; local?: string }> }) {
  const sp = await searchParams;
  const { db, orgs, org, venue } = await loadPanel("/panel/horarios", sp);
  if (!org) return null;
  if (!venue || !["owner", "admin", "venue_manager", "ops_manager"].includes(org.role))
    return <PanelShell active="horarios" orgs={orgs} org={org} venueId={venue?.id}><h1>Horarios y servicio</h1><p>{venue ? "Su rol no permite cambiar estos datos." : "Elija un local en la barra lateral."}</p></PanelShell>;
  const { data, error } = await db.from("venues").select("id,name,slug,zone,hours,eta_minutes,brand_color,demo_listed,service_modes,open_state,paused,capacity,auto_accept,publication_status,suspended_at,suspended_reason").eq("id", venue.id).single();
  if (error) throw new Error(error.message);
  return (
    <PanelShell active="horarios" orgs={orgs} org={org} venueId={venue.id}>
      <h1>Horarios y servicio · {venue.name}</h1>
      <PlatformApiProvider>
        <VenueEditor mode="company" venue={data as unknown as VenueDetail["venue"]} />
      </PlatformApiProvider>
    </PanelShell>
  );
}
