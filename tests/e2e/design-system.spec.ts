import { test, expect } from "@playwright/test";
for (const width of [360, 390, 430, 768, 1280])
  for (const theme of ["light", "dark"] as const)
    test(`${width} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto("/design-system");
      await expect(
        page.getByRole("heading", { name: "Sistema de diseño" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const buttons = await page.getByRole("main").getByRole("button").all();
      for (const button of buttons) {
        if (await button.isVisible()) {
          const box = await button.boundingBox();
          expect(box?.height).toBeGreaterThanOrEqual(44);
        }
      }
      await page.screenshot({
        path: `test-results/design-${width}-${theme}.png`,
        fullPage: true,
      });
    });
test("tema y foco persistentes", async ({ page }) => {
  await page.goto("/design-system");
  await page.getByLabel("Tema").selectOption("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByLabel("Tema")).toHaveValue("dark");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe(
    "BODY",
  );
});
