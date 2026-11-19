import { defineConfig } from "@playwright/test";
// Pruebas de navegador contra la app local apuntada al servidor de verificación (scripts/local-shim), sin bases remotas.
// Uso: levantar shim + `next dev -p 3100` (ver docs/plan-pulido-registro.md) y luego
//   npx playwright test -c playwright.local.config.ts venue-card
// PLAYWRIGHT_CHROMIUM permite usar un Chromium ya instalado si la versión de Playwright no tiene el suyo descargado.
export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: process.env.ONZA_APP ?? "http://127.0.0.1:3100",
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM }
      : {},
  },
  reporter: "line",
  workers: 2,
});
