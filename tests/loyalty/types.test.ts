import { describe, it, expect } from "vitest";
import {
  campaignInputSchema,
  programInputSchema,
  ruleInputSchema,
} from "@/features/loyalty/types";

const venueId = "20000000-0000-4000-8000-000000000001";
const categoryId = "ad46cb30-426b-52bb-8358-ac044919d89a";

describe("contratos de fidelización", () => {
  it("el programa acepta porcentajes entre 0 y 100 y vigencias de 1 a 3650 días", () => {
    const ok = {
      venueId,
      enabled: true,
      basePercent: 2.5,
      pointsValidDays: 180,
    };
    expect(programInputSchema.parse(ok)).toEqual(ok);
    expect(() =>
      programInputSchema.parse({ ...ok, basePercent: 101 }),
    ).toThrow();
    expect(() =>
      programInputSchema.parse({ ...ok, basePercent: -0.1 }),
    ).toThrow();
    expect(() =>
      programInputSchema.parse({ ...ok, pointsValidDays: 0 }),
    ).toThrow();
    expect(() =>
      programInputSchema.parse({ ...ok, venueId: "no-es-uuid" }),
    ).toThrow();
  });

  it("una regla por categoría exige categoría; una regla de todo el local no la admite", () => {
    const base = { venueId, name: "Cócteles", percent: 5 };
    expect(
      ruleInputSchema.parse({ ...base, kind: "category", scopeId: categoryId })
        .kind,
    ).toBe("category");
    expect(() =>
      ruleInputSchema.parse({ ...base, kind: "category" }),
    ).toThrow();
    expect(() =>
      ruleInputSchema.parse({ ...base, kind: "all", scopeId: categoryId }),
    ).toThrow();
    expect(ruleInputSchema.parse({ ...base, kind: "all" }).active).toBe(true);
  });

  it("la franja horaria necesita inicio y fin distintos, y los días ISO van de 1 a 7", () => {
    const base = { venueId, name: "Tarde", kind: "all", percent: 3 } as const;
    expect(
      ruleInputSchema.parse({
        ...base,
        hourFrom: 15,
        hourTo: 18,
        weekdays: [1, 7],
      }).hourTo,
    ).toBe(18);
    expect(() => ruleInputSchema.parse({ ...base, hourFrom: 15 })).toThrow();
    expect(() =>
      ruleInputSchema.parse({ ...base, hourFrom: 15, hourTo: 15 }),
    ).toThrow();
    expect(() => ruleInputSchema.parse({ ...base, weekdays: [0] })).toThrow();
    expect(() => ruleInputSchema.parse({ ...base, weekdays: [8] })).toThrow();
  });

  it("la vigencia de una regla termina después de empezar", () => {
    const base = { venueId, name: "Campaña", kind: "all", percent: 3 } as const;
    const from = "2026-12-01T00:00:00-06:00";
    expect(() =>
      ruleInputSchema.parse({ ...base, validFrom: from, validUntil: from }),
    ).toThrow();
    expect(
      ruleInputSchema.parse({
        ...base,
        validFrom: from,
        validUntil: "2026-12-31T23:59:00-06:00",
      }).validUntil,
    ).toBe("2026-12-31T23:59:00-06:00");
  });

  it("un patrocinio exige nombre del patrocinador y solo entonces; el presupuesto no es negativo", () => {
    const base = { venueId, name: "Cerveza de la semana", budgetPoints: 500 };
    expect(() =>
      campaignInputSchema.parse({ ...base, funder: "sponsor" }),
    ).toThrow();
    expect(() =>
      campaignInputSchema.parse({
        ...base,
        funder: "venue",
        sponsorName: "Marca",
      }),
    ).toThrow();
    expect(
      campaignInputSchema.parse({
        ...base,
        funder: "sponsor",
        sponsorName: "Marca",
      }).sponsorName,
    ).toBe("Marca");
    expect(() =>
      campaignInputSchema.parse({ ...base, funder: "onza", budgetPoints: -1 }),
    ).toThrow();
  });
});
