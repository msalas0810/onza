"use client";
import { useEffect, useState } from "react";
import { Armchair } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useVenueMaps, writeTableContext } from "../use-maps";
import styles from "./maps.module.css";

/**
 * Aviso del menú cuando el cliente llegó por el QR de una mesa (`/v/<local>?mesa=<id>`). Guarda la mesa en este dispositivo
 * para que el checkout no pida abrir el plano. Si el plano vigente no tiene esa mesa, no se guarda nada.
 */
export function TableContextBanner({
  venueId,
  tableId,
}: {
  venueId: string;
  tableId: string;
}) {
  const maps = useVenueMaps(venueId);
  const [dismissed, setDismissed] = useState(false);
  const table =
    maps.status === "ready"
      ? maps.data
          .flatMap((m) => m.layout.elements)
          .find((e) => e.id === tableId && e.type === "table")
      : undefined;
  // Sin sesión todavía no se puede verificar la mesa: se guarda igual y el servidor la valida al pedir.
  const unverified = maps.status === "unavailable" || maps.status === "error";
  useEffect(() => {
    if (maps.status === "loading" || dismissed) return;
    writeTableContext(venueId, table || unverified ? tableId : null);
  }, [maps.status, table, unverified, dismissed, venueId, tableId]);
  if (dismissed || maps.status === "loading" || (!table && !unverified))
    return null;
  return (
    <div
      className={`${styles.card} ${styles.cardRow}`}
      role="status"
      data-testid="table-banner"
    >
      <Armchair size={20} aria-hidden="true" />
      <div className="grow">
        <strong>
          {table ? `Estás en la ${table.label}` : "Guardamos tu mesa"}
        </strong>
        <div className="muted t-label">
          {table
            ? "Te llevamos el pedido ahí. No hace falta marcar nada en el plano."
            : "La confirmamos al hacer el pedido."}
        </div>
      </div>
      <Button
        variant="quiet"
        size="sm"
        onClick={() => {
          writeTableContext(venueId, null);
          setDismissed(true);
        }}
      >
        No es mi mesa
      </Button>
    </div>
  );
}
