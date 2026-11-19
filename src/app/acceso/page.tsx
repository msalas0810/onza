import Link from "next/link";
import { AuthForm } from "@/features/account/components/auth-form";
import { safeNext } from "@/lib/access-policy";
import { AccessScreen } from "./access-screen";
import styles from "./access.module.css";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const destination = safeNext(next);
  return (
    <AccessScreen>
      <div className={styles.content}>
        <section className={styles.hero} aria-labelledby="access-title">
          <div className={styles.brand} role="img" aria-label="Onza">
            <span className={styles.shot} />
            <span className={styles.signature}>
              <span className={styles.wordmark} />
            </span>
          </div>
          <h1 id="access-title" className={styles.title}>
            Tu próxima ronda.
            <br />
            Sin perderte la noche.
          </h1>
          <p className={styles.subtitle}>
            Pedí tus tragos. Recogé en la barra.
          </p>
        </section>
        <div className={styles.actions}>
          <AuthForm
            next={destination}
            notice={
              error
                ? "El enlace venció o ya se usó. Intentá de nuevo."
                : undefined
            }
          />
          <p className={styles.legal}>
            Al continuar aceptás las <Link href="/policies">condiciones</Link> y
            la <Link href="/policies">política de privacidad</Link>.
            <br />
            Solo mayores de 18 años.
          </p>
          <p className={styles.staff}>
            <Link href="/equipo/acceso">
              ¿Sos personal?
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M4 12h15m-6-6 6 6-6 6" />
              </svg>
            </Link>
          </p>
        </div>
      </div>
    </AccessScreen>
  );
}
