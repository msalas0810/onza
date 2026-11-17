import type { ReactNode } from "react";
import styles from "@/app/acceso/access.module.css";

/**
 * Marco oscuro de las pantallas de acceso secundarias (confirmar, recuperar, restablecer, equipo). Comparte el lenguaje de
 * /acceso sin repetir su fondo animado: el movimiento queda en la entrada principal.
 */
export function AccessFrame({
  title,
  subtitle,
  eyebrow,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <div className={`access-screen ${styles.screen} ${styles.compact}`}>
      <section className={styles.hero} aria-labelledby="access-title">
        <div className={styles.brand} role="img" aria-label="Onza">
          <span className={styles.shot} />
          <span className={styles.signature}>
            <span className={styles.wordmark} />
            <span className={styles.dot} />
          </span>
        </div>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 id="access-title" className={styles.title}>
          {title}
        </h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </section>
      <div className={styles.actions}>{children}</div>
    </div>
  );
}
