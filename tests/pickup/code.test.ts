import { describe, expect, it } from "vitest";
import { formatPickupCode, isPickupCode, normalizePickupCode } from "@/features/pickup/code";
describe("código privado de retiro", () => {
  it("acepta pegado con espacios, guiones o minúsculas y lo normaliza", () => {
    expect(normalizePickupCode("ab12 cd34-ef56")).toBe("AB12CD34EF56");
    expect(normalizePickupCode("AB12–CD34—EF56")).toBe("AB12CD34EF56");
    expect(isPickupCode(" ab12-cd34-ef56 ")).toBe(true);
    expect(isPickupCode("AB12 CD34 EF5")).toBe(false);
    expect(isPickupCode("ZZ12 CD34 EF56")).toBe(false);
  });
  it("muestra grupos de cuatro mientras se escribe", () => {
    expect(formatPickupCode("ab12cd")).toBe("AB12 CD");
    expect(formatPickupCode("AB12-CD34-EF56-99")).toBe("AB12 CD34 EF56");
    expect(formatPickupCode("ab12 cd34 ef56")).toBe("AB12 CD34 EF56");
    expect(formatPickupCode("#ab!12")).toBe("AB12");
    expect(formatPickupCode("")).toBe("");
  });
});
