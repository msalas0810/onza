import { ResendConfirmation } from "@/features/account/components/simple-forms";
import { AccessFrame } from "@/components/ui/access-frame";
import { safeNext } from "@/lib/access-policy";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const { email = "", next } = await searchParams;
  return (
    <AccessFrame
      title="Revisá tu correo"
      subtitle={
        <>
          Te enviamos un enlace de confirmación
          {email ? (
            <>
              {" "}
              a <strong>{email}</strong>
            </>
          ) : (
            ""
          )}
          . Abrilo en este dispositivo para seguir.
        </>
      }
    >
      <div className="stack tight">
        <ResendConfirmation email={email} next={safeNext(next)} />
      </div>
    </AccessFrame>
  );
}
