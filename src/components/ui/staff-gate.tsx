import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfigurationState } from "./configuration-state";
import { EmptyState, buttonClass } from "./primitives";
import type { StaffContext } from "@/features/team/server/staff-context";

/**
 * Traduce un acceso fallido a la pantalla correcta: sin sesión → volver a entrar con el destino; clave temporal → cambiarla;
 * sin permiso → estado claro con salida al selector de locales. Devuelve null cuando el acceso es válido.
 */
export function staffGate(context: StaffContext, next: string) {
  if (context.ok) return null;
  if (context.reason === "login")
    redirect(`/equipo/acceso?next=${encodeURIComponent(next)}`);
  if (context.reason === "password") redirect("/equipo/clave");
  if (context.reason === "error")
    return (
      <div className="page operations">
        <ConfigurationState error={context.error} />
      </div>
    );
  return (
    <div className="page narrow">
      <EmptyState
        title="Ya no tenés acceso a este local"
        action={
          <Link className={buttonClass({ variant: "secondary" })} href="/equipo/locales">
            Ver mis locales
          </Link>
        }
      >
        Si es un error, pedile al administrador del local que te dé acceso.
      </EmptyState>
    </div>
  );
}
