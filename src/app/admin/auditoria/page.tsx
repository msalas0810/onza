import { requirePlatformPage } from "@/lib/platform/page-guard";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { formatDate, type AuditRow, type OrgRow } from "@/features/platform/types";
import styles from "@/features/platform/components/platform.module.css";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export default async function Page({ searchParams }: { searchParams: Promise<{ empresa?: string; accion?: string }> }) {
  const { empresa, accion } = await searchParams;
  const { db, email } = await requirePlatformPage("/admin/auditoria");
  const org = empresa && UUID.test(empresa) ? empresa : "";
  const [log, orgs] = await Promise.all([
    db.rpc("platform_audit_list", { input: { organizationId: org, action: accion ?? "", limit: 200 } }),
    db.rpc("platform_orgs_list", { input: { limit: 200 } }),
  ]);
  if (log.error) throw new Error(log.error.message);
  const rows = log.data as unknown as AuditRow[];
  const orgList = ((orgs.data ?? { items: [] }) as unknown as { items: OrgRow[] }).items;
  return (
    <PlatformShell active="auditoria" email={email}>
      <h1>Auditoría</h1>
      <p className={styles.muted}>Registro de solo inserción de todas las empresas. Nunca incluye contraseñas ni tokens.</p>
      <form className={styles.filters} method="get" role="search">
        <label className="field"><span>Empresa</span>
          <select name="empresa" defaultValue={org}><option value="">Todas</option>{orgList.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        </label>
        <label className="field"><span>Acción (empieza con)</span><input name="accion" defaultValue={accion ?? ""} placeholder="venue. · organization. · invitation." maxLength={80} /></label>
        <button className="btn secondary" type="submit">Filtrar</button>
      </form>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead><tr><th>Fecha</th><th>Quién</th><th>Acción</th><th>Detalle</th><th>Petición</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className={styles.muted}>Sin registros con esos filtros.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatDate(r.at)}</td><td>{r.actor_email ?? "—"}</td><td>{r.action}</td>
                <td><code>{JSON.stringify(r.details)}</code></td><td className={styles.muted}>{r.request_id ?? "—"}{r.ip ? ` · ${r.ip}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PlatformShell>
  );
}
