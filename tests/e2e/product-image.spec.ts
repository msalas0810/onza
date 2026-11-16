import { test, expect, type Locator, type Page } from "@playwright/test";

const widths = [360, 390, 430, 768, 1280];
const themes = ["light", "dark"] as const;

async function open(page: Page, width: number, theme: "light" | "dark") {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.goto("/design-system");
  await expect(
    page.getByRole("heading", { name: "Menú de tragos" }),
  ).toBeVisible();
}
const menu = (page: Page) =>
  page.getByRole("region", { name: "Menú de tragos" });
const row = (page: Page, name: string) =>
  menu(page)
    .locator(".product-row")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
// The visual slot of a row: the loaded image frame or the placeholder, whichever is shown.
const slot = (rowLocator: Locator) =>
  rowLocator.locator(".product-image, .photo-fallback").first();

for (const width of widths)
  for (const theme of themes)
    test(`tragos con imagen de tamaño fijo y bordes redondeados ${width}px ${theme}`, async ({
      page,
    }) => {
      await open(page, width, theme);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const rows = await menu(page).locator(".product-row").all();
      expect(rows.length).toBe(8);
      for (const r of rows) {
        await r.scrollIntoViewIfNeeded();
        const box = (await slot(r).boundingBox())!;
        // Mismo tamaño con imagen o con marcador de posición: 88 x 110.
        expect(Math.round(box.width)).toBe(88);
        expect(Math.round(box.height)).toBe(110);
        const radius = await slot(r).evaluate((el) =>
          parseFloat(getComputedStyle(el).borderTopLeftRadius),
        );
        expect(radius).toBeGreaterThanOrEqual(12);
        // La imagen queda a la derecha del texto y dentro de la fila.
        const rowBox = (await r.boundingBox())!;
        const copy = (await r.locator(".product-copy").boundingBox())!;
        expect(box.x).toBeGreaterThan(copy.x);
        expect(box.x + box.width).toBeLessThanOrEqual(
          rowBox.x + rowBox.width + 1,
        );
      }
      // Paloma carga su ilustración de verdad (no una caja vacía).
      const paloma = row(page, "Paloma");
      await paloma.scrollIntoViewIfNeeded();
      expect(
        await paloma
          .locator(".product-image img")
          .evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
          ),
      ).toBe(true);
      await menu(page).screenshot({
        path: `test-results/product-menu-${width}-${theme}.png`,
      });
    });

test("un trago sin imagen muestra el marcador de posición", async ({
  page,
}) => {
  await open(page, 390, "light");
  const r = row(page, "Sin imagen");
  await r.scrollIntoViewIfNeeded();
  await expect(r.locator(".photo-fallback")).toHaveCount(1);
  await expect(r.locator(".product-image")).toHaveCount(0);
});

test("una imagen que no carga cae al marcador de posición sin dejar una caja rota", async ({
  page,
}) => {
  await open(page, 390, "light");
  const r = row(page, "Imagen que no carga");
  await r.scrollIntoViewIfNeeded();
  await expect(r.locator(".photo-fallback")).toHaveCount(1);
  await expect(r.locator(".product-image")).toHaveCount(0);
  const box = (await slot(r).boundingBox())!;
  expect([Math.round(box.width), Math.round(box.height)]).toEqual([88, 110]);
});

test("un nombre largo no deforma ni desplaza la imagen", async ({ page }) => {
  for (const width of [360, 1280]) {
    await open(page, width, "dark");
    const long = row(
      page,
      "Cóctel de la casa con un nombre muy largo que ocupa varias líneas",
    );
    await long.scrollIntoViewIfNeeded();
    const box = (await slot(long).boundingBox())!;
    const rowBox = (await long.boundingBox())!;
    expect([Math.round(box.width), Math.round(box.height)]).toEqual([88, 110]);
    expect(box.x + box.width).toBeLessThanOrEqual(rowBox.x + rowBox.width + 1);
  }
});

// Editor de trago (vista previa en /design-system, sin sesión ni Supabase).
const editor = (page: Page) =>
  page.getByRole("region", { name: "Editor de trago" });
const jpegHead = [
  0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1,
];

test("el editor muestra la imagen actual y permite quitarla antes de guardar", async ({
  page,
}) => {
  await open(page, 390, "light");
  const form = editor(page);
  await form.scrollIntoViewIfNeeded();
  await expect(form.locator(".product-image")).toHaveCount(1);
  await expect(form.getByText("Esta es la imagen publicada.")).toBeVisible();
  await form.getByRole("button", { name: "Quitar imagen" }).click();
  await expect(form.locator(".photo-fallback")).toHaveCount(1);
  await expect(
    form.getByText("Imagen quitada. Guardá el trago para aplicar el cambio."),
  ).toBeVisible();
});

test("el editor rechaza archivos no válidos con un mensaje claro antes de subir nada", async ({
  page,
}) => {
  await open(page, 390, "light");
  const form = editor(page);
  const input = form.getByLabel("Imagen del trago");
  const alert = form.getByRole("alert");
  await input.setInputFiles({
    name: "t.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await expect(alert).toHaveText("Usá una imagen JPG, PNG o WebP.");
  await input.setInputFiles({
    name: "falsa.png",
    mimeType: "image/png",
    buffer: Buffer.from("no soy una imagen"),
  });
  await expect(alert).toHaveText(
    "El archivo no es una imagen JPG, PNG o WebP válida.",
  );
  const heavy = Buffer.concat([
    Buffer.from(jpegHead),
    Buffer.alloc(2 * 1024 * 1024),
  ]);
  await input.setInputFiles({
    name: "pesada.jpg",
    mimeType: "image/jpeg",
    buffer: heavy,
  });
  await expect(alert).toHaveText(
    "La imagen pesa más de 2 MB. Reducila e intentá otra vez.",
  );
  await input.setInputFiles({
    name: "t.gif",
    mimeType: "image/gif",
    buffer: Buffer.from("GIF89a"),
  });
  await expect(alert).toHaveText("Usá una imagen JPG, PNG o WebP.");
  // Ninguna imagen se aceptó: sigue la actual.
  await expect(form.getByText("Esta es la imagen publicada.")).toBeVisible();
});

test("una imagen válida pasa la validación (el error posterior es solo que aquí no hay sesión de administrador)", async ({
  page,
}) => {
  await open(page, 390, "light");
  const form = editor(page);
  const ok = Buffer.concat([Buffer.from(jpegHead), Buffer.alloc(1000)]);
  await form
    .getByLabel("Imagen del trago")
    .setInputFiles({ name: "ok.jpg", mimeType: "image/jpeg", buffer: ok });
  const alert = form.getByRole("alert");
  await expect(alert).toContainText("No se pudo subir la imagen");
  await expect(alert).not.toContainText("Usá una imagen");
  await expect(alert).not.toContainText("2 MB");
});

for (const width of [390, 1280])
  for (const theme of themes)
    test(`editor de trago ${width}px ${theme}`, async ({ page }) => {
      await open(page, width, theme);
      const form = editor(page);
      await form.scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      for (const button of await form.getByRole("button").all())
        if (await button.isVisible())
          expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(
            44,
          );
      await form.screenshot({
        path: `test-results/product-editor-${width}-${theme}.png`,
      });
    });
