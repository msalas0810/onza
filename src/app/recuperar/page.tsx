import { RecoverForm } from "@/features/account/components/simple-forms";
import { AccessFrame } from "@/components/ui/access-frame";

export default function Page() {
  return (
    <AccessFrame
      title="Recuperá tu contraseña"
      subtitle="Te enviamos un enlace a tu correo para crear una nueva."
    >
      <RecoverForm />
    </AccessFrame>
  );
}
