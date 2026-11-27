import type { Order } from "@/features/orders/types";

/**
 * Umbrales de retraso en preparación (aviso y alerta), como el «warning / alert» de los sistemas de cocina.
 * shortcut: fijos para todos los locales; si un local los necesita distintos, pasarlos a la configuración del local.
 */
export const PREP_WARNING_MIN = 10;
export const PREP_ALERT_MIN = 15;

export const minutesSince = (iso: string, now: number) =>
  Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));

/** Pedidos en preparación que pasaron el aviso, y el tono según el más atrasado. Null si ninguno. */
export function slowPreparation(orders: readonly Order[], now: number) {
  const slow = orders.filter(
    (o) => o.status === "preparing" && minutesSince(o.preparing_at ?? o.created_at, now) >= PREP_WARNING_MIN,
  );
  if (!slow.length) return null;
  const worst = Math.max(...slow.map((o) => minutesSince(o.preparing_at ?? o.created_at, now)));
  return { count: slow.length, worst, tone: worst >= PREP_ALERT_MIN ? ("danger" as const) : ("warning" as const) };
}
