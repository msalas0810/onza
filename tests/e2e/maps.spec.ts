import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { deflateSync } from "node:zlib";
import { SERVICE_KEY, people } from "../../scripts/local-shim/index.mjs";
import { sessionCookies } from "../../scripts/local-shim/session.mjs";

/**
 * Mapa interactivo de ubicación y entrega, de punta a punta en Chromium contra el servidor de verificación local
 * (scripts/local-shim + next dev; ver docs/Onza-Mapa-interactivo.md). El shim no tiene Storage: la subida de la imagen se prueba con
 * el endpoint de Storage simulado dentro de la prueba (ruta interceptada), que además conserva los bytes para comprobar
 * qué se subió realmente.
 */
const SHIM = process.env.SHIM_URL ?? "http://127.0.0.1:54321";
const SALA = "20000000-0000-4000-8000-000000000001";
const MAP = "40000000-0000-4000-8000-000000000001";
const PALOMA = "30000000-0000-4000-8000-000000000001";
// Punto libre del plano de demostración: ni zonas ni marcadores a menos de 44 px con ningún tamaño de pantalla probado.
const FREE = { x: 0.47, y: 0.3 };

test.describe.configure({ mode: "serial" });

async function fixtureSql(sql: string) {
  const response = await fetch(`${SHIM}/__fixture/sql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql }),
  });
  expect(response.ok).toBe(true);
}
type Viewport = { width: number; height: number };
async function person(
  browser: Browser,
  email: string,
  viewport: Viewport,
  touch = true,
) {
  const context = await browser.newContext({
    viewport,
    hasTouch: touch,
    isMobile: touch && viewport.width < 700,
    deviceScaleFactor: 2,
  });
  await context.addCookies(
    (await sessionCookies(SHIM, email)) as Parameters<
      BrowserContext["addCookies"]
    >[0],
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page, errors };
}
async function seedCart(page: Page, userId: string) {
  await page.goto("/orders");
  await page.evaluate(
    ([id, product]) =>
      localStorage.setItem(
        `onza-cart-draft:${id}`,
        JSON.stringify({
          venueId: "20000000-0000-4000-8000-000000000001",
          venueName: "Sala Norte",
          venueSlug: "sala-norte",
          pickupLabel: "Barra principal",
          items: [
            {
              productId: product,
              name: "Paloma",
              priceMinor: 450000,
              version: 1,
              quantity: 1,
            },
          ],
        }),
      ),
    [userId, PALOMA],
  );
}
const viewportOf = (page: Page) => page.getByTestId("map-viewport");
const planImage = (page: Page) => viewportOf(page).locator("img");
/** Coordenada de pantalla de un punto normalizado del plano, con el zoom y desplazamiento actuales. */
async function screenOf(page: Page, n: { x: number; y: number }) {
  const box = (await planImage(page).boundingBox())!;
  return { x: box.x + n.x * box.width, y: box.y + n.y * box.height };
}
async function tap(page: Page, p: { x: number; y: number }, touch: boolean) {
  if (touch) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}
async function touchGesture(page: Page, frames: { x: number; y: number }[][]) {
  const cdp = await page.context().newCDPSession(page);
  const points = (f: { x: number; y: number }[]) =>
    f.map((p, i) => ({ x: p.x, y: p.y, id: i + 1 }));
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: points(frames[0]),
  });
  for (const frame of frames.slice(1))
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: points(frame),
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
}
const scaleOf = async (page: Page) =>
  Number(await viewportOf(page).getAttribute("data-scale"));
async function openPicker(page: Page) {
  await page.goto("/checkout");
  await page.getByRole("button", { name: "Marcar mi ubicación" }).click();
  await expect(viewportOf(page)).toBeVisible();
  await expect(planImage(page)).toHaveJSProperty("complete", true);
}
async function placeOrder(page: Page) {
  await page.getByRole("button", { name: /^Pedir/ }).click();
  await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/, { timeout: 15000 });
  return page.url().split("/").pop()!;
}
async function orderOf(page: Page, id: string) {
  const response = await page.request.get(`/api/orders?order=${id}`);
  expect(response.ok()).toBe(true);
  return ((await response.json()) as Record<string, any>[])[0]; // eslint-disable-line @typescript-eslint/no-explicit-any
}

let maria: Awaited<ReturnType<typeof person>>;
test.beforeAll(async ({ browser }) => {
  // Personal de Sala Norte: Ana (administradora) y Jorge (barra) pertenecen a Mil948 en el shim.
  await fixtureSql(`insert into public.memberships(user_id,venue_id,role) values
    ('${people.ana.id}','${SALA}','admin'),('${people.jorge.id}','${SALA}','bartender') on conflict do nothing`);
  maria = await person(browser, people.maria.email, {
    width: 390,
    height: 844,
  });
});
test.afterAll(async () => {
  await maria.context.close();
});

test.describe("cliente", () => {
  test("el plano carga con sus elementos y zonas, sin desbordar la pantalla", async () => {
    const { page } = maria;
    await seedCart(page, people.maria.id);
    await openPicker(page);
    expect(
      await planImage(page).evaluate(
        (img: HTMLImageElement) => img.naturalWidth,
      ),
    ).toBeGreaterThan(100);
    await expect(page.locator("[data-marker-id]")).toHaveCount(12);
    expect(await scaleOf(page)).toBe(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    // El plano completo cabe dentro del contenedor.
    const box = (await viewportOf(page).boundingBox())!;
    const img = (await planImage(page).boundingBox())!;
    expect(img.x).toBeGreaterThanOrEqual(box.x - 1);
    expect(img.x + img.width).toBeLessThanOrEqual(box.x + box.width + 1);
    await expect(
      page.getByRole("button", { name: "Estoy aquí" }),
    ).toBeDisabled();
    await page.screenshot({ path: "test-results/maps-picker-390.png" });
  });

  test("pellizco, arrastre, doble toque y botones: zoom y desplazamiento táctil dentro de los límites", async () => {
    const { page } = maria;
    const box = (await viewportOf(page).boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const before = (await planImage(page).boundingBox())!;
    // Pellizco hacia afuera con dos dedos: amplía.
    const spread = (d: number) => [
      { x: cx - d / 2, y: cy },
      { x: cx + d / 2, y: cy },
    ];
    await touchGesture(page, [60, 90, 120, 150, 180, 210].map(spread));
    const zoomed = await scaleOf(page);
    expect(zoomed).toBeGreaterThan(2);
    const big = (await planImage(page).boundingBox())!;
    expect(big.width).toBeGreaterThan(before.width * 2);
    // El plano nunca deja el contenedor vacío: sigue cubriéndolo en el eje que excede.
    expect(big.x).toBeLessThanOrEqual(box.x + 1);
    expect(big.x + big.width).toBeGreaterThanOrEqual(box.x + box.width - 1);
    // Arrastre con un dedo: mueve el plano.
    const drag = [0, 30, 60, 90].map((dx) => [{ x: cx - 40 + dx, y: cy }]);
    const beforePan = (await planImage(page).boundingBox())!;
    await touchGesture(page, drag);
    const afterPan = (await planImage(page).boundingBox())!;
    expect(afterPan.x).toBeGreaterThan(beforePan.x + 40);
    // Un arrastre enorme no saca el plano de los límites.
    await touchGesture(
      page,
      [0, 100, 200, 300, 400].map((dx) => [{ x: box.x + 10 + dx / 2, y: cy }]),
    );
    const edge = (await planImage(page).boundingBox())!;
    expect(edge.x).toBeLessThanOrEqual(box.x + 1);
    // Un arrastre no es un toque: no se colocó ningún marcador.
    await expect(page.getByTestId("picker-summary")).toContainText(
      "Tocá el plano",
    );
    // Pellizco hacia adentro: reduce, sin pasar de la escala 1.
    const pinch = (d: number) => [
      { x: cx - d / 2, y: cy },
      { x: cx + d / 2, y: cy },
    ];
    await touchGesture(page, [300, 240, 180, 120, 60, 20].map(pinch));
    expect(await scaleOf(page)).toBeLessThan(zoomed);
    expect(await scaleOf(page)).toBeGreaterThanOrEqual(1); // nunca por debajo del plano completo
    await page.getByRole("button", { name: "Acercar" }).click();
    await expect.poll(() => scaleOf(page)).toBeGreaterThan(1.5);
    // Doble toque: amplía; otro doble toque en el máximo vuelve a la vista completa.
    await page.getByRole("button", { name: "Ver el plano completo" }).click();
    await expect.poll(() => scaleOf(page)).toBe(1);
    const free = await screenOf(page, FREE);
    await page.touchscreen.tap(free.x, free.y);
    await page.touchscreen.tap(free.x, free.y);
    await expect.poll(() => scaleOf(page)).toBeGreaterThan(1.8);
  });

  test("zona restringida y fuera del plano: se bloquean con un mensaje visible", async () => {
    const { page } = maria;
    await page.getByRole("button", { name: "Ver el plano completo" }).click();
    await expect.poll(() => scaleOf(page)).toBe(1);
    // Cocina (zona sin entrega): marcador inválido y «Estoy aquí» bloqueado.
    await tap(page, await screenOf(page, { x: 0.15, y: 0.2 }), true);
    await expect(page.getByTestId("picker-summary")).toContainText(
      "En esa zona no hacemos entregas",
    );
    await expect(
      page.getByRole("button", { name: "Estoy aquí" }),
    ).toBeDisabled();
    // Fuera de la imagen (franja vacía del contenedor): mensaje y el marcador anterior se conserva.
    const box = (await viewportOf(page).boundingBox())!;
    await tap(page, { x: box.x + box.width / 2, y: box.y + 8 }, true);
    await expect(page.getByTestId("picker-summary")).toContainText(
      "fuera del plano",
    );
    await expect(
      page.getByRole("button", { name: "Estoy aquí" }),
    ).toBeDisabled();
    // Un punto válido lo habilita y deja de mostrar el error.
    await tap(page, await screenOf(page, FREE), true);
    await expect(page.getByTestId("picker-summary")).not.toContainText(
      "En esa zona",
    );
    await expect(
      page.getByRole("button", { name: "Estoy aquí" }),
    ).toBeEnabled();
  });

  test("el marcador se arrastra para corregir y la ubicación queda asociada al pedido, mapa y versión", async () => {
    const { page } = maria;
    const pin = page.locator('[data-marker-id="me"]');
    await expect(pin).toBeVisible();
    await page.waitForTimeout(450); // fuera de la ventana de doble toque del toque que lo colocó
    const start = (await pin.boundingBox())!;
    const from = {
      x: start.x + start.width / 2,
      y: start.y + start.height - 14,
    };
    // Arrastre con el dedo hacia otro punto libre.
    const target = await screenOf(page, { x: 0.47, y: 0.36 });
    await touchGesture(
      page,
      [0, 0.25, 0.5, 0.75, 1].map((t) => [
        {
          x: from.x + (target.x - from.x) * t,
          y: from.y + (target.y - from.y) * t,
        },
      ]),
    );
    const moved = (await pin.boundingBox())!;
    expect(moved.y).toBeGreaterThan(start.y + 10);
    await page.getByRole("button", { name: "Estoy aquí" }).click();
    await expect(page.getByTestId("picker-summary")).toHaveCount(0); // el selector se cerró
    await expect(page.getByTestId("checkout-location-summary")).toContainText(
      "Cerca de",
    );
    const id = await placeOrder(page);
    const order = await orderOf(page, id);
    expect(order.location).toMatchObject({
      map_id: MAP,
      map_version: expect.any(Number),
      delivery_method: "location_on_map",
    });
    expect(order.location.location.x).toBeCloseTo(0.47, 1);
    // El dedo agarró el marcador 14 px sobre la punta y lo llevó a y=0,36: la punta sigue el desplazamiento, sin saltos.
    expect(order.location.location.y).toBeGreaterThan(0.38);
    expect(order.location.location.y).toBeLessThan(0.46);
    await expect(page.getByTestId("order-location-summary")).toContainText(
      "Marcado cerca de",
    );
    await expect(page.getByTestId("order-location")).toContainText(
      "Salón principal",
    );
    await page.screenshot({
      path: "test-results/maps-order-390.png",
      fullPage: true,
    });
  });

  for (const viewport of [
    { width: 360, height: 640 },
    { width: 820, height: 1180 },
    { width: 1440, height: 900 },
  ])
    test(`el mismo punto del plano se guarda igual en ${viewport.width}×${viewport.height}`, async ({
      browser,
    }) => {
      const touch = viewport.width < 1000;
      const { context, page, errors } = await person(
        browser,
        people.maria.email,
        viewport,
        touch,
      );
      try {
        await seedCart(page, people.maria.id);
        await openPicker(page);
        const target = await screenOf(page, FREE);
        await tap(page, target, touch);
        // El marcador (la punta) cae donde se tocó, con cualquier resolución.
        const pin = (await page
          .locator('[data-marker-id="me"]')
          .boundingBox())!;
        expect(Math.abs(pin.x + pin.width / 2 - target.x)).toBeLessThan(3);
        expect(Math.abs(pin.y + pin.height - target.y)).toBeLessThan(3);
        await page.getByRole("button", { name: "Estoy aquí" }).click();
        const id = await placeOrder(page);
        const { location } = await orderOf(page, id);
        expect(location.location.x).toBeCloseTo(FREE.x, 2);
        expect(location.location.y).toBeCloseTo(FREE.y, 2);
        expect(errors).toEqual([]);
        await page.screenshot({
          path: `test-results/maps-order-${viewport.width}.png`,
          fullPage: true,
        });
      } finally {
        await context.close();
      }
    });

  test("mesa elegida en la lista: queda asociada al pedido con su zona", async ({
    browser,
  }) => {
    const { context, page } = await person(browser, people.sofia.email, {
      width: 390,
      height: 844,
    });
    try {
      await seedCart(page, people.sofia.id);
      await openPicker(page);
      await page
        .getByLabel("O elegí tu mesa")
        .selectOption({ label: "Mesa 7" });
      await expect(page.getByTestId("picker-summary")).toContainText(
        "Mesa 7 · Zona VIP",
      );
      await page.getByRole("button", { name: "Estoy aquí" }).click();
      const id = await placeOrder(page);
      const { location } = await orderOf(page, id);
      expect(location).toMatchObject({
        delivery_method: "table",
        element_label: "Mesa 7",
        zone_id: "vip",
        location: { x: 0.7, y: 0.7 },
      });
      await expect(page.getByTestId("order-location-summary")).toContainText(
        "Mesa 7 · Zona VIP",
      );
    } finally {
      await context.close();
    }
  });

  test("QR de mesa: el cliente queda ubicado sin abrir el plano", async ({
    browser,
  }) => {
    const { context, page } = await person(browser, people.sofia.email, {
      width: 390,
      height: 844,
    });
    try {
      await page.goto(`/v/sala-norte?mesa=mesa-3`);
      await expect(page.getByTestId("table-banner")).toContainText(
        "Estás en la Mesa 3",
      );
      await page
        .locator("article.prow", { hasText: "Paloma" })
        .getByRole("button", { name: "Agregar", exact: true })
        .click();
      await page.goto("/checkout");
      await expect(page.getByTestId("checkout-location-summary")).toHaveText(
        "Mesa 3",
      );
      await expect(page.getByTestId("checkout-location")).toContainText(
        "Mesa del QR que escaneaste",
      );
      await expect(page.getByTestId("location-picker")).toHaveCount(0);
      const id = await placeOrder(page);
      const { location } = await orderOf(page, id);
      expect(location).toMatchObject({
        delivery_method: "table_qr",
        element_label: "Mesa 3",
      });
    } finally {
      await context.close();
    }
  });

  test("un local sin plano no muestra el selector: retiro en barra como siempre", async ({
    browser,
  }) => {
    const { context, page } = await person(browser, people.maria.email, {
      width: 390,
      height: 844,
    });
    try {
      await page.goto("/orders");
      await page.evaluate(
        (id) =>
          localStorage.setItem(
            `onza-cart-draft:${id}`,
            JSON.stringify({
              venueId: "20000000-0000-4000-8000-000000000002",
              venueName: "Patio Central",
              venueSlug: "patio-central",
              pickupLabel: "Barra principal",
              items: [
                {
                  productId: "30000000-0000-4000-8000-000000000007",
                  name: "Paloma",
                  priceMinor: 450000,
                  version: 1,
                  quantity: 1,
                },
              ],
            }),
          ),
        people.maria.id,
      );
      await page.goto("/checkout");
      await expect(page.getByRole("button", { name: /^Pedir/ })).toBeVisible();
      await expect(page.getByTestId("checkout-location")).toHaveCount(0);
      // Y sin ubicación el pedido se hace igual.
      const id = await placeOrder(page);
      expect((await orderOf(page, id)).location ?? null).toBeNull();
    } finally {
      await context.close();
    }
  });
});

test.describe("equipo y entrega con código", () => {
  test("la barra ve la ubicación, abre el plano centrado en el cliente y solo entrega tras validar el código", async ({
    browser,
  }) => {
    // Pedido nuevo con ubicación marcada en el plano.
    const customer = await person(browser, people.maria.email, {
      width: 390,
      height: 844,
    });
    await seedCart(customer.page, people.maria.id);
    await openPicker(customer.page);
    await tap(customer.page, await screenOf(customer.page, FREE), true);
    await customer.page.getByRole("button", { name: "Estoy aquí" }).click();
    const orderId = await placeOrder(customer.page);

    const staff = await person(
      browser,
      people.jorge.email,
      { width: 1280, height: 800 },
      false,
    );
    try {
      await staff.page.goto(`/staff/${SALA}`);
      const { public_code: code } = await orderOf(customer.page, orderId);
      const card = staff.page.locator(`article[aria-label="Pedido ${code}"]`);
      await expect(card).toBeVisible();
      await expect(card.getByTestId("order-location-line")).toContainText(
        "Marcado cerca de",
      );
      await card.getByRole("button", { name: "Ver ubicación" }).click();
      const dialog = staff.page.getByTestId("staff-location");
      await expect(dialog).toBeVisible();
      await expect(planImage(staff.page)).toHaveJSProperty("complete", true);
      // El plano queda centrado sobre el marcador del cliente.
      const view = (await viewportOf(staff.page).boundingBox())!;
      const pin = (await staff.page
        .locator('[data-marker-id="customer"]')
        .boundingBox())!;
      expect(
        Math.abs(pin.x + pin.width / 2 - (view.x + view.width / 2)),
      ).toBeLessThan(60);
      expect(await scaleOf(staff.page)).toBeGreaterThan(2);
      await expect(dialog.getByTestId("landmarks").locator("li")).toHaveCount(
        3,
      );
      await expect(dialog).toContainText("QR o su código de 12 caracteres");
      await staff.page.screenshot({
        path: "test-results/maps-staff-dialog.png",
      });
      // Estado del pedido desde el propio plano.
      await dialog.getByRole("button", { name: "Aceptar" }).click();
      await expect(
        dialog.getByRole("button", { name: "Marcar listo" }),
      ).toBeVisible();
      await dialog.getByRole("button", { name: "Marcar listo" }).click();
      await expect(
        dialog.getByRole("button", { name: "Validar retiro" }),
      ).toBeVisible();

      // El cliente recibe su ticket con el código privado.
      await customer.page.reload();
      const ticket = (
        await customer.page.locator('[data-private="pickup"]').innerText()
      ).replace(/\s+/g, "");
      expect(ticket).toMatch(/^[0-9A-F]{12}$/i);
      // Con el equipo ya en camino el cliente ve que no puede mover su ubicación... hasta validar el código no hay reclamo.
      await expect(
        customer.page
          .getByTestId("order-location")
          .getByRole("button", { name: "Cambiar" }),
      ).toBeVisible();

      // Validar retiro: un código equivocado no entrega; el correcto abre el cobro y la entrega.
      await dialog.getByRole("button", { name: "Validar retiro" }).click();
      await staff.page.getByLabel("Código privado").fill("AAAAAAAAAAAA");
      await staff.page
        .getByRole("button", { name: "Validar", exact: true })
        .click();
      await expect(staff.page.getByRole("alert")).toContainText(
        /no es válido/i,
      );
      await expect(
        staff.page.getByRole("button", { name: "Confirmar entrega" }),
      ).toHaveCount(0);
      await staff.page.getByLabel("Código privado").fill(ticket);
      await staff.page
        .getByRole("button", { name: "Validar", exact: true })
        .click();
      // Aún no se puede marcar entregado: falta el cobro y la entrega física.
      await expect(
        staff.page.getByRole("button", { name: "Confirmar entrega" }),
      ).toBeDisabled();
      await staff.page
        .getByRole("button", { name: /Confirmar cobro simulado/ })
        .click();
      await staff.page
        .getByLabel("Entregué físicamente el pedido completo.")
        .check();
      await staff.page
        .getByRole("button", { name: "Confirmar entrega" })
        .click();
      await expect
        .poll(async () => (await orderOf(customer.page, orderId)).status)
        .toBe("delivered");
      // La ubicación queda en el historial del pedido entregado, ya sin posibilidad de cambiarla.
      const delivered = await orderOf(customer.page, orderId);
      expect(delivered.location.map_version).toBeGreaterThanOrEqual(1);
      await customer.page.reload();
      await expect(
        customer.page.getByTestId("order-location-summary"),
      ).toContainText("Marcado cerca de");
      await expect(
        customer.page.getByRole("button", { name: "Cambiar" }),
      ).toHaveCount(0);
    } finally {
      await staff.context.close();
      await customer.context.close();
    }
  });
});

/** PNG sin dependencias: un degradado a color, de tamaño arbitrario. */
function makePng(width: number, height: number) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    for (let x = 0; x < width; x++) {
      raw[row + 1 + x * 3] = (x * 255) / width;
      raw[row + 2 + x * 3] = (y * 255) / height;
      raw[row + 3 + x * 3] = 180;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

test.describe("administración", () => {
  let admin: Awaited<ReturnType<typeof person>>;
  test.beforeAll(async ({ browser }) => {
    admin = await person(
      browser,
      people.ana.email,
      { width: 1440, height: 900 },
      false,
    );
  });
  test.afterAll(async () => {
    await admin.context.close();
  });

  test("editor: colocar una mesa tocando el plano, dibujar una zona, guardar y publicar sin tocar pedidos anteriores", async ({
    browser,
  }) => {
    // Pedido hecho ANTES de publicar: debe conservar su versión.
    const customer = await person(browser, people.maria.email, {
      width: 390,
      height: 844,
    });
    await seedCart(customer.page, people.maria.id);
    await openPicker(customer.page);
    await tap(customer.page, await screenOf(customer.page, FREE), true);
    await customer.page.getByRole("button", { name: "Estoy aquí" }).click();
    const before = await orderOf(
      customer.page,
      await placeOrder(customer.page),
    );
    const oldVersion = before.location.map_version as number;

    const { page } = admin;
    await page.goto(`/admin/${SALA}?tab=mapas`);
    await expect(page.getByTestId("map-card").first()).toContainText(
      "Salón principal",
    );
    await page
      .getByTestId("map-card")
      .filter({ hasText: "Salón principal" })
      .getByRole("button", { name: "Editar" })
      .click();
    await expect(page.getByTestId("map-editor")).toBeVisible();
    await expect(planImage(page)).toHaveJSProperty("complete", true);
    const tablesBefore = await page.locator("[data-marker-id^='e-']").count();
    // Herramienta Mesa → tocar el plano: aparece la mesa siguiente, sin escribir coordenadas.
    await page.locator('[data-tool="table"]').click();
    await tap(page, await screenOf(page, { x: 0.47, y: 0.3 }), false);
    await expect(page.getByTestId("element-inspector")).toBeVisible();
    await expect(
      page.getByTestId("element-inspector").getByLabel("Nombre"),
    ).toHaveValue("Mesa 9");
    await expect(page.locator("[data-marker-id^='e-']")).toHaveCount(
      tablesBefore + 1,
    );
    // Zona rectangular con dos toques; queda seleccionada y se puede marcar «sin entrega».
    await page.locator('[data-tool="rect"]').click();
    await tap(page, await screenOf(page, { x: 0.05, y: 0.6 }), false);
    await tap(page, await screenOf(page, { x: 0.15, y: 0.75 }), false);
    const zoneInspector = page.getByTestId("zone-inspector");
    await expect(zoneInspector).toBeVisible();
    await zoneInspector.getByLabel("Nombre de la zona").fill("Pasillo cerrado");
    await zoneInspector
      .getByRole("combobox", { name: /^Entrega/ })
      .selectOption("restrict");
    await expect(page.getByText("Cambios sin guardar").first()).toBeVisible();
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page.getByText("Borrador guardado.")).toBeVisible();
    // Publicar con confirmación explícita sobre los pedidos anteriores.
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "conservan su ubicación",
    );
    await page.getByRole("button", { name: /^Publicar versión/ }).click();
    await expect(page.getByText(/Versión \d+ publicada/)).toBeVisible();

    // El pedido anterior sigue en SU versión y en su punto.
    await customer.page.reload();
    const after = await orderOf(customer.page, before.id);
    expect(after.location.map_version).toBe(oldVersion);
    expect(after.location.location).toEqual(before.location.location);
    await expect(
      customer.page.getByTestId("order-location").locator("img").first(),
    ).toHaveJSProperty("complete", true);
    // Un pedido nuevo usa la versión vigente, con la mesa nueva y la zona nueva.
    const fresh = await person(browser, people.sofia.email, {
      width: 390,
      height: 844,
    });
    try {
      await seedCart(fresh.page, people.sofia.id);
      await openPicker(fresh.page);
      await expect(fresh.page.locator("[data-marker-id^='e-']")).toHaveCount(
        tablesBefore + 1,
      );
      await tap(
        fresh.page,
        await screenOf(fresh.page, { x: 0.1, y: 0.68 }),
        true,
      );
      await expect(fresh.page.getByTestId("picker-summary")).toContainText(
        "En esa zona no hacemos entregas",
      ); // zona recién publicada
      await tap(fresh.page, await screenOf(fresh.page, FREE), true);
      await fresh.page.getByRole("button", { name: "Estoy aquí" }).click();
      const created = await orderOf(fresh.page, await placeOrder(fresh.page));
      expect(created.location.map_version).toBe(oldVersion + 1);
    } finally {
      await fresh.context.close();
      await customer.context.close();
    }
  });

  test("duplicar una edición anterior crea un borrador con el mismo plano y fecha nueva", async () => {
    const { page } = admin;
    await page.goto(`/admin/${SALA}?tab=mapas`);
    await page
      .getByTestId("map-card")
      .filter({ hasText: "Salón principal" })
      .getByRole("button", { name: "Duplicar" })
      .click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel("Nombre del mapa").fill("Festival 2027");
    await sheet
      .getByRole("group", { name: "Tipo de mapa" })
      .getByRole("button", { name: "Edición de evento" })
      .click();
    await sheet.getByLabel("Evento").fill("Festival de la Cerveza");
    await sheet.getByLabel("Sede").fill("Sede Norte");
    await sheet.getByLabel("Fecha de la edición").fill("2027-03-12");
    await sheet.getByRole("button", { name: "Duplicar y editar" }).click();
    await expect(page.getByTestId("map-editor")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Festival 2027" }),
    ).toBeVisible();
    await expect(
      page.getByText("Borrador", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByTestId("item-list")).toContainText("Mesa 9");
    await expect(page.getByTestId("item-list")).toContainText(
      "Pasillo cerrado",
    );
    // La edición de otra fecha no se ofrece a los clientes esta noche.
    const sofia = await person(page.context().browser()!, people.sofia.email, {
      width: 390,
      height: 844,
    });
    try {
      const response = await sofia.page.request.get(`/api/maps?venue=${SALA}`);
      const names = ((await response.json()) as { name: string }[]).map(
        (m) => m.name,
      );
      expect(names).toContain("Salón principal");
      expect(names).not.toContain("Festival 2027");
    } finally {
      await sofia.context.close();
    }
  });

  test("subida del plano: se optimiza a WebP de máximo 2400 px y se rechazan archivos peligrosos o falsos", async () => {
    const { page } = admin;
    const uploads: { type: string; bytes: Buffer }[] = [];
    const stored = new Map<string, { type: string; bytes: Buffer }>();
    // Storage simulado (el shim no lo tiene): conserva lo que se sube y lo sirve de vuelta.
    await page.route("**/storage/v1/object/venue-maps/**", async (route) => {
      const request = route.request();
      const body = request.postDataBuffer()!;
      const boundary = /boundary=(.+)$/.exec(
        (await request.headerValue("content-type")) ?? "",
      )![1];
      const part = body
        .toString("latin1")
        .split(`--${boundary}`)
        .find((p) => /content-type: image\//i.test(p))!;
      const type = /content-type: (image\/[\w+.-]+)/i.exec(part)![1];
      const start = part.indexOf("\r\n\r\n") + 4;
      const file = Buffer.from(
        part.slice(start, part.lastIndexOf("\r\n")),
        "latin1",
      );
      const key = decodeURIComponent(
        new URL(request.url()).pathname.split("/venue-maps/")[1],
      );
      uploads.push({ type, bytes: file });
      stored.set(key, { type, bytes: file });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ Key: `venue-maps/${key}` }),
      });
    });
    await page.route(
      "**/storage/v1/object/public/venue-maps/**",
      async (route) => {
        const key = decodeURIComponent(
          new URL(route.request().url()).pathname.split("/venue-maps/")[1],
        );
        const item = stored.get(key);
        await route.fulfill(
          item
            ? { status: 200, contentType: item.type, body: item.bytes }
            : { status: 404 },
        );
      },
    );
    const saved: Record<string, unknown>[] = [];
    page.on("request", (r) => {
      if (r.url().endsWith("/api/maps") && r.method() === "POST")
        saved.push(JSON.parse(r.postData() ?? "{}"));
    });

    await page.goto(`/admin/${SALA}?tab=mapas`);
    await page.getByRole("button", { name: "Nuevo mapa" }).click();
    await page
      .getByRole("dialog")
      .getByLabel("Nombre del mapa")
      .fill("Terraza");
    await page.getByRole("button", { name: "Crear y editar" }).click();
    await expect(page.getByTestId("map-editor")).toBeVisible();
    const input = page.getByTestId("map-image-input");

    // Archivos que no son planos: ni siquiera salen del navegador.
    await input.setInputFiles({
      name: "plano.png",
      mimeType: "image/png",
      buffer: Buffer.from("<html><script>alert(1)</script></html>"),
    });
    await expect(
      page.getByText("no es una imagen JPG, PNG, WebP o SVG válida"),
    ).toBeVisible();
    await input.setInputFiles({
      name: "malo.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script></svg>',
      ),
    });
    await expect(
      page.getByText("elemento no permitido: <script>"),
    ).toBeVisible();
    await input.setInputFiles({
      name: "externo.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image href="https://evil.example/x.png"/></svg>',
      ),
    });
    await expect(page.getByText("referencia archivos externos")).toBeVisible();
    expect(uploads).toHaveLength(0);

    // Un PNG grande se reduce y se recodifica antes de subir.
    const png = makePng(3600, 2000);
    await input.setInputFiles({
      name: "plano-grande.png",
      mimeType: "image/png",
      buffer: png,
    });
    await expect(page.getByText(/Plano subido/)).toBeVisible({
      timeout: 20000,
    });
    expect(uploads).toHaveLength(1);
    expect(uploads[0].type).toBe("image/webp");
    expect(uploads[0].bytes.subarray(0, 4).toString()).toBe("RIFF");
    expect(uploads[0].bytes.length).toBeLessThan(png.length);
    await expect(planImage(page)).toHaveJSProperty("complete", true);
    expect(
      await planImage(page).evaluate((img: HTMLImageElement) => [
        img.naturalWidth,
        img.naturalHeight,
      ]),
    ).toEqual([2400, 1333]);
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page.getByText("Borrador guardado.")).toBeVisible();
    const save = saved.find((b) => b.action === "map_save_draft")!;
    expect(save).toMatchObject({ imageWidth: 2400, imageHeight: 1333 });
    expect(String(save.imagePath)).toMatch(
      new RegExp(`^${SALA}/[0-9a-f-]{36}\\.webp$`),
    );

    // Un SVG seguro se acepta tal cual.
    const safeSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600"><rect width="1200" height="600" fill="#eee"/><text x="20" y="40">Terraza</text></svg>';
    await input.setInputFiles({
      name: "terraza.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(safeSvg),
    });
    await expect.poll(() => uploads.length).toBe(2);
    expect(uploads[1].type).toBe("image/svg+xml");
    expect(uploads[1].bytes.toString()).toBe(safeSvg);
  });
});
