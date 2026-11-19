import type { ReactNode } from "react";
import { AccessScreen } from "@/app/acceso/access-screen";
import styles from "@/app/acceso/access.module.css";

/** Compact layout for account and staff screens, with an optional access video. */
export function AccessFrame({
  title,
  subtitle,
  eyebrow,
  children,
  video = false,
}: {
  title: string;
  subtitle?: ReactNode;
  eyebrow?: string;
  children: ReactNode;
  video?: boolean;
}) {
  const content = (
    <>
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
    </>
  );
  return video ? (
    <AccessScreen compact>{content}</AccessScreen>
  ) : (
    <div className={`access-screen ${styles.screen} ${styles.compact}`}>
      {content}
    </div>
  );
}
