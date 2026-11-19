import { describe, expect, it } from "vitest";
import { matchesQuery, suggestVenues } from "@/features/catalog/search";
const venues = [
  { name: "Mil948", zone: "Barrio Escalante" },
  { name: "Apotecario", zone: "Barrio Escalante" },
  { name: "Stiefel Pub", zone: "Barrio Otoya" },
  { name: "Café Rojo", zone: "San Pedro" },
];
describe("búsqueda de Explorar", () => {
  it("busca por nombre, barrio o ciudad, sin importar tildes ni mayúsculas", () => {
    expect(matchesQuery(venues[3], "cafe")).toBe(true);
    expect(matchesQuery(venues[0], "ESCALANTE")).toBe(true);
    expect(matchesQuery(venues[0], "mil escalante")).toBe(true);
    expect(matchesQuery(venues[2], "escalante")).toBe(false);
    expect(matchesQuery(venues[2], "  ")).toBe(true);
  });
  it("sugiere locales y barrios con cantidad, locales primero", () => {
    expect(suggestVenues(venues, "esca")).toEqual([
      { kind: "zone", value: "Barrio Escalante", hint: "2 locales" },
    ]);
    const mixed = suggestVenues(venues, "barrio");
    expect(mixed.map((s) => s.kind)).toEqual(["zone", "zone"]);
    expect(suggestVenues(venues, "pub")[0]).toEqual({
      kind: "venue",
      value: "Stiefel Pub",
      hint: "Barrio Otoya",
    });
    expect(suggestVenues(venues, "zzz")).toEqual([]);
    expect(suggestVenues(venues, "")).toEqual([]);
  });
});
