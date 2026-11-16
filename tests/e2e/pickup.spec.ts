import { loginStaff } from "./helpers/auth";
import { test, expect } from "@playwright/test";
test("cámara no disponible mantiene alternativa manual", async ({ page }) => {
  test.skip(
    process.env.E2E_LIVE !== "true",
    "Requiere sesión real de barra en Supabase.",
  );
  await loginStaff(page);
  await page.goto("/staff/20000000-0000-4000-8000-000000000001");
  await page.addInitScript(() =>
    Object.defineProperty(window, "BarcodeDetector", { value: undefined }),
  );
  await page.reload();
  await page.getByRole("button", { name: "Escanear retiro" }).click();
  await expect(page.getByText(/Este navegador no tiene escáner/)).toBeVisible();
  await page
    .getByRole("button", { name: "Cerrar y usar código manual" })
    .click();
  await expect(page.getByLabel("Código de 6 caracteres")).toBeVisible();
});
