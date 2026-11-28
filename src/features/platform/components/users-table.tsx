"use client";
import { useRouter } from "next/navigation";
import { usePlatformApi } from "./platform-api";
import { ConfirmAction } from "./common";
import { ROLE_LABELS, type OrgRole } from "../schemas";
import type { UserRow } from "../types";
import styles from "./platform.module.css";

export function UsersTable({ kind, items }: { kind: "members" | "consumers" | "operators"; items: UserRow[] }) {
  const api = usePlatformApi();
  const router = useRouter();
  const run = (action: "suspend" | "unsuspend" | "delete", userId: string) => async () => {
    const r = await api.command({ command: "user", action, userId });
    if (r.ok) router.refresh();
    return r.ok ? null : r.message;
  };
  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Correo</th>
            {kind === "members" && (<><th>Empresa</th><th>Rol</th><th>Estado</th></>)}
            {kind === "consumers" && (<><th>Usuario</th><th>Nombre</th></>)}
            {kind === "operators" && <th>Rol</th>}
            {kind !== "operators" && <th />}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && <tr><td colSpan={5} className={styles.muted}>Sin resultados.</td></tr>}
          {items.map((u, i) => (
            <tr key={u.user_id ?? `${u.email}-${i}`}>
              <td>{u.email}</td>
              {kind === "members" && (<><td>{u.organization}</td><td>{ROLE_LABELS[u.role as OrgRole] ?? u.role}</td><td>{u.status === "active" ? "Activo" : "Suspendido"}</td></>)}
              {kind === "consumers" && (<><td>@{u.username}</td><td>{u.name}</td></>)}
              {kind === "operators" && <td>Superadministrador</td>}
              {kind !== "operators" && u.user_id && (
                <td>
                  <div className={styles.actions}>
                    {kind === "members" && u.status === "active" && <ConfirmAction label="Suspender" title="Suspender a la persona" danger description="Pierde el acceso a la empresa y a sus locales hasta que usted la reactive." onConfirm={run("suspend", u.user_id)} />}
                    {kind === "members" && u.status !== "active" && <ConfirmAction label="Reactivar" title="Reactivar a la persona" description="Recupera su acceso." onConfirm={run("unsuspend", u.user_id)} />}
                    {kind === "consumers" && <ConfirmAction label="Suspender" title="Suspender al consumidor" danger description="No podrá iniciar sesión hasta que usted lo reactive." onConfirm={run("suspend", u.user_id)} />}
                    {kind === "consumers" && <ConfirmAction label="Reactivar" title="Reactivar al consumidor" description="Podrá volver a iniciar sesión." onConfirm={run("unsuspend", u.user_id)} />}
                    <ConfirmAction label="Eliminar" title="Eliminar la cuenta" danger requireText="ELIMINAR" description="Se borra la cuenta de acceso. No se puede deshacer." onConfirm={run("delete", u.user_id)} />
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
