import { ErrorState } from "./primitives";
import { errorMessage } from "@/lib/errors";
export function ConfigurationState({ error }: { error: unknown }) {
  return (
    <ErrorState message={errorMessage(error)}>
      <p className="muted">
        Los pedidos, pagos y permisos se guardan en Supabase. No hay un modo
        local que simule esa conexión.
      </p>
    </ErrorState>
  );
}
