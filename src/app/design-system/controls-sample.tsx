"use client";
import { useState } from "react";
import { Bell, Inbox } from "lucide-react";
import {
  Button,
  EmptyState,
  Notice,
  QuantityStepper,
  SegmentedControl,
  StatusBadge,
  Toggle,
} from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";

type View = "system" | "light" | "dark";
/** Controles interactivos del sistema, con todos sus estados, para revisarlos juntos. */
export function ControlsSample() {
  const [qty, setQty] = useState(2);
  const [on, setOn] = useState(true);
  const [view, setView] = useState<View>("system");
  const [open, setOpen] = useState(false);
  return (
    <div className="stack">
      <div className="row wrap">
        <QuantityStepper value={qty} onChange={setQty} />
        <QuantityStepper value={1} onChange={() => undefined} />
        <QuantityStepper value={3} max={3} onChange={() => undefined} />
      </div>
      <Toggle label="Recibiendo pedidos" checked={on} onChange={setOn} />
      <Toggle
        label="No disponible"
        checked={false}
        disabled
        onChange={() => undefined}
      />
      <SegmentedControl<View>
        block
        label="Apariencia"
        value={view}
        onChange={setView}
        options={[
          { value: "system", label: "Sistema" },
          { value: "light", label: "Claro" },
          { value: "dark", label: "Oscuro" },
        ]}
      />
      <div className="row wrap">
        <StatusBadge tone="success">Abierto</StatusBadge>
        <StatusBadge tone="warning">Pausado</StatusBadge>
        <StatusBadge>Cerrado</StatusBadge>
        <StatusBadge tone="danger">Cancelado</StatusBadge>
        <StatusBadge tone="brand">Listo</StatusBadge>
      </div>
      <Notice tone="warning" title="Pedidos pausados">
        Podés armar tu ronda. Vas a poder pedir cuando el local reanude.
      </Notice>
      <Notice tone="danger" title="No se hizo el pedido">
        Un producto se agotó. Quitalo para seguir.
      </Notice>
      <Notice tone="success" title="Entregado">
        Gracias por pedir con Onza.
      </Notice>
      <div className="row wrap">
        <EmptyState icon={Inbox} title="Todavía no pediste">
          Tus pedidos y tickets aparecen acá.
        </EmptyState>
        <span className="anim-bell" style={{ color: "var(--onza-brand-text)" }}>
          <Bell size={24} aria-hidden="true" />
        </span>
      </div>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Abrir hoja
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="¿Cancelar #0427?"
        description="El local todavía no lo aceptó. Si lo acepta antes, ya no se puede cancelar."
        actions={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Volver
            </Button>
            <Button variant="danger" onClick={() => setOpen(false)}>
              Sí, cancelar pedido
            </Button>
          </>
        }
      />
    </div>
  );
}
