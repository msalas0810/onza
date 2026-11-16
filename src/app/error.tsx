"use client";
import { Button, ErrorState } from "@/components/ui/primitives";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="page">
      <ErrorState message="No pudimos cargar esta pantalla. Tus pedidos confirmados siguen en el servidor.">
        <Button onClick={reset}>Volver a cargar</Button>
      </ErrorState>
    </div>
  );
}
