import type { Json } from "@/lib/supabase/database.generated";
import { RARITIES, SLOTS } from "../types";

/** Importador CSV del catálogo de artículos. Solo metadatos y referencias a archivos: los gráficos se suben aparte. */
export const CATALOG_COLUMNS = [
  "sku",
  "name",
  "category",
  "price_coins",
  "rarity",
  "status",
  "season",
  "exclusive",
  "min_level",
  "available_from",
  "available_until",
  "compat",
  "asset_ref",
  "preview_ref",
  "sort",
] as const;
export type CatalogColumn = (typeof CATALOG_COLUMNS)[number];

export const MAX_CSV_BYTES = 2_000_000;
export const MAX_CSV_ROWS = 5000;

export type CsvRowError = { line: number; sku?: string; message: string };
export type ParsedCatalogCsv = {
  columns: string[];
  rows: Record<string, Json>[];
  /** Línea del archivo (con el encabezado como línea 1) de cada fila de `rows`. */
  lines: number[];
  errors: CsvRowError[];
};

const STATUSES = ["draft", "active", "retired"];
// Columnas que, vacías, borran el valor. Las demás, vacías, conservan el valor actual (o usan el predeterminado al crear).
const CLEARABLE: CatalogColumn[] = ["season", "available_from", "available_until", "asset_ref", "preview_ref"];

/** Lee CSV con comillas, comas y saltos de línea dentro de comillas. Devuelve filas de celdas con su línea de inicio. */
function readCells(text: string, delimiter: string) {
  const records: { cells: string[]; line: number }[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let start = 1;
  const endCell = () => {
    cells.push(cell);
    cell = "";
  };
  const endRecord = () => {
    endCell();
    if (cells.some((c) => c.trim() !== "")) records.push({ cells, line: start });
    cells = [];
    start = line + 1;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else {
        if (ch === "\n") line++;
        cell += ch;
      }
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) endCell();
    else if (ch === "\r") continue;
    else if (ch === "\n") {
      endRecord();
      line++;
      start = line;
    } else cell += ch;
  }
  if (cell !== "" || cells.length) endRecord();
  return records;
}

const parseBool = (v: string) => {
  const s = v.toLowerCase();
  if (["true", "1", "si", "sí", "yes", "x"].includes(s)) return true;
  if (["false", "0", "no"].includes(s)) return false;
  return undefined;
};

const REF = /^(https:\/\/\S+|[A-Za-z0-9_./-]+)$/;

/** Valida una referencia a un archivo gráfico: ruta relativa o URL https, sin `..` ni esquemas peligrosos. */
export function validRef(value: string) {
  return value.length <= 500 && REF.test(value) && !value.includes("..");
}

export function parseCatalogCsv(input: string): ParsedCatalogCsv {
  const fail = (message: string): ParsedCatalogCsv => ({
    columns: [],
    rows: [],
    lines: [],
    errors: [{ line: 1, message }],
  });
  if (input.length > MAX_CSV_BYTES) return fail("El archivo supera los 2 MB.");
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split("\n", 1)[0] ?? "";
  // Excel en español exporta con punto y coma.
  const delimiter = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
  const records = readCells(text, delimiter);
  if (records.length === 0) return fail("El archivo está vacío.");
  const header = records[0].cells.map((c) => c.trim().toLowerCase());
  const unknown = header.filter((c) => c && !CATALOG_COLUMNS.includes(c as CatalogColumn));
  if (unknown.length) return fail(`Columnas desconocidas: ${unknown.join(", ")}. Revisá la plantilla.`);
  if (new Set(header).size !== header.length) return fail("Hay columnas repetidas en el encabezado.");
  if (!header.includes("sku")) return fail("Falta la columna «sku».");
  if (records.length - 1 > MAX_CSV_ROWS) return fail(`El archivo supera ${MAX_CSV_ROWS} filas.`);

  const out: ParsedCatalogCsv = { columns: header, rows: [], lines: [], errors: [] };
  const seen = new Map<string, number>();
  for (const { cells, line } of records.slice(1)) {
    const row: Record<string, Json> = {};
    const errors: string[] = [];
    header.forEach((col, i) => {
      const value = (cells[i] ?? "").trim();
      if (value === "") {
        if (CLEARABLE.includes(col as CatalogColumn)) row[col] = null;
        return;
      }
      switch (col as CatalogColumn) {
        case "sku":
          if (!/^[A-Za-z0-9_.-]{2,64}$/.test(value)) errors.push("sku: usá 2 a 64 letras, números, punto, guion o guion bajo");
          else row.sku = value;
          break;
        case "name":
          if (value.length < 2 || value.length > 80) errors.push("name: entre 2 y 80 caracteres");
          else row.name = value;
          break;
        case "category":
          if (!(SLOTS as readonly string[]).includes(value.toLowerCase())) errors.push(`category: «${value}» no es una categoría válida`);
          else row.category = value.toLowerCase();
          break;
        case "rarity":
          if (!(RARITIES as readonly string[]).includes(value.toLowerCase())) errors.push(`rarity: «${value}» no es una rareza válida`);
          else row.rarity = value.toLowerCase();
          break;
        case "status":
          if (!STATUSES.includes(value.toLowerCase())) errors.push(`status: use ${STATUSES.join(", ")}`);
          else row.status = value.toLowerCase();
          break;
        case "price_coins":
        case "min_level":
        case "sort": {
          const n = Number(value);
          if (!Number.isInteger(n) || n < (col === "min_level" ? 1 : col === "sort" ? -100000 : 0) || n > 1_000_000)
            errors.push(`${col}: número entero inválido`);
          else row[col] = n;
          break;
        }
        case "exclusive": {
          const b = parseBool(value);
          if (b === undefined) errors.push("exclusive: use true/false o sí/no");
          else row.exclusive = b;
          break;
        }
        case "available_from":
        case "available_until":
          if (Number.isNaN(Date.parse(value))) errors.push(`${col}: fecha inválida (use AAAA-MM-DD o AAAA-MM-DDThh:mm:ssZ)`);
          else row[col] = new Date(value).toISOString();
          break;
        case "compat":
          try {
            const parsed: Json = JSON.parse(value);
            if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) errors.push("compat: debe ser un objeto JSON");
            else row.compat = parsed;
          } catch {
            errors.push("compat: JSON inválido");
          }
          break;
        case "asset_ref":
        case "preview_ref":
          if (!validRef(value)) errors.push(`${col}: use una ruta relativa o una URL https, sin «..»`);
          else row[col] = value;
          break;
        case "season":
          if (value.length > 40) errors.push("season: hasta 40 caracteres");
          else row.season = value;
          break;
      }
    });
    const sku = typeof row.sku === "string" ? row.sku : undefined;
    if (!sku && !errors.length) errors.push("sku: es obligatorio");
    if (sku && seen.has(sku)) errors.push(`sku «${sku}» repetido (ya aparece en la línea ${seen.get(sku)})`);
    if (errors.length) out.errors.push({ line, sku, message: errors.join("; ") });
    else {
      if (sku) seen.set(sku, line);
      out.rows.push(row);
      out.lines.push(line);
    }
  }
  if (out.rows.length === 0 && out.errors.length === 0) out.errors.push({ line: 1, message: "El archivo no trae filas de artículos." });
  return out;
}

/** Plantilla descargable: encabezado completo y filas de ejemplo (diseños provisionales). */
export function catalogCsvTemplate() {
  const header = CATALOG_COLUMNS.join(",");
  const rows = [
    ["gorra_roja_01", "Gorra roja", "hat", "40", "common", "active", "", "false", "1", "", "", "{}", "avatars/gorra-roja.png", "avatars/gorra-roja-preview.png", "10"],
    ["chaqueta_cuero_01", "Chaqueta de cuero", "jacket", "150", "epic", "active", "invierno", "false", "4", "", "", '{"conflicts":["top"]}', "avatars/chaqueta-cuero.png", "avatars/chaqueta-cuero-preview.png", "20"],
    ["sombrero_aniversario", "Sombrero de aniversario", "hat", "0", "legendary", "active", "aniversario", "true", "1", "", "", "{}", "https://cdn.ejemplo.com/avatars/aniversario.png", "", "99"],
  ];
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [header, ...rows.map((r) => r.map(esc).join(","))].join("\n") + "\n";
}
