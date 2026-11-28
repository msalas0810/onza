import Link from "next/link";
import { loadPanel } from "@/lib/platform/panel-session";
import { PanelShell } from "@/features/platform/components/panel-shell";
import { formatCrc, type MenuView } from "@/features/platform/types";
import styles from "@/features/platform/components/platform.module.css";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ empresa?: string; local?: string }> }) {
  const sp = await searchParams;
  const { db, orgs, org, venue } = await loadPanel("/panel/menu", sp);
  if (!org) return null;
  if (!venue)
    return <PanelShell active="menu" orgs={orgs} org={org}><h1>Menú</h1><p>Elija un local en la barra lateral para ver su menú.</p></PanelShell>;
  const { data, error } = await db.rpc("org_menu", { p_venue: venue.id });
  if (error) throw new Error(error.message);
  const menu = data as unknown as MenuView;
  const canEdit = ["owner", "admin", "venue_manager", "ops_manager"].includes(org.role);
  return (
    <PanelShell active="menu" orgs={orgs} org={org} venueId={venue.id}>
      <div className={styles.head}>
        <h1>Menú · {venue.name}</h1>
        {canEdit && <Link className="btn" href={`/admin/${venue.id}?tab=menu`}>Editar menú y precios</Link>}
      </div>
      {menu.categories.map((c) => (
        <section key={c.id}>
          <h2>{c.label}</h2>
          <ul>{menu.products.filter((p) => p.category_id === c.id).map((p) => <li key={p.id}>{p.name} · {formatCrc(p.price_minor)}{p.available ? "" : " · agotado"}</li>)}</ul>
        </section>
      ))}
      {menu.categories.length === 0 && <p className={styles.muted}>Este local todavía no tiene menú.</p>}
    </PanelShell>
  );
}
