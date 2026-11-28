import { AcceptInvitation } from "@/features/platform/components/accept-invitation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invitación a Onza", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <AcceptInvitation token={token} />;
}
