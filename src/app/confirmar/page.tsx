import { ResendConfirmation } from "@/features/account/components/simple-forms";
import { safeNext } from "@/lib/access-policy";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const { email = "", next } = await searchParams;
  return (
    <div className="page narrow auth-page">
      <h1>Revisá tu correo</h1>
      <p className="muted">
        Te enviamos un enlace de confirmación
        {email ? (
          <>
            {" "}
            a <strong>{email}</strong>
          </>
        ) : (
          ""
        )}
        . Al abrirlo seguís con tu perfil.
      </p>
      <div className="stack tight">
        <ResendConfirmation email={email} next={safeNext(next)} />
      </div>
    </div>
  );
}
