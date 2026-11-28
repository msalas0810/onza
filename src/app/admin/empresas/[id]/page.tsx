import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformPage } from "@/lib/platform/page-guard";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { OrgActions, OrgEditor, InvitePanel, InventoryExport } from "@/features/platform/components/org-panels";
import { ORG_STATUS, VENUE_STATUS, formatCrc, formatDate, type OrgDetail } from "@/features/platform/types";
import { ROLE_LABELS, type OrgRole } from "@/features/platform/schemas";
import styles from "@/features/platform/components/platform.module.css";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, email } = await requirePlatformPage(`/admin/empresas/${id}`);
  if (!UUID.test(id)) notFound();
  const { data, error } = await db.rpc("platform_org_get", { p_id: id });
  if (error) {
    if (error.message.includes("NOT_FOUND")) notFound();
    throw new Error(error.message);
  }
  const d = data as unknown as OrgDetail;
  const o = d.organization;
  return (
    <PlatformShell active="empresas" email={email}>
      <div className={styles.head}>
        <h1>{o.name}</h1>
        <span className={styles.badge} data-tone={ORG_STATUS[o.status]?.tone}>{ORG_STATUS[o.status]?.label ?? o.status}</span>
      </div>
      {o.status_reason && <p className={styles.muted}>Motivo: {o.status_reason}</p>}
      <OrgActions org={o} />
      <h2>Datos comerciales</h2>
      <dl className={styles.cards}>
        {[["Razón social", o.legal_name || "—"], ["Documento", o.tax_id || "—"], ["País", `${o.country} · ${o.currency}`], ["Contacto", [o.contact_name, o.contact_email, o.contact_phone].filter(Boolean).join(" · ") || "—"], ["Plan", o.plan], ["Alta", formatDate(o.created_at)]].map(([k, v]) => (
          <div key={k} className={styles.card}><dt className={styles.muted}>{k}</dt><dd style={{ margin: 0 }}>{v}</dd></div>
        ))}
      </dl>
      <h2>Editar datos y plan</h2>
      <OrgEditor org={o} />
      <h2>Establecimientos ({d.venues.length})</h2>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead><tr><th>Nombre</th><th>Zona</th><th>Estado</th><th>Directorio</th></tr></thead>
          <tbody>
            {d.venues.length === 0 && <tr><td colSpan={4} className={styles.muted}>Sin establecimientos.</td></tr>}
            {d.venues.map((v) => (
              <tr key={v.id}><td><Link href={`/admin/establecimientos/${v.id}`}>{v.name}</Link></td><td>{v.zone || "—"}</td><td>{v.suspended ? "Suspendido" : (VENUE_STATUS[v.publication_status] ?? v.publication_status)}</td><td>{v.directory_visible ? "Sí" : "No"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p><Link className="btn secondary" href="/admin/nuevo-establecimiento">Agregar un establecimiento</Link></p>
      <h2>Personas</h2>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead><tr><th>Correo</th><th>Rol</th><th>Estado</th></tr></thead>
          <tbody>
            {d.members.length === 0 && <tr><td colSpan={3} className={styles.muted}>Todavía nadie aceptó una invitación.</td></tr>}
            {d.members.map((m) => <tr key={m.user_id}><td>{m.email}</td><td>{ROLE_LABELS[m.role as OrgRole] ?? m.role}</td><td>{m.status === "active" ? "Activo" : "Suspendido"}</td></tr>)}
          </tbody>
        </table>
      </div>
      <h2>Invitaciones</h2>
      <InvitePanel org={o.id} venues={d.venues.map((v) => ({ id: v.id, name: v.name }))} invitations={d.invitations} />
      <h2>Pedidos recientes</h2>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead><tr><th>Código</th><th>Local</th><th>Estado</th><th className={styles.num}>Total</th><th>Fecha</th></tr></thead>
          <tbody>
            {d.recent_orders.length === 0 && <tr><td colSpan={5} className={styles.muted}>Sin pedidos.</td></tr>}
            {d.recent_orders.map((r) => <tr key={r.code}><td>{r.code}</td><td>{r.venue}</td><td>{r.status}</td><td className={styles.num}>{formatCrc(r.total_minor)}</td><td>{formatDate(r.created_at)}</td></tr>)}
          </tbody>
        </table>
      </div>
      <h2>Inventario</h2>
      <p>{d.inventory.products} productos en {d.inventory.categories} categorías.</p>
      <InventoryExport id={o.id} slug={o.slug} />
    </PlatformShell>
  );
}
