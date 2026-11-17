import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://127.0.0.1:3000", headless: true, channel: "chrome" },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    // Simulated payment outcomes exist for these tests only.
    env: { ENABLE_PAYMENT_SCENARIOS: "true" },
  },
  reporter: "list",
});
