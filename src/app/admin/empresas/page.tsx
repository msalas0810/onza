import Link from "next/link";
import { requirePlatformPage } from "@/lib/platform/page-guard";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { ORG_STATUS, formatDate, type OrgRow } from "@/features/platform/types";
import styles from "@/features/platform/components/platform.module.css";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ estado?: string; demo?: string; q?: string }> }) {
  const { estado, demo, q } = await searchParams;
  const { db, email } = await requirePlatformPage("/admin/empresas");
  const { data, error } = await db.rpc("platform_orgs_list", { input: { status: estado ?? "", demo: demo ?? "", q: q ?? "" } });
  if (error) throw new Error(error.message);
  const list = data as unknown as { total: number; items: OrgRow[] };
  return (
    <PlatformShell active="empresas" email={email}>
      <div className={styles.head}>
        <h1>Empresas</h1>
        <Link className="btn" href="/admin/nueva-empresa">Nueva empresa</Link>
      </div>
      <form className={styles.filters} method="get" role="search">
        <label className="field"><span>Estado</span>
          <select name="estado" defaultValue={estado ?? ""}><option value="">Todos</option><option value="active">Activas</option><option value="suspended">Suspendidas</option><option value="closed">Desactivadas</option></select>
        </label>
        <label className="field"><span>Demostración</span>
          <select name="demo" defaultValue={demo ?? ""}><option value="">Todas</option><option value="true">Solo demostración</option><option value="false">Sin demostración</option></select>
        </label>
        <label className="field"><span>Buscar</span><input name="q" defaultValue={q ?? ""} maxLength={100} /></label>
        <button className="btn secondary" type="submit">Filtrar</button>
      </form>
      <p className={styles.muted}>{list.total} empresas</p>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead><tr><th>Empresa</th><th>País</th><th>Plan</th><th>Estado</th><th className={styles.num}>Locales</th><th className={styles.num}>Personas</th><th className={styles.num}>Pedidos 30 d</th><th>Alta</th></tr></thead>
          <tbody>
            {list.items.length === 0 && <tr><td colSpan={8} className={styles.muted}>No hay empresas con esos filtros.</td></tr>}
            {list.items.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/admin/empresas/${o.id}`}>{o.name}</Link>{o.is_demo && <> <span className={styles.badge}>demo</span></>}<br /><span className={styles.muted}>/{o.slug}</span></td>
                <td>{o.country}</td><td>{o.plan}</td>
                <td><span className={styles.badge} data-tone={ORG_STATUS[o.status]?.tone}>{ORG_STATUS[o.status]?.label ?? o.status}</span></td>
                <td className={styles.num}>{o.venues}</td><td className={styles.num}>{o.members}</td><td className={styles.num}>{o.orders_30d}</td><td>{formatDate(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PlatformShell>
  );
}
