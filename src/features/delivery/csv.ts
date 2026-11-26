/**
 * CSV para abrir en una planilla. Escapa comillas y saltos de línea y neutraliza las celdas que una planilla leería como
 * fórmula (= + - @), porque los nombres de lugares y de productos los escriben personas.
 */
export function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
export function toCsv(
  columns: readonly { key: string; label: string }[],
  rows: readonly Record<string, unknown>[],
) {
  const lines = [
    columns.map((c) => csvCell(c.label)).join(","),
    ...rows.map((row) => columns.map((c) => csvCell(row[c.key])).join(",")),
  ];
  // BOM para que Excel respete las tildes.
  return `﻿${lines.join("\r\n")}\r\n`;
}
