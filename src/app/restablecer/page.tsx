import { ResetPasswordForm } from "@/features/account/components/simple-forms";
export default function Page() {
  return (
    <div className="page narrow auth-page">
      <h1>Nueva contraseña</h1>
      <ResetPasswordForm />
    </div>
  );
}
