"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Notice, TextField } from "@/components/ui/primitives";
import { ROLES, ROLE_LABELS, SCOPED_ROLES, type OrgRole } from "../schemas";
import type { StaffList } from "../types";
import { ConfirmAction, CopyField } from "./common";
import styles from "./platform.module.css";

async function panelCommand<T = unknown>(body: Record<string, unknown>): Promise<{ ok: true; result: T } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/panel/commands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    return res.ok && data?.ok ? { ok: true, result: data.result as T } : { ok: false, message: data?.message ?? "No pudimos completar la operación." };
  } catch {
    return { ok: false, message: "No pudimos conectar con el servicio." };
  }
}

/** Personal por invitación: invitar, reenviar, revocar, cambiar roles y asignar uno o varios locales. */
export function StaffPanel({ organizationId, role, venues, staff, canGrantAdmin }: { organizationId: string; role: string; venues: { id: string; name: string }[]; staff: StaffList; canGrantAdmin: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<OrgRole>("staff");
  const [picked, setPicked] = useState<string[]>([]);
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<{ userId: string; role: OrgRole; venueIds: string[] } | null>(null);
  const roles = ROLES.filter((r) => canGrantAdmin || (r !== "owner" && r !== "admin"));
  const scoped = SCOPED_ROLES.includes(newRole);
  const venueName = (id: string) => venues.find((v) => v.id === id)?.name ?? "—";
  const scopeText = (ids: string[] | null) => (ids ? ids.map(venueName).join(", ") : "Todos");

  async function invite() {
    setBusy(true);
    setMsg(null);
    setLink("");
    const r = await panelCommand<{ inviteUrl: string }>({ command: "invitation_create", organizationId, email, role: newRole, venueIds: scoped || picked.length ? picked : undefined });
    setBusy(false);
    if (r.ok) { setLink(r.result.inviteUrl); setEmail(""); router.refresh(); } else setMsg({ tone: "danger", text: r.message });
  }
  const run = (body: Record<string, unknown>, ok: string) => async () => {
    const r = await panelCommand(body);
    if (r.ok) { setMsg({ tone: "success", text: ok }); router.refresh(); }
    return r.ok ? null : r.message;
  };

  return (
    <div className={styles.stack}>
      {msg && <Notice tone={msg.tone === "success" ? "success" : "danger"} title={msg.tone === "success" ? "Listo" : "No se pudo"}>{msg.text}</Notice>}
      <h2>Personas</h2>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead><tr><th>Correo</th><th>Rol</th><th>Locales</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {staff.members.map((m) => (
              <tr key={m.user_id}>
                <td>{m.email}{m.me && " (usted)"}</td><td>{ROLE_LABELS[m.role as OrgRole] ?? m.role}</td><td>{scopeText(m.venue_ids)}</td><td>{m.status === "active" ? "Activo" : "Suspendido"}</td>
                <td>
                  {!m.me && (canGrantAdmin || (m.role !== "owner" && m.role !== "admin")) && (
                    <div className={styles.actions}>
                      <Button size="sm" variant="secondary" onClick={() => setEdit({ userId: m.user_id, role: m.role as OrgRole, venueIds: m.venue_ids ?? [] })}>Cambiar</Button>
                      <ConfirmAction label="Quitar" title="Quitar a la persona" danger description="Pierde el acceso a la empresa y a sus locales." onConfirm={run({ command: "member_remove", organizationId, userId: m.user_id }, "Persona quitada.")} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <div className={styles.card}>
          <div className={styles.stack}>
            <strong>Cambiar rol y locales</strong>
            <label className="field"><span>Rol</span>
              <select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as OrgRole })}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
            </label>
            {edit.role !== "owner" && edit.role !== "admin" && (
              <fieldset className={styles.stack}>
                <legend className={styles.muted}>Locales {SCOPED_ROLES.includes(edit.role) ? "(al menos uno)" : "(vacío = todos)"}</legend>
                {venues.map((v) => (
                  <label key={v.id} className={styles.actions}>
                    <input type="checkbox" checked={edit.venueIds.includes(v.id)} onChange={(e) => setEdit({ ...edit, venueIds: e.target.checked ? [...edit.venueIds, v.id] : edit.venueIds.filter((x) => x !== v.id) })} /> {v.name}
                  </label>
                ))}
              </fieldset>
            )}
            <div className={styles.actions}>
              <Button disabled={SCOPED_ROLES.includes(edit.role) && edit.venueIds.length === 0}
                onClick={async () => { const r = await run({ command: "member_set", organizationId, userId: edit.userId, role: edit.role, venueIds: edit.role === "owner" || edit.role === "admin" || edit.venueIds.length === 0 ? undefined : edit.venueIds }, "Cambios guardados.")(); if (!r) setEdit(null); else setMsg({ tone: "danger", text: r }); }}>
                Guardar
              </Button>
              <Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}
      <h2>Invitaciones pendientes</h2>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead><tr><th>Correo</th><th>Rol</th><th>Locales</th><th>Vence</th><th /></tr></thead>
          <tbody>
            {staff.invitations.length === 0 && <tr><td colSpan={5} className={styles.muted}>No hay invitaciones pendientes.</td></tr>}
            {staff.invitations.map((i) => (
              <tr key={i.id}>
                <td>{i.email}</td><td>{ROLE_LABELS[i.role as OrgRole] ?? i.role}</td><td>{scopeText(i.venue_ids)}</td><td>{new Date(i.expires_at).toLocaleDateString("es-CR")}{i.state === "expired" && " (vencida)"}</td>
                <td>
                  <div className={styles.actions}>
                    <Button size="sm" variant="secondary" onClick={async () => { setMsg(null); const r = await panelCommand<{ inviteUrl: string }>({ command: "invitation_resend", id: i.id }); if (r.ok) { setLink(r.result.inviteUrl); router.refresh(); } else setMsg({ tone: "danger", text: r.message }); }}>Reenviar</Button>
                    <ConfirmAction label="Revocar" title="Revocar la invitación" danger description="El enlace deja de funcionar." onConfirm={run({ command: "invitation_revoke", id: i.id }, "Invitación revocada.")} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {link && <CopyField label="Enlace de activación (se muestra una sola vez)" value={link} />}
      <h2>Invitar a una persona</h2>
      <div className={styles.form}>
        <TextField label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        <label className="field"><span>Rol</span>
          <select value={newRole} onChange={(e) => setNewRole(e.target.value as OrgRole)}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
        </label>
      </div>
      {newRole !== "owner" && newRole !== "admin" && (
        <fieldset className={styles.stack}>
          <legend className={styles.muted}>Locales {scoped ? "(al menos uno)" : "(vacío = todos)"}</legend>
          {venues.map((v) => (
            <label key={v.id} className={styles.actions}>
              <input type="checkbox" checked={picked.includes(v.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, v.id] : picked.filter((x) => x !== v.id))} /> {v.name}
            </label>
          ))}
        </fieldset>
      )}
      <div><Button loading={busy} disabled={!email || (scoped && picked.length === 0)} onClick={invite}>Crear invitación</Button></div>
      <p className={styles.muted}>No hay servicio de correo propio: copie el enlace y entréguelo a la persona. Sirve una sola vez y vence a los 7 días. Su rol actual es {ROLE_LABELS[role as OrgRole] ?? role}.</p>
    </div>
  );
}
