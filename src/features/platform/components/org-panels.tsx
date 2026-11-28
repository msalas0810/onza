"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Notice, TextField, Toggle } from "@/components/ui/primitives";
import { ROLES, ROLE_LABELS, SCOPED_ROLES, type OrgRole } from "../schemas";
import { usePlatformApi } from "./platform-api";
import { ConfirmAction, CopyField } from "./common";
import type { OrgDetail } from "../types";
import styles from "./platform.module.css";

/** Activar, suspender, desactivar y eliminar una empresa, siempre con confirmación en pantalla. */
export function OrgActions({ org }: { org: OrgDetail["organization"] }) {
  const api = usePlatformApi();
  const router = useRouter();
  const setStatus = (status: "active" | "suspended" | "closed") => async ({ reason }: { reason: string }) => {
    const r = await api.command({ command: "org_status", id: org.id, status, reason });
    if (r.ok) router.refresh();
    return r.ok ? null : r.message;
  };
  return (
    <div className={styles.actions}>
      {org.status !== "active" && (
        <ConfirmAction label="Activar" title="Activar la empresa" description="La empresa vuelve a operar y a recibir pedidos." onConfirm={setStatus("active")} />
      )}
      {org.status === "active" && (
        <ConfirmAction label="Suspender" title="Suspender la empresa" danger requireReason onConfirm={setStatus("suspended")}
          description="Una empresa suspendida no puede operar ni recibir pedidos nuevos, y sus locales dejan de verse en el directorio." />
      )}
      {org.status !== "closed" && (
        <ConfirmAction label="Desactivar" title="Desactivar la empresa" danger requireReason onConfirm={setStatus("closed")}
          description="La empresa queda cerrada. Es el paso previo para poder eliminarla." />
      )}
      <ConfirmAction label="Eliminar" title="Eliminar la empresa" danger requireText={org.slug} disabled={org.status !== "closed"}
        description="Solo se puede eliminar una empresa desactivada y sin establecimientos. No se puede deshacer."
        onConfirm={async ({ typed }) => {
          const r = await api.command({ command: "org_delete", id: org.id, confirmSlug: typed });
          if (r.ok) router.replace("/admin/empresas");
          return r.ok ? null : r.message;
        }} />
    </div>
  );
}

export function OrgEditor({ org }: { org: OrgDetail["organization"] }) {
  const api = usePlatformApi();
  const router = useRouter();
  const [v, setV] = useState({ name: org.name, legal_name: org.legal_name, plan: org.plan, notes: org.notes, contact_name: org.contact_name ?? "", contact_email: org.contact_email ?? "", is_demo: org.is_demo });
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setMsg(null);
    const r = await api.command({ command: "org_update", id: org.id, values: { ...v, contact_name: v.contact_name || null, contact_email: v.contact_email || null } });
    setBusy(false);
    if (r.ok) { setMsg({ tone: "success", text: "Datos guardados." }); router.refresh(); } else setMsg({ tone: "danger", text: r.message });
  }
  return (
    <div className={styles.stack}>
      <div className={styles.form}>
        <TextField label="Nombre comercial" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        <TextField label="Razón social" value={v.legal_name} onChange={(e) => setV({ ...v, legal_name: e.target.value })} />
        <TextField label="Nombre de contacto" value={v.contact_name} onChange={(e) => setV({ ...v, contact_name: e.target.value })} />
        <TextField label="Correo de contacto" type="email" value={v.contact_email} onChange={(e) => setV({ ...v, contact_email: e.target.value })} />
        <label className="field"><span>Plan (sin cobros)</span>
          <select value={v.plan} onChange={(e) => setV({ ...v, plan: e.target.value })}><option value="free">Gratis</option><option value="standard">Estándar</option><option value="premium">Premium</option></select>
        </label>
        <TextField label="Notas internas" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
      </div>
      <Toggle label="Empresa de demostración" checked={v.is_demo} onChange={(is_demo) => setV({ ...v, is_demo })} />
      {msg && <Notice tone={msg.tone === "success" ? "success" : "danger"} title={msg.tone === "success" ? "Listo" : "No se pudo guardar"}>{msg.text}</Notice>}
      <div><Button loading={busy} onClick={save}>Guardar datos</Button></div>
    </div>
  );
}

/** Invitaciones de la empresa: crear (muestra el enlace una sola vez) y revocar. */
export function InvitePanel({ org, venues, invitations }: { org: string; venues: { id: string; name: string }[]; invitations: OrgDetail["invitations"] }) {
  const api = usePlatformApi();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("admin");
  const [picked, setPicked] = useState<string[]>([]);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const scoped = SCOPED_ROLES.includes(role);
  async function create() {
    setBusy(true);
    setError("");
    setLink("");
    const r = await api.command<{ inviteUrl: string }>({ command: "invitation_create", organizationId: org, email, role, venueIds: scoped || picked.length ? picked : undefined });
    setBusy(false);
    if (r.ok) { setLink(r.result.inviteUrl); setEmail(""); router.refresh(); } else setError(r.message);
  }
  const STATE: Record<string, string> = { pending: "Pendiente", expired: "Vencida", accepted: "Aceptada", revoked: "Revocada" };
  return (
    <div className={styles.stack}>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead><tr><th>Correo</th><th>Rol</th><th>Estado</th><th>Vence</th><th /></tr></thead>
          <tbody>
            {invitations.length === 0 && <tr><td colSpan={5} className={styles.muted}>Sin invitaciones.</td></tr>}
            {invitations.map((i) => (
              <tr key={i.id}>
                <td>{i.email}</td><td>{ROLE_LABELS[i.role as OrgRole] ?? i.role}</td><td>{STATE[i.state] ?? i.state}</td><td>{new Date(i.expires_at).toLocaleDateString("es-CR")}</td>
                <td>{i.state === "pending" && (
                  <ConfirmAction label="Revocar" title="Revocar la invitación" description="El enlace deja de funcionar." danger
                    onConfirm={async () => { const r = await api.command({ command: "invitation_revoke", id: i.id }); if (r.ok) router.refresh(); return r.ok ? null : r.message; }} />
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.form}>
        <TextField label="Correo de la persona" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        <label className="field"><span>Rol</span>
          <select value={role} onChange={(e) => setRole(e.target.value as OrgRole)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
        </label>
      </div>
      {role !== "owner" && role !== "admin" && (
        <fieldset className={styles.stack}>
          <legend className={styles.muted}>{scoped ? "Establecimientos (al menos uno)" : "Establecimientos (vacío = todos)"}</legend>
          {venues.map((v) => (
            <label key={v.id} className={styles.actions}>
              <input type="checkbox" checked={picked.includes(v.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, v.id] : picked.filter((x) => x !== v.id))} /> {v.name}
            </label>
          ))}
        </fieldset>
      )}
      {error && <Notice tone="danger" title="No se pudo invitar">{error}</Notice>}
      {link && <CopyField label="Enlace de activación (se muestra una sola vez)" value={link} />}
      <div><Button loading={busy} disabled={!email || (scoped && picked.length === 0)} onClick={create}>Crear invitación</Button></div>
      <p className={styles.muted}>No hay servicio de correo propio: copie el enlace y entréguelo a la persona. Vence a los 7 días y sirve una sola vez.</p>
    </div>
  );
}

/** Exporta el inventario de productos de la empresa a CSV (con comillas escapadas y sin fórmulas ejecutables). */
export function InventoryExport({ id, slug }: { id: string; slug: string }) {
  const api = usePlatformApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setBusy(true);
    setError("");
    const r = await api.get<{ venue: string; category: string; product: string; price_minor: number; available: boolean; archived: boolean }[]>({ view: "inventory", id });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    // Neutraliza fórmulas (=, +, -, @) que una hoja de cálculo ejecutaría.
    const cell = (v: unknown) => {
      let s = String(v ?? "");
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const rows = [["Establecimiento", "Categoría", "Producto", "Precio (₡)", "Disponible", "Archivado"], ...r.result.map((p) => [p.venue, p.category, p.product, (p.price_minor / 100).toFixed(0), p.available ? "sí" : "no", p.archived ? "sí" : "no"])];
    const url = URL.createObjectURL(new Blob(["﻿" + rows.map((row) => row.map(cell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventario-${slug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className={styles.stack}>
      <div><Button variant="secondary" loading={busy} onClick={download}>Exportar inventario (CSV)</Button></div>
      {error && <Notice tone="danger" title="No se pudo exportar">{error}</Notice>}
    </div>
  );
}
