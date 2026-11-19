import { businessDate } from "./business-date";
export type PeriodKind = "day" | "week" | "month" | "year" | "range";
export type Period = { kind: PeriodKind; from: string; to: string };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (day: string) => new Date(`${day}T12:00:00Z`);
const addDays = (day: string, n: number) => {
  const d = utc(day);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
/** Período en noches operativas (06:00–06:00) que contiene la fecha ancla. Semana de lunes a domingo. */
export function periodFor(kind: Exclude<PeriodKind, "range">, anchor: string): Period {
  const d = utc(anchor);
  if (kind === "day") return { kind, from: anchor, to: anchor };
  if (kind === "week") {
    const offset = (d.getUTCDay() + 6) % 7;
    const from = addDays(anchor, -offset);
    return { kind, from, to: addDays(from, 6) };
  }
  if (kind === "month") {
    const from = iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12)));
    const to = iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)));
    return { kind, from, to };
  }
  return { kind, from: `${d.getUTCFullYear()}-01-01`, to: `${d.getUTCFullYear()}-12-31` };
}
export const tonight = (now = new Date()): Period => ({
  kind: "day",
  from: businessDate(now),
  to: businessDate(now),
});
const format = (day: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("es-CR", { timeZone: "UTC", ...options })
    .format(utc(day))
    .replace(/\.$/, "");
/** Texto del período para la cabecera del Resumen. */
export function periodLabel(period: Period, now = new Date()) {
  const today = businessDate(now);
  if (period.kind === "day")
    return period.from === today
      ? `Esta noche · ${format(period.from, { weekday: "short", day: "numeric", month: "short" })}`
      : `Noche del ${format(period.from, { weekday: "short", day: "numeric", month: "short" })}`;
  if (period.kind === "month") return format(period.from, { month: "long", year: "numeric" });
  if (period.kind === "year") return period.from.slice(0, 4);
  return `${format(period.from, { day: "numeric", month: "short" })} – ${format(period.to, { day: "numeric", month: "short", year: "numeric" })}`;
}
/** Buckets completos del período (con ceros) en el orden de la noche: 06 → 05 por hora; días o meses en orden. */
export function periodBuckets(grain: "hour" | "day" | "month", from: string, to: string) {
  if (grain === "hour")
    return Array.from({ length: 24 }, (_, i) => String((i + 6) % 24).padStart(2, "0"));
  if (grain === "day") {
    const out: string[] = [];
    for (let day = from; day <= to; day = addDays(day, 1)) out.push(day);
    return out;
  }
  const out: string[] = [];
  const start = utc(from);
  const end = utc(to);
  for (let y = start.getUTCFullYear(), m = start.getUTCMonth(); y < end.getUTCFullYear() || (y === end.getUTCFullYear() && m <= end.getUTCMonth()); m === 11 ? ((m = 0), y++) : m++)
    out.push(`${y}-${String(m + 1).padStart(2, "0")}`);
  return out;
}
