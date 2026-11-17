import { OnboardingForm } from "@/features/account/components/onboarding-form";
import { safeNext } from "@/lib/access-policy";
import { serverDb } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const db = await serverDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  const meta = user?.user_metadata as
    { full_name?: string; name?: string } | undefined;
  return (
    <div className="page narrow auth-page">
      <h1>Completá tu perfil</h1>
      <OnboardingForm
        next={safeNext(next)}
        defaultName={meta?.full_name ?? meta?.name ?? ""}
      />
    </div>
  );
}
