import { test, expect, type Page } from "@playwright/test";

// Plan de pulido · E2: portada 16:10, logo del local abajo a la izquierda y barrio abajo a la derecha sobre la portada;
// nombre, estado y horario debajo. Sin foto utilizable: respaldo nocturno con el vasito, nunca una caja rota.
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
      const full = card(page, "sala-norte");
      await full.scrollIntoViewIfNeeded();
      const cover = (await full.locator(".vcard-cover").boundingBox())!;
      expect(cover.width / cover.height).toBeGreaterThan(1.55);
      // El nombre va debajo de la portada.
      const name = (await full
        .getByRole("heading", { name: "Sala Norte" })
        .boundingBox())!;
      expect(name.y).toBeGreaterThanOrEqual(cover.y + cover.height - 1);
      // Logo cuadrado en la esquina inferior izquierda; barrio en la inferior derecha, ambos dentro de la portada.
      const logo = (await full.locator(".vcard-logo .mono").boundingBox())!;
      expect(Math.abs(logo.width - logo.height)).toBeLessThan(1);
      expect(logo.x).toBeLessThan(cover.x + cover.width / 3);
      expect(logo.y + logo.height).toBeLessThanOrEqual(cover.y + cover.height);
      const zone = (await full.locator(".vcard-zone").boundingBox())!;
      expect(zone.x + zone.width).toBeLessThanOrEqual(cover.x + cover.width);
      expect(zone.x).toBeGreaterThan(cover.x + cover.width / 3);
      await expect(full.locator(".vcard-zone")).toHaveText("San José");
      expect(
        await full
          .locator(".vcard-cover > img")
          .first()
          .evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
          ),
      ).toBe(true);
      // Estado verde y, debajo, el horario sin espacios dentro de p.m./a.m.
      await expect(full.locator(".vcard-state .badge")).toHaveText(/Abierto/);
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

test("sin imágenes: respaldo nocturno con la inicial del local, sin foto genérica", async ({
  page,
}) => {
  await open(page, 390, "dark");
  const empty = card(page, "club-cero");
  await expect(empty.locator(".vcard-cover")).toHaveAttribute(
    "data-photo",
    "false",
  );
  await expect(empty.locator(".vcard-fallback")).toHaveCount(1);
  await expect(empty.locator(".vcard-cover > img")).toHaveCount(0);
  await expect(empty.locator(".mono")).toHaveAttribute(
    "data-has-logo",
    "false",
  );
  await expect(empty.locator(".mono")).toHaveText("C");
});

test("una imagen que no carga cae al respaldo sin dejar una caja rota", async ({
  page,
}) => {
  await open(page, 390, "light");
  const broken = card(page, "rota");
  await broken.scrollIntoViewIfNeeded();
  await expect(broken.locator(".vcard-cover")).toHaveAttribute(
    "data-photo",
    "false",
  );
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
