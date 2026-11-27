import { describe, expect, it } from "vitest";
import { projectVenues } from "@/features/social/components/activity-map";

describe("proyección del mapa de actividad", () => {
  it("un solo local queda al centro", () => {
    expect(projectVenues([{ latitude: 9.9, longitude: -84 }])[0]).toMatchObject({ x: 0.5, y: 0.5 });
  });
  it("conserva la orientación (norte arriba, oeste a la izquierda) dentro del margen", () => {
    const [north, south] = projectVenues([
      { latitude: 10, longitude: -84.2 },
      { latitude: 9.9, longitude: -84 },
    ]);
    expect(north.y).toBeLessThan(south.y);
    expect(north.x).toBeLessThan(south.x);
    for (const p of [north, south]) {
      expect(p.x).toBeGreaterThanOrEqual(0.1);
      expect(p.x).toBeLessThanOrEqual(0.9);
      expect(p.y).toBeGreaterThanOrEqual(0.1);
      expect(p.y).toBeLessThanOrEqual(0.9);
    }
  });
});
