import Link from "next/link";
import { requirePlatformPage } from "@/lib/platform/page-guard";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { UsersTable } from "@/features/platform/components/users-table";
import type { UserRow } from "@/features/platform/types";
import styles from "@/features/platform/components/platform.module.css";

export const dynamic = "force-dynamic";
const KINDS = [["members", "Miembros de empresas"], ["consumers", "Consumidores"], ["operators", "Operadores"]] as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ tipo?: string; q?: string }> }) {
  const { tipo, q } = await searchParams;
  const kind = KINDS.find(([k]) => k === tipo)?.[0] ?? "members";
  const { db, email } = await requirePlatformPage("/admin/usuarios");
  const { data, error } = await db.rpc("platform_users_list", { input: { kind, q: q ?? "" } });
  if (error) throw new Error(error.message);
  const list = data as unknown as { items: UserRow[] };
  return (
    <PlatformShell active="usuarios" email={email}>
      <h1>Usuarios</h1>
      <nav className="chips" aria-label="Tipo de usuario">
        {KINDS.map(([k, label]) => <Link key={k} className="chip" href={`/admin/usuarios?tipo=${k}`} aria-current={k === kind}>{label}</Link>)}
      </nav>
      {kind !== "operators" && (
        <form className={styles.filters} method="get" role="search">
          <input type="hidden" name="tipo" value={kind} />
          <label className="field"><span>Buscar por correo</span><input name="q" defaultValue={q ?? ""} maxLength={100} /></label>
          <button className="btn secondary" type="submit">Buscar</button>
        </form>
      )}
      {kind === "operators" && <p className={styles.muted}>Hay un solo operador permanente. Agregar otro se hace con un script de operación, no desde esta pantalla.</p>}
      <UsersTable kind={kind} items={list.items} />
    </PlatformShell>
  );
}
