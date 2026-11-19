const clockFormat = new Intl.DateTimeFormat("es-CR", {
  timeZone: "America/Costa_Rica",
  hour: "numeric",
  minute: "2-digit",
});
/**
 * Hora de Costa Rica en formato «11:00 p.m.»: un espacio antes del sufijo y ninguno dentro de «a.m.»/«p.m.»
 * (Intl devuelve «a. m.» con espacios finos según el motor).
 */
export function formatClock(value: string | number | Date) {
  return clockFormat
    .format(new Date(value))
    .replace(/(\d)\s*([ap])\.\s*m\./i, (_, digit: string, half: string) => `${digit} ${half.toLowerCase()}.m.`);
}
