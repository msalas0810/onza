import Link from "next/link";
import type { ReactNode } from "react";
import type { PanelOrg } from "../types";
import styles from "./platform.module.css";

const NAV = [
  { id: "resumen", path: "/panel", label: "Resumen" },
  { id: "clientes", path: "/panel/clientes", label: "Clientes" },
  { id: "menu", path: "/panel/menu", label: "Menú" },
  { id: "horarios", path: "/panel/horarios", label: "Horarios y servicio" },
  { id: "personal", path: "/panel/personal", label: "Personal" },
] as const;
export type PanelSection = (typeof NAV)[number]["id"];

/** Marco del panel de empresa: selector de empresa y de local, y navegación. El rol decide qué opciones se ven. */
export function PanelShell({ active, orgs, org, venueId, children }: { active: PanelSection; orgs: PanelOrg[]; org: PanelOrg; venueId?: string; children: ReactNode }) {
  const can = (id: PanelSection) => (id === "personal" ? ["owner", "admin"].includes(org.role) : id === "horarios" ? ["owner", "admin", "venue_manager", "ops_manager"].includes(org.role) : id === "clientes" ? ["owner", "admin", "ops_manager", "analyst", "venue_manager"].includes(org.role) : true);
  const qs = (extra: Record<string, string | undefined> = {}) => {
    const p = new URLSearchParams({ empresa: org.organization_id, ...(venueId ? { local: venueId } : {}), ...extra } as Record<string, string>);
    for (const [k, v] of Object.entries(extra)) if (v === undefined) p.delete(k);
    return p.toString();
  };
  return (
    <div className={styles.shell}>
      <aside className={styles.side}>
        <h1>{org.name}</h1>
        {org.status !== "active" && <p role="status" className={styles.badge} data-tone="warn">Empresa suspendida: solo lectura</p>}
        {orgs.length > 1 && (
          <nav aria-label="Empresas" className={styles.nav}>
            {orgs.map((o) => <Link key={o.organization_id} href={`/panel?empresa=${o.organization_id}`} aria-current={o.organization_id === org.organization_id ? "true" : undefined}>{o.name}</Link>)}
          </nav>
        )}
        <nav aria-label="Local" className={styles.nav}>
          <Link href={`/panel${active === "resumen" ? "" : NAV.find((n) => n.id === active)?.path.replace("/panel", "")}?${qs({ local: undefined })}`} aria-current={!venueId ? "true" : undefined}>Todos los locales</Link>
          {org.venues.map((v) => <Link key={v.id} href={`${NAV.find((n) => n.id === active)?.path}?${qs({ local: v.id })}`} aria-current={v.id === venueId ? "true" : undefined}>{v.name}</Link>)}
        </nav>
        <nav aria-label="Panel de empresa" className={styles.nav}>
          {NAV.filter((n) => can(n.id)).map((n) => <Link key={n.id} href={`${n.path}?${qs()}`} aria-current={n.id === active ? "page" : undefined}>{n.label}</Link>)}
        </nav>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
