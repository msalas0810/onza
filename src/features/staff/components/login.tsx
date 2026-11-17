"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { browserDb } from "@/lib/supabase/browser";
import { Button, TextField } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/errors";
type Membership = { venue_id: string; role: string };
export function StaffLogin() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const db = browserDb();
        const { data } = await db.from("memberships").select("venue_id,role");
        if (active) setMemberships(data ?? []);
      } catch {
        /* Display configuration error after an explicit login attempt. */
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      <p className="muted">
        Las cuentas del equipo las crea el administrador de tu local.
      </p>
      <form
        className="stack"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            const db = browserDb();
            const { error } = await db.auth.signInWithPassword({
              email,
              password,
            });
            if (error)
              throw new Error(
                error.name === "AuthRetryableFetchError" ||
                  (error.status && error.status >= 500)
                  ? "CONNECTION_ERROR"
                  : "Correo o contraseña incorrectos.",
              );
            const { data, error: membershipError } = await db
              .from("memberships")
              .select("venue_id,role");
            if (membershipError) throw membershipError;
            if (!data?.length)
              throw new Error("La cuenta no tiene un local asignado.");
            setMemberships(data);
            router.refresh();
          } catch (e) {
            setError(
              e instanceof Error &&
                /SUPABASE_NOT_CONFIGURED|CONNECTION_ERROR/.test(e.message)
                ? errorMessage(e)
                : e instanceof Error
                  ? e.message
                  : "No pudimos iniciar sesión.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <TextField
          label="Correo del personal"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" loading={busy}>
          Iniciar sesión
        </Button>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
      </form>
      {memberships.length > 0 && (
        <section className="stack">
          <h2>Tus espacios de trabajo</h2>
          {memberships.some((m) => m.role === "onza") && (
            <Link className="button secondary" href="/onza">
              Configuración global Onza
            </Link>
          )}
          {memberships.map((m) => (
            <div key={m.venue_id} className="stack">
              <Link className="button primary" href={`/staff/${m.venue_id}`}>
                Abrir barra
              </Link>
              {["admin", "onza"].includes(m.role) && (
                <Link
                  className="button secondary"
                  href={`/admin/${m.venue_id}`}
                >
                  Administrar local
                </Link>
              )}
            </div>
          ))}
          <Button
            variant="quiet"
            onClick={async () => {
              await browserDb().auth.signOut();
              setMemberships([]);
              router.refresh();
            }}
          >
            Cerrar sesión
          </Button>
        </section>
      )}
    </>
  );
}
