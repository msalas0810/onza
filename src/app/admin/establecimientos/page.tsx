import Link from "next/link";
import { requirePlatformPage } from "@/lib/platform/page-guard";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { VENUE_STATUS, type VenueRow } from "@/features/platform/types";
import styles from "@/features/platform/components/platform.module.css";

export const dynamic = "force-dynamic";
const FILTERS = [["", "Todos"], ["published", "Publicados"], ["directory", "En directorio"], ["pending", "Pendientes"], ["suspended", "Suspendidos"], ["archived", "Archivados"]] as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ filtro?: string; q?: string }> }) {
  const { filtro, q } = await searchParams;
  const { db, email } = await requirePlatformPage("/admin/establecimientos");
  const { data, error } = await db.rpc("platform_venues_list", { input: { filter: filtro ?? "", q: q ?? "" } });
  if (error) throw new Error(error.message);
  const items = (data as unknown as { items: VenueRow[] }).items;
  return (
    <PlatformShell active="establecimientos" email={email}>
      <div className={styles.head}>
        <h1>Establecimientos</h1>
        <Link className="btn" href="/admin/nuevo-establecimiento">Nuevo establecimiento</Link>
      </div>
      <nav className="chips" aria-label="Filtros">
        {FILTERS.map(([value, label]) => <Link key={value} className="chip" href={value ? `/admin/establecimientos?filtro=${value}` : "/admin/establecimientos"} aria-current={(filtro ?? "") === value}>{label}</Link>)}
      </nav>
      <form className={styles.filters} method="get" role="search">
        {filtro && <input type="hidden" name="filtro" value={filtro} />}
        <label className="field"><span>Buscar</span><input name="q" defaultValue={q ?? ""} maxLength={100} /></label>
        <button className="btn secondary" type="submit">Buscar</button>
      </form>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead><tr><th>Establecimiento</th><th>Empresa</th><th>Estado</th><th>Directorio</th><th>Recepción</th></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={5} className={styles.muted}>No hay establecimientos con ese filtro.</td></tr>}
            {items.map((v) => (
              <tr key={v.id}>
                <td><Link href={`/admin/establecimientos/${v.id}`}>{v.name}</Link><br /><span className={styles.muted}>/v/{v.slug}</span></td>
                <td>{v.organization_id ? <Link href={`/admin/empresas/${v.organization_id}`}>{v.organization}</Link> : <span className={styles.muted}>Sin empresa</span>}</td>
                <td>{v.suspended ? <span className={styles.badge} data-tone="warn">Suspendido</span> : (VENUE_STATUS[v.publication_status] ?? v.publication_status)}</td>
                <td>{v.directory_visible ? "Sí" : "No"}</td>
                <td>{v.open_state === "open" && !v.paused ? "Recibe pedidos" : v.paused ? "En pausa" : "Cerrado"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PlatformShell>
  );
}
