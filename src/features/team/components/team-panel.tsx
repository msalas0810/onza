"use client";
import { useCallback, useEffect, useState } from "react";
import { Copy, Plus } from "lucide-react";
import { z } from "zod";
import {
  Button,
  EmptyState,
  Notice,
  SegmentedControl,
  StatusBadge,
  TextField,
} from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { Users } from "lucide-react";

type Role = "bartender" | "admin";
const memberSchema = z.array(
  z.object({
    userId: z.string(),
    email: z.string().nullable(),
    name: z.string(),
    role: z.enum(["bartender", "admin", "onza"]),
    mustChangePassword: z.boolean(),
    self: z.boolean(),
  }),
);
type Member = z.infer<typeof memberSchema>[number];
const roleOptions = [
  { value: "bartender", label: "Empleado" },
  { value: "admin", label: "Administrador" },
] as const;
const label = (role: Member["role"]) =>
  role === "admin" ? "Administrador" : role === "onza" ? "Onza" : "Empleado";
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toLocaleUpperCase("es-CR");

async function call(input: Record<string, unknown>) {
  const response = await fetch("/api/team", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body: Record<string, unknown> = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(String(body.message ?? "No pudimos completar la acción."));
  return body;
}

/** Equipo del local: alta con contraseña temporal (se muestra una sola vez), cambio de permiso y retiro de acceso. */
export function TeamPanel({ venueId, venueName }: { venueId: string; venueName: string }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sheet, setSheet] = useState<
    | { type: "add" }
    | { type: "role"; member: Member }
    | { type: "revoke"; member: Member }
    | null
  >(null);
  const [form, setForm] = useState({ name: "", email: "", role: "bartender" as Role });
  const [formError, setFormError] = useState<{ name?: string; email?: string; form?: string }>({});
  const [newRole, setNewRole] = useState<Role>("bartender");
  const [created, setCreated] = useState<{ password: string | null; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/team?venue=${venueId}`, { cache: "no-store" });
      const body: unknown = await response.json();
      if (!response.ok)
        throw new Error(
          typeof body === "object" && body && "message" in body
            ? String((body as { message: unknown }).message)
            : "No pudimos cargar el equipo.",
        );
      setMembers(memberSchema.parse(body));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos cargar el equipo.");
    }
  }, [venueId]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const admins = members?.filter((m) => m.role === "admin" || m.role === "onza").length ?? 0;
  const close = () => {
    setSheet(null);
    setCreated(null);
    setCopied(false);
    setFormError({});
  };
  async function submitAdd(event: React.FormEvent) {
    event.preventDefault();
    const found: typeof formError = {};
    if (form.name.trim().length < 2) found.name = "Escribí el nombre de la persona.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()))
      found.email = "Escribí un correo válido.";
    setFormError(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const result = await call({
        action: "create",
        venueId,
        name: form.name,
        email: form.email,
        role: form.role,
      });
      setCreated({ password: (result.password as string | null) ?? null, name: form.name.trim() });
      setForm({ name: "", email: "", role: "bartender" });
      setNotice("");
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : "No pudimos crear la cuenta.";
      setFormError(/correo|cuenta personal/i.test(message) ? { email: message } : { form: message });
    } finally {
      setBusy(false);
    }
  }
  async function change(action: "role" | "revoke", member: Member) {
    setBusy(true);
    try {
      await call(
        action === "role"
          ? { action, venueId, userId: member.userId, role: newRole }
          : { action, venueId, userId: member.userId },
      );
      setNotice(
        action === "revoke"
          ? `${member.name} ya no tiene acceso a ${venueName}.`
          : `${member.name} ahora es ${label(newRole)}.`,
      );
      close();
      await load();
    } catch (e) {
      setFormError({ form: e instanceof Error ? e.message : "No pudimos completar la acción." });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="row between wrap" style={{ marginBottom: 16 }}>
        <div>
          <h2>Equipo</h2>
          <p className="muted t-label">
            Empleado opera la barra. Administrador además gestiona el local.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setForm({ name: "", email: "", role: "bartender" });
            setFormError({});
            setSheet({ type: "add" });
          }}
        >
          <Plus size={16} aria-hidden="true" />
          Agregar persona
        </Button>
      </div>
      {notice && (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="success">{notice}</Notice>
        </div>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
      {members && members.length === 0 && (
        <EmptyState icon={Users} title="Todavía no hay equipo">
          Agregá a la primera persona.
        </EmptyState>
      )}
      {!members && !error && <div className="sk" style={{ height: 160 }} aria-busy="true" />}
      {members && members.length > 0 && (
        <div className="rows">
          {members.map((m) => {
            const last = m.role === "admin" && admins <= 1;
            const locked = m.self || m.role === "onza";
            return (
              <div className="r wrap" key={m.userId}>
                <span className="mono" aria-hidden="true" style={{ width: 40, height: 40, fontSize: 14 }}>
                  {initials(m.name)}
                </span>
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>
                    {m.name}
                    {m.self && <span className="muted t-label" style={{ fontWeight: 400 }}> (vos)</span>}
                  </div>
                  <div className="sub">{m.email}</div>
                </div>
                <div className="row wrap" style={{ gap: 8 }}>
                  {m.mustChangePassword && <StatusBadge tone="warning">Clave temporal</StatusBadge>}
                  <StatusBadge plain>{label(m.role)}</StatusBadge>
                  <Button
                    variant="quiet"
                    size="sm"
                    disabled={locked}
                    title={m.self ? "No podés cambiar tu propio permiso" : undefined}
                    onClick={() => {
                      setNewRole(m.role === "admin" ? "admin" : "bartender");
                      setFormError({});
                      setSheet({ type: "role", member: m });
                    }}
                  >
                    Permiso
                  </Button>
                  <Button
                    variant="quiet"
                    size="sm"
                    disabled={locked || last}
                    title={
                      m.self
                        ? "No podés quitarte tu propio acceso"
                        : last
                          ? "El local necesita al menos un administrador"
                          : undefined
                    }
                    style={{ color: "var(--onza-danger-text)" }}
                    onClick={() => {
                      setFormError({});
                      setSheet({ type: "revoke", member: m });
                    }}
                  >
                    Quitar acceso
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Sheet
        open={sheet?.type === "add"}
        onOpenChange={(open) => !open && close()}
        title={created ? "Cuenta lista" : "Agregar persona"}
        description={
          created
            ? undefined
            : "Se crea la cuenta y se te muestra una contraseña temporal. No enviamos correo."
        }
        actions={
          created ? (
            <Button onClick={close}>Listo</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={close}>
                Cancelar
              </Button>
              <Button type="submit" form="add-member" loading={busy}>
                Crear cuenta
              </Button>
            </>
          )
        }
      >
        {created ? (
          created.password ? (
            <div className="stack">
              <p className="muted">
                Pasale esta contraseña temporal a {created.name} en mano. Se
                muestra una sola vez; al entrar va a tener que cambiarla.
              </p>
              <div className="secret" data-private="temporary-password">{created.password}</div>
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(created.password ?? "");
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                <Copy size={16} aria-hidden="true" />
                {copied ? "Copiada" : "Copiar contraseña"}
              </Button>
            </div>
          ) : (
            <p className="muted">
              {created.name} ya tenía cuenta del equipo. Ahora también accede a
              este local con su contraseña de siempre.
            </p>
          )
        ) : (
          <form id="add-member" className="stack" onSubmit={submitAdd} noValidate>
            <TextField
              label="Nombre"
              value={form.name}
              error={formError.name}
              autoComplete="off"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <TextField
              label="Correo del trabajo"
              type="email"
              value={form.email}
              error={formError.email}
              hint="Distinto de su correo personal."
              autoComplete="off"
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <div className="field">
              <span>Permiso</span>
              <SegmentedControl<Role>
                block
                label="Permiso"
                value={form.role}
                options={roleOptions}
                onChange={(role) => setForm({ ...form, role })}
              />
            </div>
            {formError.form && (
              <p role="alert" className="field-error">
                {formError.form}
              </p>
            )}
          </form>
        )}
      </Sheet>
      <Sheet
        open={sheet?.type === "role"}
        onOpenChange={(open) => !open && close()}
        title={sheet?.type === "role" ? `Permiso de ${sheet.member.name.split(" ")[0]}` : "Permiso"}
        description={`En ${venueName}.`}
        actions={
          <>
            <Button variant="secondary" onClick={close}>
              Cancelar
            </Button>
            <Button
              loading={busy}
              onClick={() => sheet?.type === "role" && void change("role", sheet.member)}
            >
              Guardar
            </Button>
          </>
        }
      >
        <SegmentedControl<Role>
          block
          label="Permiso"
          value={newRole}
          options={roleOptions}
          onChange={setNewRole}
        />
        {formError.form && (
          <p role="alert" className="field-error" style={{ marginTop: 12 }}>
            {formError.form}
          </p>
        )}
      </Sheet>
      <Sheet
        open={sheet?.type === "revoke"}
        onOpenChange={(open) => !open && close()}
        title={
          sheet?.type === "revoke"
            ? `¿Quitar el acceso de ${sheet.member.name.split(" ")[0]} a ${venueName}?`
            : "Quitar acceso"
        }
        description="Pierde el acceso a este local de inmediato: cualquier acción que intente después se rechaza. Sus otros locales no cambian."
        actions={
          <>
            <Button variant="secondary" onClick={close}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() => sheet?.type === "revoke" && void change("revoke", sheet.member)}
            >
              Quitar acceso
            </Button>
          </>
        }
      >
        {formError.form && (
          <p role="alert" className="field-error">
            {formError.form}
          </p>
        )}
      </Sheet>
    </>
  );
}
