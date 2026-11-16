"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/primitives";
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
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="sheet">
          <Dialog.Title>Cambiar de local</Dialog.Title>
          <Dialog.Description>
            Tu carrito es de {currentVenueName}. Podés conservarlo o
            reemplazarlo para pedir en {venueName}.
          </Dialog.Description>
          <div className="stack">
            <Button onClick={onReplace}>Vaciar y cambiar de local</Button>
            <Dialog.Close asChild>
              <Button variant="secondary">Conservar mi carrito</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
