import { expect, it } from "vitest";
import { formatClock } from "@/lib/clock";
it("formatea la hora de Costa Rica sin espacios internos en a.m./p.m.", () => {
  expect(formatClock("2026-11-20T05:00:00Z")).toBe("11:00 p.m.");
  expect(formatClock("2026-11-20T09:43:00Z")).toBe("3:43 a.m.");
  expect(formatClock("2026-11-20T18:05:00Z")).toBe("12:05 p.m.");
});
