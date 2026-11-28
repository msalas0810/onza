import Link from "next/link";
import type { ReactNode } from "react";
import { PlatformApiProvider } from "./platform-api";
import styles from "./platform.module.css";

const NAV = [
  { id: "resumen", href: "/admin", label: "Resumen" },
  { id: "empresas", href: "/admin/empresas", label: "Empresas" },
  { id: "establecimientos", href: "/admin/establecimientos", label: "Establecimientos" },
  { id: "usuarios", href: "/admin/usuarios", label: "Usuarios" },
  { id: "auditoria", href: "/admin/auditoria", label: "Auditoría" },
  { id: "seguridad", href: "/admin/seguridad", label: "Seguridad" },
] as const;
export type PlatformSection = (typeof NAV)[number]["id"];

/** Marco del panel de plataforma (solo lo ven páginas que ya pasaron la comprobación del operador). */
export function PlatformShell({ active, email, children }: { active: PlatformSection; email?: string; children: ReactNode }) {
  return (
    <PlatformApiProvider>
      <div className={styles.shell}>
        <aside className={styles.side}>
          <h1>Onza · Plataforma</h1>
          {email && <p className={styles.muted}>{email}</p>}
          <nav className={styles.nav} aria-label="Panel de plataforma">
            {NAV.map((item) => (
              <Link key={item.id} href={item.href} aria-current={item.id === active ? "page" : undefined}>
                {item.label}
              </Link>
            ))}
          </nav>
          <Link className="btn" href="/admin/nueva-empresa">Nueva empresa</Link>
        </aside>
        <main className={styles.main}>{children}</main>
      </div>
    </PlatformApiProvider>
  );
}
