import { describe, it, expect } from "vitest";
import { CATALOG_COLUMNS, catalogCsvTemplate, parseCatalogCsv } from "@/features/game/csv/catalog-csv";

describe("importador CSV: lectura y validación", () => {
  it("la plantilla propia se lee sin errores", () => {
    const parsed = parseCatalogCsv(catalogCsvTemplate());
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.columns).toEqual([...CATALOG_COLUMNS]);
    expect(parsed.rows[1].compat).toEqual({ conflicts: ["top"] });
    expect(parsed.rows[2]).toMatchObject({ exclusive: true, price_coins: 0 });
  });

  it("solo envía las columnas presentes (una ausente conserva el valor actual)", () => {
    const parsed = parseCatalogCsv("sku,asset_ref\nprov_hat_01,avatars/a.png\n");
    expect(parsed.rows).toEqual([{ sku: "prov_hat_01", asset_ref: "avatars/a.png" }]);
  });

  it("una celda vacía borra los campos opcionales y conserva los obligatorios", () => {
    const parsed = parseCatalogCsv("sku,name,season,price_coins\nprov_hat_01,,,\n");
    expect(parsed.rows).toEqual([{ sku: "prov_hat_01", season: null }]);
  });

  it("acepta punto y coma, BOM, CRLF y comillas con comas y saltos de línea", () => {
    const csv = '﻿sku;name;category\r\nuno_hat;"Gorra, roja ""pro""";hat\r\ndos_hat;"Dos\nlíneas";HAT\r\n';
    const parsed = parseCatalogCsv(csv);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({ name: 'Gorra, roja "pro"', category: "hat" });
    expect(parsed.rows[1]).toMatchObject({ name: "Dos\nlíneas", category: "hat" });
    expect(parsed.lines).toEqual([2, 3]);
  });

  it("reporta cada fila inválida con su línea y deja pasar las buenas", () => {
    const parsed = parseCatalogCsv(
      [
        "sku,name,category,price_coins,rarity,exclusive,asset_ref,compat",
        "ok_1,Bueno,hat,10,rare,sí,avatars/a.png,{}",
        "../x,Malo,hat,10,,,,",
        "mal_cat,Malo,capa,10,,,,",
        "mal_n,Malo,hat,diez,,,,",
        "mal_rar,Malo,hat,10,mítico,,,",
        "mal_ref,Malo,hat,10,,,javascript:alert(1),",
        "mal_url,Malo,hat,10,,,http://x.test/a.png,",
        "mal_dots,Malo,hat,10,,,avatars/../a.png,",
        "mal_json,Malo,hat,10,,,,{no",
        "ok_2,Bueno,hat,5,,no,,",
      ].join("\n"),
    );
    expect(parsed.rows.map((r) => r.sku)).toEqual(["ok_1", "ok_2"]);
    expect(parsed.rows[0]).toMatchObject({ exclusive: true, rarity: "rare" });
    expect(parsed.errors.map((e) => e.line)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("detecta sku repetido dentro del archivo", () => {
    const parsed = parseCatalogCsv("sku,name\na1,Uno\na1,Dos\n");
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.errors[0].message).toMatch(/repetido/);
  });

  it("rechaza columnas desconocidas o repetidas, falta de sku, vacíos y exceso de tamaño o filas", () => {
    expect(parseCatalogCsv("sku,precio\na1,3\n").errors[0].message).toMatch(/desconocidas/);
    expect(parseCatalogCsv("sku,sku\na1,a1\n").errors[0].message).toMatch(/repetidas/);
    expect(parseCatalogCsv("name\nUno\n").errors[0].message).toMatch(/sku/);
    expect(parseCatalogCsv("").errors[0].message).toMatch(/vacío/);
    expect(parseCatalogCsv("sku\n").errors[0].message).toMatch(/no trae filas/);
    expect(parseCatalogCsv("sku\n" + "a".repeat(2_000_001)).errors[0].message).toMatch(/2 MB/);
    const many = "sku\n" + Array.from({ length: 5001 }, (_, i) => `s${String(i).padStart(5, "0")}`).join("\n");
    expect(parseCatalogCsv(many).errors[0].message).toMatch(/5000 filas/);
  });

  it("normaliza fechas y valida los rangos numéricos", () => {
    const ok = parseCatalogCsv("sku,available_from,min_level\na1,2026-12-01,3\n");
    expect(ok.rows[0]).toMatchObject({ available_from: "2026-12-01T00:00:00.000Z", min_level: 3 });
    expect(parseCatalogCsv("sku,min_level\na1,0\n").errors).toHaveLength(1);
    expect(parseCatalogCsv("sku,available_from\na1,ayer\n").errors).toHaveLength(1);
  });
});
