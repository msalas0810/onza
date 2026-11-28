import Link from "next/link";
import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { requirePlatformPage } from "@/lib/platform/page-guard";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { VenueActions, VenueEditor } from "@/features/platform/components/venue-panels";
import { VENUE_STATUS, formatCrc, type MenuView, type VenueDetail } from "@/features/platform/types";
import { ROLE_LABELS, type OrgRole } from "@/features/platform/schemas";
import styles from "@/features/platform/components/platform.module.css";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, email } = await requirePlatformPage(`/admin/establecimientos/${id}`);
  if (!UUID.test(id)) notFound();
  const [venueRes, menuRes] = await Promise.all([db.rpc("platform_venue_get", { p_id: id }), db.rpc("platform_venue_menu", { p_id: id })]);
  if (venueRes.error) {
    if (venueRes.error.message.includes("NOT_FOUND")) notFound();
    throw new Error(venueRes.error.message);
  }
  const d = venueRes.data as unknown as VenueDetail;
  const menu = (menuRes.data ?? { categories: [], products: [] }) as unknown as MenuView;
  const v = d.venue;
  const origin = process.env.APP_ORIGIN ?? "";
  const link = `${origin}${d.menu_link}`;
  const qr = await QRCode.toDataURL(link, { width: 480, margin: 2, errorCorrectionLevel: "M" });
  const max = Math.max(1, ...d.activity_30d.map((a) => a.orders));
  return (
    <PlatformShell active="establecimientos" email={email}>
      <div className={styles.head}>
        <h1>{v.name}</h1>
        <span className={styles.badge} data-tone={v.suspended_at ? "warn" : v.publication_status === "published" ? "ok" : undefined}>
          {v.suspended_at ? "Suspendido" : (VENUE_STATUS[v.publication_status] ?? v.publication_status)}
        </span>
      </div>
      <p className={styles.muted}>{d.organization ? <>Empresa: <Link href={`/admin/empresas/${d.organization.id}`}>{d.organization.name}</Link></> : "Sin empresa asignada"} · {v.zone || "sin zona"}</p>
      {v.suspended_at && <p>Suspendido: {v.suspended_reason}</p>}
      <VenueActions venue={v} />
      <h2>Recepción de pedidos</h2>
      <p>{v.open_state === "open" && !v.paused ? "Recibiendo pedidos" : v.paused ? "En pausa" : "Cerrado"} · capacidad {v.capacity} · aceptación automática {v.auto_accept ? "activa" : "apagada"}.</p>
      <h2>Actividad de 30 días</h2>
      <div className={styles.bars} role="img" aria-label={`Pedidos por día, máximo ${max}`}>
        {d.activity_30d.map((a) => <span key={a.day} title={`${a.day}: ${a.orders}`} style={{ height: `${Math.max(3, (a.orders / max) * 100)}%` }} />)}
      </div>
      <h2>Enlace y código QR</h2>
      <p><a href={d.menu_link}>{link}</a></p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.qr} src={qr} alt="Código QR del menú del establecimiento" />
      <h2>Datos, horarios y servicio</h2>
      <VenueEditor venue={v} />
      <h2>Personal</h2>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead><tr><th>Correo</th><th>Rol</th><th>Estado</th></tr></thead>
          <tbody>
            {d.staff.length === 0 && <tr><td colSpan={3} className={styles.muted}>Sin personal asignado.</td></tr>}
            {d.staff.map((s) => <tr key={s.user_id}><td>{s.email}</td><td>{ROLE_LABELS[s.role as OrgRole] ?? s.role}</td><td>{s.status === "active" ? "Activo" : "Suspendido"}</td></tr>)}
          </tbody>
        </table>
      </div>
      <h2>Menú y plano (solo lectura)</h2>
      <p className={styles.muted}>{menu.products.length} productos en {menu.categories.length} categorías · {d.spots} lugares en el plano. La edición la hace el equipo del local con su administrador.</p>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead><tr><th>Categoría</th><th>Producto</th><th className={styles.num}>Precio</th><th>Estado</th></tr></thead>
          <tbody>
            {menu.products.slice(0, 200).map((p) => (
              <tr key={p.id}><td>{menu.categories.find((c) => c.id === p.category_id)?.label}</td><td>{p.name}</td><td className={styles.num}>{formatCrc(p.price_minor)}</td><td>{p.archived ? "Archivado" : p.available ? "Disponible" : "Agotado"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </PlatformShell>
  );
}
