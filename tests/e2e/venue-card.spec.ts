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
  page.locator(`[data-sample="${slug}"] .venue-card`);

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
      await expect(
        full.getByRole("heading", { name: "Sala Norte" }),
      ).toBeVisible();
      await expect(full.getByText("San José")).toBeVisible();
      await expect(full.getByText("Ver tragos →")).toBeVisible();
      // El badge Abierto/Cerrado ya no existe en las tarjetas.
      for (const slug of ["sala-norte", "club-cero", "patio-central"]) {
        await expect(
          card(page, slug).getByText(/Abierto|Cerrado|Pausado/),
        ).toHaveCount(0);
      }

      // Geometría: logo cuadrado, en la esquina inferior izquierda de la foto, con el texto a su derecha.
      const cover = await full.locator(".venue-card-cover").boundingBox();
      const logo = await full.locator(".venue-card-logo").boundingBox();
      const name = await full
        .getByRole("heading", { name: "Sala Norte" })
        .boundingBox();
      const cta = await full.getByText("Ver tragos →").boundingBox();
      expect(cover && logo && name && cta).toBeTruthy();
      expect(Math.abs(logo!.width - logo!.height)).toBeLessThan(1);
      expect(logo!.width).toBeGreaterThanOrEqual(64);
      expect(logo!.x - cover!.x).toBeLessThanOrEqual(24);
      expect(
        cover!.y + cover!.height - (logo!.y + logo!.height),
      ).toBeLessThanOrEqual(24);
      expect(name!.x).toBeGreaterThan(logo!.x + logo!.width);
      expect(cta!.x).toBeGreaterThan(logo!.x + logo!.width);
      // Todo el contenido queda dentro de la foto.
      expect(cta!.y + cta!.height).toBeLessThanOrEqual(
        cover!.y + cover!.height,
      );
      expect(cta!.x + cta!.width).toBeLessThanOrEqual(cover!.x + cover!.width);

      // La imagen de portada realmente cargó (no hay caja vacía).
      const loaded = await full
        .locator(".venue-card-cover > img")
        .first()
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        );
      expect(loaded).toBe(true);

      await page
        .locator("#venue-cards")
        .locator("xpath=..")
        .screenshot({ path: `test-results/venue-cards-${width}-${theme}.png` });
    });

test("sin ubicación no se muestra una línea vacía", async ({ page }) => {
  await open(page, 390, "light");
  await expect(
    card(page, "patio-central").locator(".venue-card-location"),
  ).toHaveCount(0);
  await expect(
    card(page, "sala-norte").locator(".venue-card-location"),
  ).toHaveCount(1);
});

test("sin imágenes se muestra un placeholder con la inicial del local", async ({
  page,
}) => {
  await open(page, 390, "dark");
  const empty = card(page, "club-cero");
  await expect(empty.locator(".venue-card-cover")).toHaveAttribute(
    "data-has-cover",
    "false",
  );
  await expect(empty.locator(".venue-card-logo")).toHaveAttribute(
    "data-has-logo",
    "false",
  );
  await expect(empty.locator(".venue-card-logo")).toHaveText("C");
  await expect(empty.getByRole("heading", { name: "Club Cero" })).toBeVisible();
  await expect(empty.getByText("Ver tragos →")).toBeVisible();
});

test("una imagen que no carga cae al placeholder en vez de dejar una caja rota", async ({
  page,
}) => {
  await open(page, 390, "light");
  const broken = card(page, "rota");
  // Las imágenes bajo el pliegue se cargan de forma diferida: hay que acercarlas para que intenten cargar.
  await broken.scrollIntoViewIfNeeded();
  await expect(broken.locator(".venue-card-cover")).toHaveAttribute(
    "data-has-cover",
    "false",
  );
  await expect(broken.locator(".venue-card-logo")).toHaveAttribute(
    "data-has-logo",
    "false",
  );
  await expect(
    broken.getByRole("heading", { name: "Imagen rota" }),
  ).toBeVisible();
});

test("nombres largos no se desbordan ni tapan el logo", async ({ page }) => {
  for (const width of [360, 1280]) {
    await open(page, width, "light");
    const long = card(page, "largo");
    const box = await long.boundingBox();
    const name = await long.getByRole("heading").boundingBox();
    const logo = await long.locator(".venue-card-logo").boundingBox();
    expect(name!.x + name!.width).toBeLessThanOrEqual(box!.x + box!.width);
    expect(name!.x).toBeGreaterThan(logo!.x + logo!.width);
    expect(name!.y).toBeGreaterThanOrEqual(box!.y);
  }
});

// Contraste real del texto blanco sobre el peor caso: una portada blanca. Se oculta el texto, se fotografía el fondo
// que queda detrás de cada línea y se calcula el contraste contra el píxel más claro de su caja.
for (const width of [360, 1280])
  for (const theme of themes)
    test(`el texto de la tarjeta conserva contraste sobre portada blanca ${width}px ${theme}`, async ({
      page,
    }) => {
      await open(page, width, theme);
      const white = card(page, "clara");
      await white.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          white
            .locator(".venue-card-cover > img")
            .first()
            .evaluate(
              (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
            ),
        )
        .toBe(true);
      const parts = {
        nombre: white.getByRole("heading"),
        ubicacion: white.locator(".venue-card-location"),
        accion: white.locator(".venue-card-cta"),
      };
      const boxes: Record<
        string,
        { x: number; y: number; width: number; height: number }
      > = {};
      for (const [key, locator] of Object.entries(parts)) {
        const box = await locator.boundingBox();
        expect(box, key).toBeTruthy();
        boxes[key] = box!;
      }
      const cardBox = (await white.boundingBox())!;
      await page.addStyleTag({
        content: ".venue-card * { color: transparent !important; }",
      });
      const shot = (await white.screenshot()).toString("base64");
      const worst = await page.evaluate(
        async ({ shot, boxes, cardBox }) => {
          const image = new Image();
          image.src = `data:image/png;base64,${shot}`;
          await image.decode();
          const scale = image.naturalWidth / cardBox.width;
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d")!;
          context.drawImage(image, 0, 0);
          const channel = (value: number) => {
            const v = value / 255;
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          };
          const result: Record<string, number> = {};
          for (const [key, box] of Object.entries(boxes)) {
            const data = context.getImageData(
              Math.max(0, Math.floor((box.x - cardBox.x) * scale)),
              Math.max(0, Math.floor((box.y - cardBox.y) * scale)),
              Math.max(1, Math.floor(box.width * scale)),
              Math.max(1, Math.floor(box.height * scale)),
            ).data;
            let lightest = 0;
            for (let i = 0; i < data.length; i += 4)
              lightest = Math.max(
                lightest,
                0.2126 * channel(data[i]) +
                  0.7152 * channel(data[i + 1]) +
                  0.0722 * channel(data[i + 2]),
              );
            result[key] = 1.05 / (lightest + 0.05);
          }
          return result;
        },
        { shot, boxes, cardBox },
      );
      // WCAG AA: 4.5:1 texto normal (14 px), 3:1 texto grande (nombre de 20 px en semibold).
      expect(worst.ubicacion, JSON.stringify(worst)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(worst.accion, JSON.stringify(worst)).toBeGreaterThanOrEqual(4.5);
      expect(worst.nombre, JSON.stringify(worst)).toBeGreaterThanOrEqual(3);
    });

// Pantalla de administración (vista previa en /design-system, sin sesión ni Supabase): validaciones de archivo y vista previa.
const profile = (page: Page) =>
  page.getByRole("region", { name: "Perfil del local" });
const jpegHead = [
  0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1,
];

test("el perfil muestra una vista previa que cambia al editar nombre y ubicación", async ({
  page,
}) => {
  await open(page, 390, "light");
  const form = profile(page);
  const preview = form.getByLabel("Vista previa de la tarjeta");
  await expect(
    preview.getByRole("heading", { name: "Sala Norte" }),
  ).toBeVisible();
  await form.getByLabel("Nombre del local").fill("Bar Nuevo");
  await form.getByLabel("Ubicación (opcional)").fill("Cartago");
  await expect(
    preview.getByRole("heading", { name: "Bar Nuevo" }),
  ).toBeVisible();
  await expect(preview.getByText("Cartago")).toBeVisible();
  await form.getByLabel("Ubicación (opcional)").fill("");
  await expect(preview.locator(".venue-card-location")).toHaveCount(0);
  await form.getByLabel("Nombre del local").fill("   ");
  await expect(
    form.getByRole("button", { name: "Guardar perfil" }),
  ).toBeDisabled();
});

test("el perfil rechaza imágenes no válidas con un mensaje claro antes de subir nada", async ({
  page,
}) => {
  await open(page, 390, "light");
  const form = profile(page);
  const input = form.getByLabel("Foto de portada");
  const alert = form.getByRole("alert");
  await input.setInputFiles({
    name: "portada.svg",
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
  await form.getByLabel("Logo del local").setInputFiles({
    name: "logo.gif",
    mimeType: "image/gif",
    buffer: Buffer.from("GIF89a"),
  });
  await expect(alert).toHaveText("Usá una imagen JPG, PNG o WebP.");
});

test("una imagen válida pasa la validación (el error posterior es solo que aquí no hay sesión de administrador)", async ({
  page,
}) => {
  await open(page, 390, "light");
  const form = profile(page);
  const ok = Buffer.concat([Buffer.from(jpegHead), Buffer.alloc(1000)]);
  await form
    .getByLabel("Foto de portada")
    .setInputFiles({ name: "ok.jpg", mimeType: "image/jpeg", buffer: ok });
  const alert = form.getByRole("alert");
  await expect(alert).toContainText("No se pudo subir la imagen");
  await expect(alert).not.toContainText("Usá una imagen");
  await expect(alert).not.toContainText("2 MB");
});

for (const width of [390, 1280])
  for (const theme of themes)
    test(`perfil del local ${width}px ${theme}`, async ({ page }) => {
      await open(page, width, theme);
      const form = profile(page);
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
        path: `test-results/venue-profile-${width}-${theme}.png`,
      });
    });
