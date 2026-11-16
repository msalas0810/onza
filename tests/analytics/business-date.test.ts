import { it, expect } from "vitest";
import { businessDate } from "@/features/analytics/business-date";
it("corte local coincide con SQL a ambos lados de 06:00", () => {
  expect(businessDate(new Date("2026-11-16T07:00:00Z"))).toBe("2026-11-15");
  expect(businessDate(new Date("2026-11-16T11:59:59Z"))).toBe("2026-11-15");
  expect(businessDate(new Date("2026-11-16T12:00:00Z"))).toBe("2026-11-16");
});
