import Link from "next/link";
import { AuthForm } from "@/features/account/components/auth-form";
import { safeNext } from "@/lib/access-policy";
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
    <div className="page narrow auth-page">
      {venue && <p className="badge-line">Vas a abrir el menú de un local</p>}
      <h1>Ingresá a Onza</h1>
      <AuthForm
        next={destination}
        notice={
          error ? "El enlace venció o ya se usó. Intentá de nuevo." : undefined
        }
      />
      <p className="muted center">
        ¿Sos personal? <Link href="/equipo/acceso">Acceso para el equipo</Link>
      </p>
    </div>
  );
}
