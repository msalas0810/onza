import Link from "next/link";
import { loadPanel } from "@/lib/platform/panel-session";
import { PanelShell } from "@/features/platform/components/panel-shell";
import { formatCrc, type PanelSummary } from "@/features/platform/types";
import styles from "@/features/platform/components/platform.module.css";

export const dynamic = "force-dynamic";
const STATUS_LABELS: Record<string, string> = { queued: "En cola", preparing: "Preparando", ready: "Listo", delivered: "Entregado", canceled: "Cancelado", expired: "Vencido", uncollected: "No retirado", pending_authorization: "Por autorizar" };

export default async function Page({ searchParams }: { searchParams: Promise<{ empresa?: string; local?: string; dias?: string }> }) {
  const sp = await searchParams;
  const { db, orgs, org, venue } = await loadPanel("/panel", sp);
  if (!org)
    return (
      <div className={styles.auth}><div className={styles.authBox}><h1>Panel de empresa</h1><p>Su cuenta no pertenece a ninguna empresa. Pida una invitación a quien administra la suya.</p></div></div>
    );
  const days = [1, 7, 30].includes(Number(sp.dias)) ? Number(sp.dias) : 7;
  const { data, error } = await db.rpc("org_summary", { input: { organizationId: org.organization_id, venueId: venue?.id ?? "", days } });
  if (error) throw new Error(error.message);
  const s = data as unknown as PanelSummary;
  const max = Math.max(1, ...s.by_day.map((d) => d.orders));
  const base = `empresa=${org.organization_id}${venue ? `&local=${venue.id}` : ""}`;
  return (
    <PanelShell active="resumen" orgs={orgs} org={org} venueId={venue?.id}>
      <div className={styles.head}><h1>Resumen{venue ? ` · ${venue.name}` : ""}</h1></div>
      <nav className="chips" aria-label="Período">
        {[[1, "Hoy"], [7, "7 días"], [30, "30 días"]].map(([d, label]) => <Link key={d} className="chip" href={`/panel?${base}&dias=${d}`} aria-current={d === days}>{label}</Link>)}
      </nav>
      <div className={styles.cards}>
        <div className={styles.card}><span className={styles.muted}>Pedidos</span><strong>{s.orders}</strong></div>
        <div className={styles.card}><span className={styles.muted}>Entregados</span><strong>{s.delivered}</strong></div>
        <div className={styles.card}><span className={styles.muted}>Ventas entregadas</span><strong>{formatCrc(s.total_minor)}</strong></div>
        <div className={styles.card}><span className={styles.muted}>Locales</span><strong>{s.venues}</strong></div>
      </div>
      <h2>Pedidos por día</h2>
      <div className={styles.bars} role="img" aria-label={`Pedidos por día, máximo ${max}`}>
        {s.by_day.map((d) => <span key={d.day} title={`${d.day}: ${d.orders}`} style={{ height: `${Math.max(3, (d.orders / max) * 100)}%` }} />)}
      </div>
      <h2>Por estado</h2>
      <ul>{Object.entries(s.by_status).map(([k, n]) => <li key={k}>{STATUS_LABELS[k] ?? k}: {n}</li>)}</ul>
      {venue && ["owner", "admin", "venue_manager", "ops_manager", "cashier", "kitchen", "staff"].includes(org.role) && (
        <p><Link className="btn secondary" href={`/admin/${venue.id}`}>Abrir la operación del local</Link></p>
      )}
    </PanelShell>
  );
}
