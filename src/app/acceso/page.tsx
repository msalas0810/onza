import Link from "next/link";
import { AuthForm } from "@/features/account/components/auth-form";
import { safeNext } from "@/lib/access-policy";
import { ParticleWave } from "@/components/backgrounds/particle-wave";
import styles from "./access.module.css";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const destination = safeNext(next);
  const venue = destination.match(/^\/v\/([\w-]+)/)?.[1];
  return (
    <div className={`access-screen ${styles.screen}`}>
      <section className={styles.hero} aria-labelledby="access-title">
        <div className={styles.wave} aria-hidden="true">
          <ParticleWave className={styles.canvas} />
        </div>
        <div className={styles.brand} role="img" aria-label="Onza">
          <span className={styles.shot} />
          <span className={styles.signature}>
            <span className={styles.wordmark} />
            <span className={styles.dot} />
          </span>
        </div>
        <h1 id="access-title" className={styles.title}>
          Tu próxima ronda.
          <br />
          Sin perderte la noche.
        </h1>
        <p className={styles.subtitle}>Pedí tus tragos. Recogé en la barra.</p>
      </section>
      <div className={styles.actions}>
        {venue && (
          <p className={styles.destination}>Vas a abrir el menú de un local</p>
        )}
        <AuthForm
          next={destination}
          notice={
            error
              ? "El enlace venció o ya se usó. Intentá de nuevo."
              : undefined
          }
        />
        <p className={styles.staff}>
          ¿Sos personal?{" "}
          <Link href="/equipo/acceso">
            Entrá por acá <span aria-hidden="true">↗</span>
          </Link>
        </p>
        <span className={styles.demo}>DEMO · sin dinero real</span>
      </div>
    </div>
  );
}
