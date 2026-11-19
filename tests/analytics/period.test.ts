import { describe, expect, it } from "vitest";
import { periodBuckets, periodFor, periodLabel } from "@/features/analytics/period";
describe("períodos del Resumen", () => {
  it("día, semana de lunes a domingo, mes y año", () => {
    expect(periodFor("day", "2026-11-19")).toEqual({ kind: "day", from: "2026-11-19", to: "2026-11-19" });
    expect(periodFor("week", "2026-11-19")).toEqual({ kind: "week", from: "2026-11-16", to: "2026-11-22" });
    expect(periodFor("week", "2026-11-16").from).toBe("2026-11-16");
    expect(periodFor("week", "2026-11-22").from).toBe("2026-11-16");
    expect(periodFor("month", "2026-02-10")).toEqual({ kind: "month", from: "2026-02-01", to: "2026-02-28" });
    expect(periodFor("year", "2026-02-10")).toEqual({ kind: "year", from: "2026-01-01", to: "2026-12-31" });
  });
  it("buckets completos en el orden de la noche", () => {
    const hours = periodBuckets("hour", "2026-11-19", "2026-11-19");
    expect(hours[0]).toBe("06");
    expect(hours.at(-1)).toBe("05");
    expect(hours).toHaveLength(24);
    expect(periodBuckets("day", "2026-11-29", "2026-12-02")).toEqual(["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
    expect(periodBuckets("month", "2025-11-01", "2026-02-28")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
  it("etiqueta la noche actual y otros períodos", () => {
    const now = new Date("2026-11-20T03:00:00Z");
    expect(periodLabel({ kind: "day", from: "2026-11-19", to: "2026-11-19" }, now)).toMatch(/^Esta noche/);
    expect(periodLabel({ kind: "year", from: "2026-01-01", to: "2026-12-31" }, now)).toBe("2026");
  });
});
