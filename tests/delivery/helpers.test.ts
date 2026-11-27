import { describe, it, expect } from "vitest";
import { groupSpots, placePhrase, spotText, yourSpot, offersBar, offersLocation, type Spot } from "@/features/delivery/types";
import { csvCell, toCsv } from "@/features/delivery/csv";

const spot = (label: string, area: string, position: number, enabled = true): Spot => ({
  id: label,
  venue_id: "v",
  label,
  area,
  position,
  enabled,
});

describe("lugares de entrega", () => {
  it("agrupa por zona respetando el orden de carga y deja los lugares sin zona primero", () => {
    const groups = groupSpots([
      spot("Mesa 10", "Jardín", 10),
      spot("Mesa 2", "Terraza", 2),
      spot("Barra alta", "", 3),
      spot("Mesa 1", "Terraza", 1),
    ]);
    expect(groups.map((g) => g.area)).toEqual(["", "Terraza", "Jardín"]);
    expect(groups[1].spots.map((s) => s.label)).toEqual(["Mesa 1", "Mesa 2"]);
  });
  it("ordena los nombres con números de forma natural cuando la posición empata", () => {
    const groups = groupSpots([spot("Mesa 10", "", 0), spot("Mesa 9", "", 0), spot("Mesa 100", "", 0)]);
    expect(groups[0].spots.map((s) => s.label)).toEqual(["Mesa 9", "Mesa 10", "Mesa 100"]);
  });
  it("describe el lugar con su zona y concuerda con la palabra del local", () => {
    expect(spotText({ spot_label: "Mesa 4", spot_area: "Terraza" })).toBe("Mesa 4 · Terraza");
    expect(spotText({ spot_label: "Mesa 4", spot_area: null })).toBe("Mesa 4");
    // Con preposición: nunca «a Punto en el mapa».
    expect(placePhrase({ spot_label: "Mesa 4", spot_area: "Terraza" }, "a")).toBe("a Mesa 4 · Terraza");
    expect(placePhrase({ spot_label: "Punto en el mapa", spot_area: "Jardín" }, "a")).toBe("al punto marcado · Jardín");
    expect(placePhrase({ spot_label: "Punto en el mapa", spot_area: null }, "en")).toBe("en el punto marcado");
    expect(spotText({ spot_label: null })).toBe("");
    expect(yourSpot("Zona")).toBe("tu zona");
    expect(yourSpot(" Puesto ")).toBe("tu puesto");
  });
  it("un local solo de barra no ofrece lugar; uno solo de lugar no ofrece barra", () => {
    expect([offersBar("bar"), offersBar("both"), offersBar("location")]).toEqual([true, true, false]);
    expect([offersLocation("bar"), offersLocation("both"), offersLocation("location")]).toEqual([false, true, true]);
  });
});

describe("exportación CSV", () => {
  it("escapa comillas, comas y saltos de línea", () => {
    expect(csvCell('Mesa "1", Terraza')).toBe('"Mesa ""1"", Terraza"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(12.5)).toBe("12.5");
  });
  it("neutraliza celdas que una planilla leería como fórmula", () => {
    for (const evil of ["=1+1", "+cmd", "-2+3", "@SUM(A1)"]) expect(csvCell(evil).startsWith("'")).toBe(true);
    expect(csvCell("Mesa -1")).toBe("Mesa -1");
  });
  it("incluye encabezados, BOM y fin de línea de planilla", () => {
    const csv = toCsv([{ key: "a", label: "Pedido" }, { key: "b", label: "Lugar" }], [{ a: "AB12CD", b: "Mesa 4" }]);
    expect(csv).toBe("﻿Pedido,Lugar\r\nAB12CD,Mesa 4\r\n");
  });
});
