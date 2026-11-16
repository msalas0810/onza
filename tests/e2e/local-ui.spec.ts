import { test, expect } from "@playwright/test";
test("sin Supabase se muestra bloqueo explícito y no un catálogo ficticiamente conectado", async ({
  page,
}) => {
  test.skip(
    !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    "Solo aplica al entorno sin configurar.",
  );
  await page.goto("/");
  await expect(page.getByText(/El servicio no está disponible/)).toBeVisible();
  await page.screenshot({
    path: "test-results/configuration-required.png",
    fullPage: true,
  });
});
for (const width of [390, 1280])
  for (const theme of ["light", "dark"] as const)
    test(`carrito y checkout ${width} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto("/cart");
      await page.evaluate(() =>
        localStorage.setItem(
          "onza-cart-draft",
          JSON.stringify({
            venueId: "20000000-0000-4000-8000-000000000001",
            venueName: "Sala Norte",
            venueSlug: "sala-norte",
            items: [
              {
                productId: "30000000-0000-4000-8000-000000000001",
                name: "Paloma",
                priceMinor: 450000,
                version: 1,
                quantity: 2,
              },
            ],
          }),
        ),
      );
      await page.reload();
      await expect(page.getByRole("heading", { name: "Paloma" })).toBeVisible();
      await page.getByRole("link", { name: "Continuar", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Confirmá tu pedido." }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Confirmar y reservar/ }),
      ).toBeDisabled();
      expect(
        await page
          .locator('input[type="text"],input[autocomplete="cc-number"]')
          .count(),
      ).toBe(0);
      await page.screenshot({
        path: `test-results/checkout-${width}-${theme}.png`,
        fullPage: true,
      });
    });
