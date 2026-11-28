import { loadPanel } from "@/lib/platform/panel-session";
import { PanelShell } from "@/features/platform/components/panel-shell";
import { formatCrc, formatDate, type PanelCustomer } from "@/features/platform/types";
import styles from "@/features/platform/components/platform.module.css";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ empresa?: string; local?: string }> }) {
  const sp = await searchParams;
  const { db, orgs, org, venue } = await loadPanel("/panel/clientes", sp);
  if (!org) return null;
  const { data, error } = await db.rpc("org_customers", { input: { organizationId: org.organization_id } });
  if (error) {
    if (error.message.includes("NOT_FOUND")) return <PanelShell active="clientes" orgs={orgs} org={org} venueId={venue?.id}><h1>Clientes</h1><p>Su rol no incluye ver clientes.</p></PanelShell>;
    throw new Error(error.message);
  }
  const rows = data as unknown as PanelCustomer[];
  return (
    <PanelShell active="clientes" orgs={orgs} org={org} venueId={venue?.id}>
      <h1>Clientes</h1>
      <p className={styles.muted}>Para proteger su privacidad, cada cliente se muestra con un seudónimo propio de su empresa: no se ve su correo ni su cuenta. El mismo seudónimo siempre es la misma persona dentro de su empresa.</p>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead><tr><th>Cliente</th><th className={styles.num}>Pedidos</th><th className={styles.num}>Ventas entregadas</th><th>Último pedido</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className={styles.muted}>Todavía no hay clientes.</td></tr>}
            {rows.map((c) => <tr key={c.pseudonym}><td>{c.pseudonym}</td><td className={styles.num}>{c.orders}</td><td className={styles.num}>{formatCrc(c.total_minor)}</td><td>{formatDate(c.last_order_at)}</td></tr>)}
          </tbody>
        </table>
      </div>
    </PanelShell>
  );
}
