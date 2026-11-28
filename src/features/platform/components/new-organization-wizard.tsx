"use client";
import { useMemo, useState } from "react";
import { Button, Notice, TextField, Toggle } from "@/components/ui/primitives";
import { COUNTRIES, isCountry, slugify, validatePhone, validateTaxId, SLUG_PATTERN, type Country } from "../validation";
import { usePlatformApi } from "./platform-api";
import { CopyField } from "./common";
import styles from "./platform.module.css";

const STEPS = ["Empresa", "Establecimiento", "Administrador", "Confirmación"] as const;
type Created = { organization_id: string; venue_id: string; menuUrl: string; qr: string; inviteUrl: string; expires_at: string };

/** Asistente de alta en 4 pasos. Crea empresa, local (en borrador) e invitación del propietario en una sola transacción. */
export function NewOrganizationWizard() {
  const api = usePlatformApi();
  const [step, setStep] = useState(0);
  const [org, setOrg] = useState({ name: "", slug: "", slugTouched: false, legal_name: "", tax_id: "", country: "CR" as string, contact_name: "", contact_email: "", contact_phone: "", plan: "free", is_demo: false, notes: "" });
  const [venue, setVenue] = useState({ name: "", slug: "", slugTouched: false, zone: "" });
  const [owner, setOwner] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created | null>(null);

  const country: Country = isCountry(org.country) ? org.country : "CR";
  const tax = useMemo(() => (org.tax_id ? validateTaxId(country, org.tax_id) : null), [org.tax_id, country]);
  const phone = useMemo(() => (org.contact_phone ? validatePhone(country, org.contact_phone) : null), [org.contact_phone, country]);
  const emailOk = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

  const errors: string[][] = [
    [
      org.name.trim().length < 2 ? "Escriba el nombre de la empresa." : "",
      !SLUG_PATTERN.test(org.slug) ? "El enlace usa minúsculas, números y guiones." : "",
      !org.tax_id ? "Ingrese el documento de identidad." : tax && !tax.ok ? tax.message : "",
      org.contact_phone && phone && !phone.ok ? phone.message : "",
      org.contact_email && !emailOk(org.contact_email) ? "El correo de contacto no es válido." : "",
    ].filter(Boolean),
    [venue.name.trim().length < 2 ? "Escriba el nombre del establecimiento." : "", !SLUG_PATTERN.test(venue.slug) ? "El enlace del menú usa minúsculas, números y guiones." : ""].filter(Boolean),
    [!emailOk(owner) ? "Escriba el correo de la persona administradora." : ""].filter(Boolean),
    [],
  ];

  async function create() {
    setBusy(true);
    setError("");
    const result = await api.command<Created>({
      command: "onboard",
      organization: {
        name: org.name, slug: org.slug, legal_name: org.legal_name, tax_id: org.tax_id, country: org.country, currency: COUNTRIES[country].currency,
        contact_name: org.contact_name || undefined, contact_email: org.contact_email, contact_phone: org.contact_phone, notes: org.notes, plan: org.plan, is_demo: org.is_demo,
      },
      venue: { name: venue.name, slug: venue.slug, zone: venue.zone },
      owner: { email: owner },
    });
    setBusy(false);
    if (result.ok) setCreated(result.result);
    else setError(result.message);
  }

  if (created)
    return (
      <div className={styles.stack}>
        <Notice tone="success" title="Empresa creada">La empresa y su establecimiento quedaron en borrador: nada se publica solo.</Notice>
        <CopyField label="Enlace del menú (se activa al publicar el establecimiento)" value={created.menuUrl} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.qr} src={created.qr} alt="Código QR del menú" />
        <CopyField label="Enlace de activación para el administrador (se muestra una sola vez)" value={created.inviteUrl} />
        <p className={styles.muted}>No hay servicio de correo propio: copie el enlace y entréguelo a la persona. Vence el {new Date(created.expires_at).toLocaleDateString("es-CR")}.</p>
        <div className={styles.actions}>
          <a className="btn" href={`/admin/empresas/${created.organization_id}`}>Ver la empresa</a>
          <a className="btn secondary" href={`/admin/establecimientos/${created.venue_id}`}>Ver el establecimiento</a>
        </div>
      </div>
    );

  return (
    <div className={styles.stack}>
      <ol className={styles.steps} aria-label="Pasos">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined}>{i + 1}. {label}</li>
        ))}
      </ol>

      {step === 0 && (
        <div className={styles.form}>
          <TextField label="Nombre comercial" value={org.name} maxLength={120} onChange={(e) => {
            const name = e.target.value;
            setOrg((o) => ({ ...o, name, slug: o.slugTouched ? o.slug : slugify(name) }));
            setVenue((v) => (v.name || v.slugTouched ? v : { ...v, slug: slugify(name) }));
          }} />
          <TextField label="Enlace de la empresa" value={org.slug} onChange={(e) => setOrg({ ...org, slug: e.target.value.toLowerCase(), slugTouched: true })} hint="Solo minúsculas, números y guiones." />
          <TextField label="Razón social" value={org.legal_name} maxLength={160} onChange={(e) => setOrg({ ...org, legal_name: e.target.value })} />
          <label className="field"><span>País</span>
            <select value={org.country} onChange={(e) => setOrg({ ...org, country: e.target.value })}>
              {Object.entries(COUNTRIES).map(([code, c]) => <option key={code} value={code}>{c.name}</option>)}
            </select>
          </label>
          <TextField label="Documento de identidad" value={org.tax_id} onChange={(e) => setOrg({ ...org, tax_id: e.target.value })}
            error={org.tax_id && tax && !tax.ok ? tax.message : undefined} hint={tax && tax.ok ? tax.label : "Cédula física o jurídica, DIMEX, RFC, NIT, etc. según el país."} />
          <TextField label="Nombre de contacto" value={org.contact_name} onChange={(e) => setOrg({ ...org, contact_name: e.target.value })} />
          <TextField label="Correo de contacto" type="email" value={org.contact_email} onChange={(e) => setOrg({ ...org, contact_email: e.target.value })} />
          <TextField label={`Teléfono de contacto (${COUNTRIES[country].dial})`} value={org.contact_phone} onChange={(e) => setOrg({ ...org, contact_phone: e.target.value })}
            error={org.contact_phone && phone && !phone.ok ? phone.message : undefined} />
          <label className="field"><span>Plan (sin cobros)</span>
            <select value={org.plan} onChange={(e) => setOrg({ ...org, plan: e.target.value })}>
              <option value="free">Gratis</option><option value="standard">Estándar</option><option value="premium">Premium</option>
            </select>
          </label>
          <Toggle label="Empresa de demostración" checked={org.is_demo} onChange={(is_demo) => setOrg({ ...org, is_demo })} />
        </div>
      )}
      {step === 1 && (
        <div className={styles.form}>
          <TextField label="Nombre del establecimiento" value={venue.name} maxLength={100} onChange={(e) => {
            const name = e.target.value;
            setVenue((v) => ({ ...v, name, slug: v.slugTouched ? v.slug : slugify(name) }));
          }} />
          <TextField label="Enlace del menú" value={venue.slug} onChange={(e) => setVenue({ ...venue, slug: e.target.value.toLowerCase(), slugTouched: true })} hint={`/v/${venue.slug || "…"}`} />
          <TextField label="Zona" value={venue.zone} maxLength={100} onChange={(e) => setVenue({ ...venue, zone: e.target.value })} />
        </div>
      )}
      {step === 2 && (
        <div className={styles.stack}>
          <TextField label="Correo de la persona administradora" type="email" value={owner} onChange={(e) => setOwner(e.target.value)} autoComplete="off" />
          <p className={styles.muted}>Recibirá un enlace de activación de un solo uso, válido por 7 días, y definirá su propia contraseña. Será la propietaria de la empresa.</p>
        </div>
      )}
      {step === 3 && (
        <dl className={styles.stack}>
          <div><dt className={styles.muted}>Empresa</dt><dd>{org.name} · /{org.slug} · {COUNTRIES[country].name} · {tax && tax.ok ? `${tax.label} ${tax.value}` : org.tax_id}{org.is_demo ? " · demostración" : ""}</dd></div>
          <div><dt className={styles.muted}>Establecimiento</dt><dd>{venue.name} · /v/{venue.slug} · {venue.zone || "sin zona"} · quedará en borrador</dd></div>
          <div><dt className={styles.muted}>Administrador</dt><dd>{owner} (propietario)</dd></div>
        </dl>
      )}

      {(errors[step].length > 0 || error) && (
        <div aria-live="polite">
          <Notice tone={error ? "danger" : "warning"} title={error ? "No se pudo crear" : "Revise este paso"}>{error || errors[step].join(" ")}</Notice>
        </div>
      )}
      <div className={styles.actions}>
        {step > 0 && <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>Atrás</Button>}
        {step < 3 ? (
          <Button
            type="button"
            disabled={errors[step].length > 0}
            onClick={() => {
              // Al pasar al establecimiento se propone el nombre de la empresa (suele ser el mismo local).
              if (step === 0) setVenue((v) => (v.name ? v : { ...v, name: org.name.trim(), slug: v.slugTouched ? v.slug : slugify(org.name) }));
              setStep(step + 1);
            }}
          >
            Siguiente
          </Button>
        ) : (
          <Button type="button" loading={busy} onClick={create}>Crear empresa</Button>
        )}
      </div>
    </div>
  );
}
