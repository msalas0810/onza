import { RecoverForm } from "@/features/account/components/simple-forms";
export default function Page() {
  return (
    <div className="page narrow auth-page">
      <h1>Recuperá tu contraseña</h1>
      <p className="muted">
        Ingresá tu correo y te enviamos un enlace para crear una nueva.
      </p>
      <RecoverForm />
    </div>
  );
}
