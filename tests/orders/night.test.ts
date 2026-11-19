import { expect, it } from "vitest";
import { groupByNight, nightLabel } from "@/features/orders/night";
import { businessDate } from "@/features/analytics/business-date";
it("23:45 y 00:30 de la misma salida quedan en la misma noche operativa", () => {
  // 23:45 y 00:30 hora de Costa Rica (UTC-6).
  expect(businessDate(new Date("2026-11-21T05:45:00Z"))).toBe("2026-11-20");
  expect(businessDate(new Date("2026-11-21T06:30:00Z"))).toBe("2026-11-20");
  // 06:00 en punto empieza la noche siguiente.
  expect(businessDate(new Date("2026-11-21T12:00:00Z"))).toBe("2026-11-21");
  const groups = groupByNight([
    { id: "a", business_date: "2026-11-20" },
    { id: "b", business_date: "2026-11-20" },
    { id: "c", business_date: "2026-11-18" },
  ]);
  expect(groups.map((g) => [g.day, g.items.length])).toEqual([
    ["2026-11-20", 2],
    ["2026-11-18", 1],
  ]);
});
it("nombra la noche de forma relativa y luego con fecha", () => {
  const now = new Date("2026-11-21T03:00:00Z"); // 21:00 del 20 en Costa Rica
  expect(nightLabel("2026-11-20", now)).toBe("Esta noche");
  expect(nightLabel("2026-11-19", now)).toBe("Anoche");
  expect(nightLabel("2026-11-14", now)).toMatch(/^Noche del sábado 14 nov/);
});
