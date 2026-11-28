import { safeNext } from "@/lib/access-policy";
import { PortalLogin } from "@/features/platform/components/portal-login";

export const dynamic = "force-dynamic";
export const metadata = { title: "Acceso de empresa" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeNext(next, "/panel");
  return <PortalLogin mode="company" next={target.startsWith("/panel") ? target : "/panel"} />;
}
