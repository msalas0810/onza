import { businessDate } from "@/features/analytics/business-date";
/**
 * Noche operativa de Costa Rica (06:00 a 06:00), la misma que usa el panel: un pedido de las 23:45 y otro de las 00:30
 * de la misma salida quedan juntos.
 */
export function nightLabel(day: string, now = new Date()) {
  const today = businessDate(now);
  const yesterday = businessDate(new Date(now.getTime() - 24 * 3600 * 1000));
  if (day === today) return "Esta noche";
  if (day === yesterday) return "Anoche";
  const date = new Date(`${day}T12:00:00Z`);
  const label = new Intl.DateTimeFormat("es-CR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "short",
    ...(date.getUTCFullYear() !== now.getUTCFullYear() ? { year: "numeric" } : {}),
  })
    .format(date)
    .replace(/\.$/, "")
    .replace(",", "");
  return `Noche del ${label}`;
}
/** Agrupa por noche operativa conservando el orden recibido (más recientes primero). */
export function groupByNight<T extends { business_date: string }>(items: T[]) {
  const groups: { day: string; items: T[] }[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last?.day === item.business_date) last.items.push(item);
    else groups.push({ day: item.business_date, items: [item] });
  }
  return groups;
}
