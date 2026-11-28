import { afterEach, expect, it, vi } from "vitest";
import { demoEnabled } from "@/features/demo/server/demo-accounts";

afterEach(() => vi.unstubAllEnvs());

it("el acceso demo está apagado salvo que se pida con su propio indicador", () => {
  vi.stubEnv("DEMO_MODE", "true");
  vi.stubEnv("DEMO_LOGIN_ENABLED", "");
  expect(demoEnabled()).toBe(false);
});

it("necesita el modo demo y el indicador a la vez", () => {
  vi.stubEnv("DEMO_MODE", "false");
  vi.stubEnv("DEMO_LOGIN_ENABLED", "true");
  expect(demoEnabled()).toBe(false);
  vi.stubEnv("DEMO_MODE", "true");
  expect(demoEnabled()).toBe(true);
});
