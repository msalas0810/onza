import { safeNext } from "@/lib/access-policy";
import { PortalLogin } from "@/features/platform/components/portal-login";

export const dynamic = "force-dynamic";
export const metadata = { title: "Acceso de plataforma" };

/** Única página visible del panel sin ser operador: solo un formulario, sin pistas sobre quién puede entrar. */
export default async function Page({ searchParams }: { searchParams: Promise<{ motivo?: string; next?: string }> }) {
  const { motivo, next } = await searchParams;
  const target = safeNext(next, "/admin");
  return (
    <PortalLoginGate
      notice={motivo === "sesion" ? "Su sesión terminó. Inicie sesión de nuevo." : undefined}
      next={target.startsWith("/admin") ? target : "/admin"}
    />
  );
}

function PortalLoginGate({ notice, next }: { notice?: string; next: string }) {
  return <PortalLogin mode="operator" next={next} notice={notice} />;
}
