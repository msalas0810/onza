import { expect, it } from "vitest";
import { isAllowedRequestOrigin } from "@/lib/request-origin";
const request = (origin?: string) =>
  new Request("https://onza-preview.cuenta.workers.dev/api/commands", {
    headers: origin ? { origin } : {},
  });
const env = { APP_ORIGIN: "https://existing.example", NODE_ENV: "production" };
it("solo acepta el origen configurado", () => {
  expect(isAllowedRequestOrigin(request(env.APP_ORIGIN), env)).toBe(true);
  for (const origin of [
    undefined,
    "https://onza-preview.cuenta.workers.dev",
    "https://existing.example.evil.test",
    "null",
  ])
    expect(isAllowedRequestOrigin(request(origin), env)).toBe(false);
});
it("ya no amplía la lista por variables de la plataforma anterior", () => {
  expect(
    isAllowedRequestOrigin(request("https://demo-abc.vercel.app"), {
      ...env,
      ...{
        VERCEL: "1",
        VERCEL_ENV: "preview",
        VERCEL_URL: "demo-abc.vercel.app",
      },
    }),
  ).toBe(false);
});
it("sin APP_ORIGIN, producción rechaza todo y desarrollo acepta su propio origen", () => {
  const own = request("https://onza-preview.cuenta.workers.dev");
  expect(isAllowedRequestOrigin(own, { NODE_ENV: "production" })).toBe(false);
  expect(isAllowedRequestOrigin(own, { NODE_ENV: "development" })).toBe(true);
});
