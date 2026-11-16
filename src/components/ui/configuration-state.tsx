import { ErrorState } from "./primitives";
import { errorMessage } from "@/lib/errors";
export function ConfigurationState({ error }: { error: unknown }) {
  return (
    <ErrorState message={errorMessage(error)}>
      <p className="muted">
        Volvé a intentarlo en unos minutos. Si ya enviaste un pedido, consultá
        su estado antes de crear otro.
      </p>
    </ErrorState>
  );
}
