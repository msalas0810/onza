"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, TextField } from "@/components/ui/primitives";
import type { Venue } from "@/features/catalog/server/queries";
export function PlatformPanel({ venues }: { venues: Venue[] }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const submit = async (input: Record<string, unknown>) => {
    setBusy(true);
    try {
      const response = await fetch("/api/platform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message);
      setMessage("Configuración guardada.");
      router.refresh();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "No se guardó la configuración.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <h1>Configuración de Onza</h1>
      <p className="muted">
        Acceso global explícito. Las operaciones de configuración quedan
        auditadas en el servidor.
      </p>
      <div className="stack">
        {venues.map((v) => (
          <Link key={v.id} className="venue-link" href={`/admin/${v.id}`}>
            {v.name} · Administrar →
          </Link>
        ))}
      </div>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void submit({
            action: "venue_create",
            name: f.get("name"),
            slug: f.get("slug"),
            zone: f.get("zone"),
          });
        }}
      >
        <h2>Crear local ficticio</h2>
        <TextField name="name" label="Nombre" required />
        <TextField
          name="slug"
          label="Slug único"
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          required
        />
        <TextField name="zone" label="Zona" />
        <Button loading={busy}>Crear local</Button>
      </form>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void submit({
            action: "membership_save",
            venueId: f.get("venue"),
            userId: f.get("user"),
            role: f.get("role"),
          });
        }}
      >
        <h2>Asignar personal existente</h2>
        <p className="muted">
          Creá la cuenta permanente en Supabase Auth y pegá su UUID. Este
          formulario no crea identidades ni envía invitaciones.
        </p>
        <label className="field">
          Local
          <select name="venue">
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <TextField name="user" label="UUID del usuario" required />
        <label className="field">
          Permiso
          <select name="role">
            <option value="bartender">Barra</option>
            <option value="admin">Administrador del local</option>
          </select>
        </label>
        <Button loading={busy}>Asignar permiso</Button>
      </form>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </>
  );
}
