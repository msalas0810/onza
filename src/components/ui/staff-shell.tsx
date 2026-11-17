import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark, buttonClass } from "./primitives";
import { ConnectionBanner } from "./connection-banner";
import { LogoutButton } from "@/features/account/components/account-actions";
import { roleLabel, type StaffPerson } from "@/features/team/server/staff-context";

/**
 * Marco del portal del equipo: ningún enlace de acá lleva al área de clientes. Muestra el local, la persona y su rol, y
 * un aviso persistente cuando el dispositivo pierde la conexión.
 */
export function StaffShell({
  venue,
  person,
  canSwitch = false,
  wide = true,
  children,
}: {
  venue?: { id: string; name: string };
  person: StaffPerson;
  canSwitch?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <header className="shdr">
        <Link
          className="brand"
          href={canSwitch || !venue ? "/equipo/locales" : `/staff/${venue.id}`}
          aria-label="Onza, equipo"
        >
          <BrandMark />
          <span className="eyebrow">Equipo</span>
        </Link>
        <span className="sep" aria-hidden="true" />
        <div className="who">
          <strong>{venue?.name ?? person.name}</strong>
          <span>
            {venue
              ? `${person.name} · ${roleLabel(person.role)}`
              : (person.email ?? roleLabel(person.role))}
          </span>
        </div>
        <span className="grow" />
        {canSwitch && venue && (
          <Link
            className={buttonClass({ variant: "quiet", size: "sm", className: "wide-only" })}
            href="/equipo/locales"
          >
            Cambiar de local
          </Link>
        )}
        <LogoutButton to="/equipo/acceso" label="Salir" compact />
      </header>
      <ConnectionBanner message="Sin conexión. Las acciones quedan en pausa hasta reconectar; nada se envía a ciegas." />
      <div className={`page ${wide ? "operations" : "narrow"}`}>{children}</div>
    </>
  );
}
