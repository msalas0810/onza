"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

/** Hoja: abajo en móvil, centrada desde 720 px. Base de confirmaciones, formularios cortos y sesión vencida. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  actions,
  dismissible = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  /** Falso para la sesión vencida: no se cierra con Escape ni tocando fuera. */
  dismissible?: boolean;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => (dismissible || next) && onOpenChange(next)}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content
          className="sheet"
          onEscapeKeyDown={(e) => !dismissible && e.preventDefault()}
          onPointerDownOutside={(e) => !dismissible && e.preventDefault()}
          onInteractOutside={(e) => !dismissible && e.preventDefault()}
          aria-describedby={description ? undefined : undefined}
        >
          <div className="grabber" aria-hidden="true" />
          <div className="sheet-head">
            <div className="grow">
              <Dialog.Title asChild>
                <h2>{title}</h2>
              </Dialog.Title>
              {description ? (
                <Dialog.Description asChild>
                  <p className="muted t-label" style={{ marginTop: 4 }}>
                    {description}
                  </p>
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">
                  {title}
                </Dialog.Description>
              )}
            </div>
            {dismissible && (
              <Dialog.Close asChild>
                <button type="button" className="icon-btn" aria-label="Cerrar">
                  <X size={20} aria-hidden="true" />
                </button>
              </Dialog.Close>
            )}
          </div>
          {children}
          {actions && <div className="actions">{actions}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
