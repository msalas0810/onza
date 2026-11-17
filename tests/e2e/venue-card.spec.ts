import { test, expect, type Page } from "@playwright/test";

const widths = [360, 390, 430, 768, 1280];
const themes = ["light", "dark"] as const;

async function open(page: Page, width: number, theme: "light" | "dark") {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.goto("/design-system");
  await expect(
    page.getByRole("heading", { name: "Tarjeta de local" }),
  ).toBeVisible();
}
const card = (page: Page, slug: string) =>
  page.locator(`[data-sample="${slug}"] .vcard`);

for (const width of widths)
  for (const theme of themes)
    test(`tarjeta de local ${width}px ${theme}`, async ({ page }) => {
      await open(page, width, theme);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      // Con portada: la foto protagoniza y el texto va DEBAJO, sin velos sobre la imagen.
      const full = card(page, "sala-norte");
      await full.scrollIntoViewIfNeeded();
      await expect(
        full.getByRole("heading", { name: "Sala Norte" }),
      ).toBeVisible();
      await expect(full.getByText("San José")).toBeVisible();
      const media = (await full.locator(".media").boundingBox())!;
      const name = (await full
        .getByRole("heading", { name: "Sala Norte" })
        .boundingBox())!;
      expect(name.y).toBeGreaterThanOrEqual(media.y + media.height - 1);
      expect(media.width / media.height).toBeGreaterThan(1.7);
      // El logo es cuadrado y la portada realmente cargó.
      const logo = (await full.locator(".mono").boundingBox())!;
      expect(Math.abs(logo.width - logo.height)).toBeLessThan(1);
      expect(
        await full
          .locator(".media img")
          .first()
          .evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
          ),
      ).toBe(true);
      // Ningún texto de la tarjeta se sale de ella.
      const box = (await full.boundingBox())!;
      for (const text of await full.locator("h3,.meta,.badge").all()) {
        const t = (await text.boundingBox())!;
        expect(t.x + t.width).toBeLessThanOrEqual(box.x + box.width + 1);
      }
      await page
        .locator("#venue-cards")
        .locator("xpath=..")
        .screenshot({ path: `test-results/venue-cards-${width}-${theme}.png` });
    });

test("sin ubicación no se muestra una línea de ubicación vacía", async ({
  page,
}) => {
  await open(page, 390, "light");
  await expect(
    card(page, "patio-central")
      .locator(".meta")
      .filter({ hasText: "San José" }),
  ).toHaveCount(0);
  await expect(
    card(page, "sala-norte").locator(".meta").filter({ hasText: "San José" }),
  ).toHaveCount(1);
});

test("sin imágenes se muestra una tarjeta compacta con la inicial del local", async ({
  page,
}) => {
  await open(page, 390, "dark");
  const empty = card(page, "club-cero");
  await expect(empty).toHaveClass(/compact/);
  await expect(empty.locator(".media")).toHaveCount(0);
  await expect(empty.locator(".mono")).toHaveAttribute(
    "data-has-logo",
    "false",
  );
  await expect(empty.locator(".mono")).toHaveText("C");
});

test("una imagen que no carga cae a la tarjeta compacta sin dejar una caja rota", async ({
  page,
}) => {
  await open(page, 390, "light");
  const broken = card(page, "rota");
  await broken.scrollIntoViewIfNeeded();
  await expect(broken).toHaveClass(/compact/);
  await expect(broken.locator(".media")).toHaveCount(0);
  await expect(broken.locator(".mono")).toHaveText("I");
});

test("un nombre y una ubicación largos no deforman la tarjeta", async ({
  page,
}) => {
  for (const width of [360, 1280]) {
    await open(page, width, "dark");
    const long = card(page, "largo");
    await long.scrollIntoViewIfNeeded();
    const box = (await long.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    const logo = (await long.locator(".mono").boundingBox())!;
    expect(Math.abs(logo.width - logo.height)).toBeLessThan(1);
  }
});

test("la vista previa no navega", async ({ page }) => {
  await open(page, 390, "light");
  await expect(
    page.locator("#venue-cards").locator("xpath=..").locator("a.vcard"),
  ).toHaveCount(0);
});
