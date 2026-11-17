"use client";
import { Button } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";

export default function VenueChangeDialog({
  venueName,
  currentVenueName,
  onOpenChange,
  onReplace,
}: {
  venueName: string;
  currentVenueName: string;
  onOpenChange: (open: boolean) => void;
  onReplace: () => void;
}) {
  return (
    <Sheet
      open
      onOpenChange={onOpenChange}
      title="¿Empezar un carrito nuevo?"
      description={`Tu carrito es de ${currentVenueName}. Un pedido es de un solo local: podés conservarlo o vaciarlo para pedir en ${venueName}.`}
      actions={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Conservar {currentVenueName}
          </Button>
          <Button onClick={onReplace}>Vaciar y agregar en {venueName}</Button>
        </>
      }
    />
  );
}
