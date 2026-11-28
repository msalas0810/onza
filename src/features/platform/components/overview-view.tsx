import Link from "next/link";
import { formatCrc, ORG_STATUS, type Overview } from "../types";
import styles from "./platform.module.css";

export function OverviewView({ data }: { data: Overview }) {
  const max = Math.max(1, ...data.by_day.map((d) => d.orders));
  const cards: [string, string | number, string?][] = [
    ["Empresas", data.organizations.total, `${data.organizations.active} activas · ${data.organizations.suspended} suspendidas`],
    ["Establecimientos", data.venues.total, `${data.venues.published} publicados · ${data.venues.draft} pendientes`],
    ["Pedidos del período", data.orders.count, `${data.orders.delivered} entregados`],
    ["Ventas entregadas", formatCrc(data.orders.total_minor)],
  ];
  return (
    <div>
      <div className={styles.head}>
        <h1>Resumen global</h1>
        <span className={styles.muted}>Del {data.period.from} al {data.period.to}</span>
      </div>
      <div className={styles.cards}>
        {cards.map(([label, value, hint]) => (
          <div key={label} className={styles.card}>
            <span className={styles.muted}>{label}</span>
            <strong>{value}</strong>
            {hint && <span className={styles.muted}>{hint}</span>}
          </div>
        ))}
      </div>
      <h2>Pedidos por día</h2>
      <div className={styles.bars} role="img" aria-label={`Pedidos por día: máximo ${max}`}>
        {data.by_day.map((d) => (
          <span key={d.day} title={`${d.day}: ${d.orders} pedidos`} style={{ height: `${Math.max(3, (d.orders / max) * 100)}%` }} />
        ))}
      </div>
      <h2>Actividad por empresa</h2>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead><tr><th>Empresa</th><th>Estado</th><th className={styles.num}>Establecimientos</th><th className={styles.num}>Pedidos</th><th className={styles.num}>Ventas entregadas</th></tr></thead>
          <tbody>
            {data.by_organization.length === 0 && <tr><td colSpan={5} className={styles.muted}>Todavía no hay empresas.</td></tr>}
            {data.by_organization.map((o) => (
              <tr key={o.organization_id}>
                <td><Link href={`/admin/empresas/${o.organization_id}`}>{o.name}</Link></td>
                <td><span className={styles.badge} data-tone={ORG_STATUS[o.status]?.tone}>{ORG_STATUS[o.status]?.label ?? o.status}</span></td>
                <td className={styles.num}>{o.venues}</td><td className={styles.num}>{o.orders}</td><td className={styles.num}>{formatCrc(o.total_minor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.venues.without_organization > 0 && (
        <p className={styles.muted}>{data.venues.without_organization} establecimientos anteriores al modelo de empresas todavía no tienen empresa asignada.</p>
      )}
    </div>
  );
}
