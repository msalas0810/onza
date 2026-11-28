"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Notice, TextField, Toggle } from "@/components/ui/primitives";
import { SLUG_PATTERN, slugify } from "../validation";
import { usePlatformApi } from "./platform-api";
import { ConfirmAction } from "./common";
import type { ServiceModes, VenueDetail } from "../types";
import styles from "./platform.module.css";

/** Publicar, suspender, archivar y eliminar un establecimiento (la suspensión solo la aplica el superadministrador). */
export function VenueActions({ venue }: { venue: VenueDetail["venue"] }) {
  const api = usePlatformApi();
  const router = useRouter();
  const act = (action: string) => async ({ reason }: { reason: string }) => {
    const r = await api.command({ command: "venue_status", id: venue.id, action, reason });
    if (r.ok) router.refresh();
    return r.ok ? null : r.message;
  };
  const suspended = Boolean(venue.suspended_at);
  return (
    <div className={styles.actions}>
      {venue.publication_status !== "published" && venue.publication_status !== "archived" && (
        <ConfirmAction label="Publicar" title="Publicar el establecimiento" description="Pasa a verse en el directorio (si está marcado como visible) y a recibir pedidos." onConfirm={act("publish")} />
      )}
      {!suspended ? (
        <ConfirmAction label="Suspender" title="Suspender el establecimiento" danger requireReason onConfirm={act("suspend")} description="Deja de verse y de recibir pedidos nuevos. Solo usted puede levantar la suspensión." />
      ) : (
        <ConfirmAction label="Levantar suspensión" title="Levantar la suspensión" description={`Motivo actual: ${venue.suspended_reason ?? "sin motivo"}.`} onConfirm={act("unsuspend")} />
      )}
      {venue.publication_status !== "archived" ? (
        <ConfirmAction label="Archivar" title="Archivar el establecimiento" danger description="Deja de verse y de recibir pedidos. Se conserva todo su historial." onConfirm={act("archive")} />
      ) : (
        <ConfirmAction label="Desarchivar" title="Desarchivar el establecimiento" description="Vuelve a borrador; después puede publicarlo." onConfirm={act("unarchive")} />
      )}
      <ConfirmAction label="Eliminar" title="Eliminar el establecimiento" danger requireText={venue.slug} disabled={venue.publication_status !== "archived"}
        description="Solo se puede eliminar un establecimiento archivado y sin pedidos. No se puede deshacer."
        onConfirm={async ({ typed }) => {
          const r = await api.command({ command: "venue_delete", id: venue.id, confirmSlug: typed });
          if (r.ok) router.replace("/admin/establecimientos");
          return r.ok ? null : r.message;
        }} />
    </div>
  );
}

/** Datos del local: horarios, modalidades de servicio (consumo, retiro y entrega con zonas, tarifa y pedido mínimo), tiempo de preparación y marca. */
export function VenueEditor({ venue, mode = "platform" }: { venue: VenueDetail["venue"]; mode?: "platform" | "company" }) {
  const api = usePlatformApi();
  const router = useRouter();
  const m = venue.service_modes;
  const [v, setV] = useState({
    name: venue.name, zone: venue.zone, hours: venue.hours, eta_minutes: String(venue.eta_minutes), brand_color: venue.brand_color ?? "", directory: venue.demo_listed,
    dine_in: m.dine_in, pickup: m.pickup, delivery: m.delivery.enabled, zones: m.delivery.zones.join(", "), fee: String(m.delivery.fee_minor / 100), min: String(m.delivery.min_order_minor / 100),
  });
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setMsg(null);
    const service_modes: ServiceModes = {
      dine_in: v.dine_in, pickup: v.pickup,
      delivery: { enabled: v.delivery, zones: v.zones.split(",").map((z) => z.trim()).filter(Boolean), fee_minor: Math.round(Number(v.fee || 0) * 100), min_order_minor: Math.round(Number(v.min || 0) * 100) },
    };
    const values = { hours: v.hours, eta_minutes: Number(v.eta_minutes), brand_color: v.brand_color || null, service_modes };
    const r =
      mode === "platform"
        ? await api.command({ command: "venue_update", id: venue.id, values: { ...values, name: v.name, zone: v.zone, directory_visible: v.directory } })
        : await fetch("/api/panel/commands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: "venue_settings", venueId: venue.id, values }) })
            .then(async (res) => { const b = await res.json().catch(() => null); return res.ok && b?.ok ? ({ ok: true } as const) : ({ ok: false, message: b?.message ?? "No pudimos guardar." } as const); });
    setBusy(false);
    if (r.ok) { setMsg({ tone: "success", text: "Cambios guardados." }); router.refresh(); } else setMsg({ tone: "danger", text: r.message });
  }
  return (
    <div className={styles.stack}>
      <div className={styles.form}>
        {mode === "platform" && <TextField label="Nombre" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}
        {mode === "platform" && <TextField label="Zona" value={v.zone} onChange={(e) => setV({ ...v, zone: e.target.value })} />}
        <TextField label="Horario" value={v.hours} maxLength={300} onChange={(e) => setV({ ...v, hours: e.target.value })} hint="Por ejemplo: Lun–Sáb 17:00–01:00" />
        <TextField label="Tiempo de preparación (minutos)" type="number" min={1} max={120} value={v.eta_minutes} onChange={(e) => setV({ ...v, eta_minutes: e.target.value })} />
        <TextField label="Color de marca" value={v.brand_color} onChange={(e) => setV({ ...v, brand_color: e.target.value })} hint="Formato #RRGGBB (opcional)" />
      </div>
      <fieldset className={styles.stack}>
        <legend className={styles.muted}>Modalidades de servicio</legend>
        <Toggle label="Consumo en el local" checked={v.dine_in} onChange={(dine_in) => setV({ ...v, dine_in })} />
        <Toggle label="Retiro" checked={v.pickup} onChange={(pickup) => setV({ ...v, pickup })} />
        <Toggle label="Entrega a domicilio" checked={v.delivery} onChange={(delivery) => setV({ ...v, delivery })} />
        {v.delivery && (
          <div className={styles.form}>
            <TextField label="Zonas de entrega (separadas por coma)" value={v.zones} onChange={(e) => setV({ ...v, zones: e.target.value })} />
            <TextField label="Tarifa de entrega (₡)" type="number" min={0} value={v.fee} onChange={(e) => setV({ ...v, fee: e.target.value })} />
            <TextField label="Pedido mínimo (₡)" type="number" min={0} value={v.min} onChange={(e) => setV({ ...v, min: e.target.value })} />
          </div>
        )}
      </fieldset>
      {mode === "platform" && <Toggle label="Visible en el directorio" checked={v.directory} onChange={(directory) => setV({ ...v, directory })} />}
      {msg && <Notice tone={msg.tone === "success" ? "success" : "danger"} title={msg.tone === "success" ? "Listo" : "No se pudo guardar"}>{msg.text}</Notice>}
      <div><Button loading={busy} disabled={!v.dine_in && !v.pickup && !v.delivery} onClick={save}>Guardar cambios</Button></div>
    </div>
  );
}

export function NewVenueForm({ organizations }: { organizations: { id: string; name: string }[] }) {
  const api = usePlatformApi();
  const [org, setOrg] = useState(organizations[0]?.id ?? "");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const [zone, setZone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ id: string; menuUrl: string } | null>(null);
  const valid = org && name.trim().length >= 2 && SLUG_PATTERN.test(slug);
  async function create() {
    setBusy(true);
    setError("");
    const r = await api.command<{ venue_id: string; menu_path: string }>({ command: "venue_create", organizationId: org, venue: { name, slug, zone } });
    setBusy(false);
    if (r.ok) setDone({ id: r.result.venue_id, menuUrl: r.result.menu_path });
    else setError(r.message);
  }
  if (done)
    return (
      <div className={styles.stack}>
        <Notice tone="success" title="Establecimiento creado">Quedó en borrador. Publíquelo cuando esté listo.</Notice>
        <a className="btn" href={`/admin/establecimientos/${done.id}`}>Ver el establecimiento</a>
      </div>
    );
  return (
    <div className={styles.stack}>
      <div className={styles.form}>
        <label className="field"><span>Empresa</span>
          <select value={org} onChange={(e) => setOrg(e.target.value)}>{organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        </label>
        <TextField label="Nombre del establecimiento" value={name} onChange={(e) => { setName(e.target.value); if (!touched) setSlug(slugify(e.target.value)); }} />
        <TextField label="Enlace del menú" value={slug} onChange={(e) => { setSlug(e.target.value.toLowerCase()); setTouched(true); }} hint={`/v/${slug || "…"}`} />
        <TextField label="Zona" value={zone} onChange={(e) => setZone(e.target.value)} />
      </div>
      {error && <Notice tone="danger" title="No se pudo crear">{error}</Notice>}
      <div><Button loading={busy} disabled={!valid} onClick={create}>Crear establecimiento</Button></div>
    </div>
  );
}
