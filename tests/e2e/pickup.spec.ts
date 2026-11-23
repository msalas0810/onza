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
  // «Validar retiro» abre el escáner. Sin detector de QR (o sin cámara en el runner) pasa solo al código manual.
  await page.getByRole("button", { name: "Validar retiro" }).first().click();
  await expect(
    page.getByText(/no lee QR|No pudimos usar la cámara/),
  ).toBeVisible();
  await expect(page.getByLabel("Código privado")).toBeVisible();
});
