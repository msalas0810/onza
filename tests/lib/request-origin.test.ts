import { expect, it } from "vitest";
import { isAllowedRequestOrigin } from "@/lib/request-origin";
const request = (origin?: string) =>
  new Request("https://demo-abc.vercel.app/api/commands", {
    headers: origin ? { origin } : {},
  });
const env = {
  APP_ORIGIN: "https://existing.example",
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_URL: "demo-abc.vercel.app",
  VERCEL_BRANCH_URL: "demo-git-fix.vercel.app",
};
it("keeps canonical origin and accepts only exact Vercel-assigned preview URLs", () => {
  for (const origin of [
    env.APP_ORIGIN,
    "https://demo-abc.vercel.app",
    "https://demo-git-fix.vercel.app",
  ])
    expect(isAllowedRequestOrigin(request(origin), env)).toBe(true);
  for (const origin of [
    undefined,
    "https://evil.vercel.app",
    "https://demo-abc.vercel.app.evil.test",
    "null",
  ])
    expect(isAllowedRequestOrigin(request(origin), env)).toBe(false);
});
it("does not broaden production or non-Vercel deployments", () => {
  expect(
    isAllowedRequestOrigin(request("https://demo-abc.vercel.app"), {
      ...env,
      VERCEL_ENV: "production",
    }),
  ).toBe(false);
  expect(
    isAllowedRequestOrigin(request("https://demo-abc.vercel.app"), {
      ...env,
      VERCEL: undefined,
    }),
  ).toBe(false);
});
