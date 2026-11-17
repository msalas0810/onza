import { ResetPasswordForm } from "@/features/account/components/simple-forms";
import { AccessFrame } from "@/components/ui/access-frame";

export default function Page() {
  return (
    <AccessFrame title="Nueva contraseña">
      <ResetPasswordForm />
    </AccessFrame>
  );
}
