import { test, expect } from "@playwright/test";
const live = process.env.E2E_LIVE === "true";
test.beforeEach(() =>
  test.skip(
    !live,
    "Requires configured real onza-dev; no backend replacement.",
  ),
);
test("carrito real: cantidades, quitar, vaciar/refrescar, conservar/reemplazar local y dock", async ({
  page,
}) => {
  await page.goto("/v/sala-norte");
  const product = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Paloma", exact: true }),
  });
  await product.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(page.getByRole("link", { name: /1 producto/ })).toBeVisible();
  await product.getByRole("button", { name: "Agregar una unidad" }).click();
  await expect(page.getByRole("link", { name: /2 productos/ })).toBeVisible();
  await page.goto("/v/sala-norte/p/30000000-0000-4000-8000-000000000001");
  await expect(page.getByRole("link", { name: /Ver carrito/ })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Ver carrito/ })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Carrito de Sala Norte/ }),
  ).toBeVisible();
  const cards = page.locator(".vcard");
  expect(await cards.last().getByText("Cerrado", { exact: true }).count()).toBe(
    1,
  );
  expect(await cards.last().evaluate((e) => e.tagName)).not.toBe("A");
  await page.goto("/v/patio-central");
  await expect(page.getByRole("link", { name: /Ver carrito/ })).toHaveCount(0);
  const patio = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Paloma", exact: true }),
  });
  await patio.getByRole("button", { name: "Agregar", exact: true }).click();
  await page.getByRole("button", { name: "Conservar mi carrito" }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          Object.entries(localStorage).find(([k]) =>
            k.startsWith("onza-cart-draft"),
          )?.[1] ?? null!,
        ).venueSlug,
    ),
  ).toBe("sala-norte");
  await patio.getByRole("button", { name: "Agregar", exact: true }).click();
  await page.getByRole("button", { name: "Vaciar y cambiar de local" }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          Object.entries(localStorage).find(([k]) =>
            k.startsWith("onza-cart-draft"),
          )?.[1] ?? null!,
        ).venueSlug,
    ),
  ).toBe("patio-central");
  await page.goto("/cart");
  await page
    .getByRole("button", { name: "Quitar Paloma", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Tu carrito está vacío" }),
  ).toBeVisible();
  await page.goto("/v/sala-norte");
  await page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Paloma", exact: true }) })
    .getByRole("button", { name: "Agregar", exact: true })
    .click();
  await page.goto("/cart");
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "Vaciar carrito", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Paloma" })).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Vaciar carrito", exact: true })
    .click();
  await page.reload();
  expect(
    await page.evaluate(
      () =>
        Object.entries(localStorage).find(([k]) =>
          k.startsWith("onza-cart-draft"),
        )?.[1] ?? null,
    ),
  ).toBeNull();
  await page.goto("/v/club-cero");
  await expect(page.getByText(/Este local está cerrado/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Agregar", exact: true }),
  ).toHaveCount(0);
});
for (const mode of ["accepted", "denied", "imprecise", "timeout"] as const)
  test(`ubicación ${mode}: permiso emulado, catálogo real sin coordenadas`, async ({
    page,
  }) => {
    await page.addInitScript((mode) => {
      Object.defineProperty(navigator, "geolocation", {
        value: {
          getCurrentPosition: (
            ok: (v: unknown) => void,
            fail: (e: unknown) => void,
          ) => {
            if (mode === "denied" || mode === "timeout")
              fail({ code: mode === "denied" ? 1 : 3 });
            else
              ok({
                coords: {
                  latitude: 9.93,
                  longitude: -84.08,
                  accuracy: mode === "imprecise" ? 2000 : 20,
                },
              });
          },
        },
      });
    }, mode);
    await page.goto("/");
    await page
      .getByRole("button", { name: "Usar mi ubicación", exact: true })
      .click();
    await expect(page.locator(".notice, .row").first()).toContainText(
      mode === "denied"
        ? "Sin permiso de ubicación"
        : mode === "timeout"
          ? "tardó demasiado"
          : mode === "imprecise"
            ? "demasiado imprecisa"
            : "Ubicación activa",
    );
    if (mode === "accepted") {
      await expect(
        page.getByText(
          /No encontramos locales abiertos con ubicación confirmada/,
        ),
      ).toBeVisible();
      await expect(page.getByText("Más cerca", { exact: true })).toHaveCount(0);
    }
    await page.getByLabel("Buscar local").fill("Sala Norte");
    await expect(page.locator(".vcard")).toHaveCount(1);
    expect(
      await page.evaluate(() =>
        Object.keys(localStorage).some((k) =>
          /location|latitude|longitude/.test(k),
        ),
      ),
    ).toBe(false);
  });
test("layout real 360/390/1440 claro y oscuro, ajustes y foco", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/v/sala-norte");
  await page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Paloma", exact: true }) })
    .getByRole("button", { name: "Agregar", exact: true })
    .click();
  await expect(page.locator(".dock")).toBeVisible();
  const failures: string[] = [];
  page.on("pageerror", () => failures.push("runtime error"));
  for (const width of [360, 390, 1440])
    for (const theme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      for (const route of [
        "/",
        "/v/sala-norte",
        "/v/sala-norte/p/30000000-0000-4000-8000-000000000001",
        "/cart",
        "/checkout",
        "/orders",
        "/settings",
      ]) {
        await page.goto(route);
        if (route === "/v/sala-norte") {
          const row = page.locator("article").filter({
            has: page.getByRole("heading", { name: "Paloma", exact: true }),
          });
          await expect(
            row.getByRole("status", { name: "Cantidad" }),
          ).toHaveText("1");
          await expect(page.locator(".dock")).toBeVisible();
          await page.evaluate(async () => {
            window.scrollTo(0, document.documentElement.scrollHeight);
            await new Promise(requestAnimationFrame);
            await new Promise(requestAnimationFrame);
          });
          const last = await page.locator("article.prow").last().boundingBox(),
            dock = await page.locator(".dock").boundingBox();
          expect(last!.y + last!.height).toBeLessThan(dock!.y);
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
    }
  await page.getByRole("button", { name: "Oscuro", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Sistema", exact: true }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe(
    "BODY",
  );
  expect(failures).toHaveLength(0);
});

test("onza-dev: aceptar/cancelar concurrentes, cancelación posterior denegada y locales cerrados/pausados", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const { loginStaff } = await import("./helpers/auth");
  const client = await browser.newContext();
  const bar = await browser.newContext();
  const a = await client.newPage(),
    b = await bar.newPage();
  const venue = "20000000-0000-4000-8000-000000000001";
  const headers = { origin: "http://127.0.0.1:3000" };
  const post = (page: typeof a, data: Record<string, unknown>) =>
    page.request.post("/api/commands", { headers, data });
  try {
    await loginStaff(b);
    await a.goto("/v/sala-norte/p/30000000-0000-4000-8000-000000000001");
    await a.getByRole("button", { name: "Agregar", exact: true }).click();
    await a.goto("/checkout");
    await a.getByRole("checkbox").nth(0).check();
    await a.getByRole("checkbox").nth(1).check();
    await a.getByRole("button", { name: /^Pedir/ }).click();
    await expect(
      a.getByRole("heading", { name: "Pedido recibido", exact: true }),
    ).toBeVisible();
    const orderId = new URL(a.url()).pathname.split("/").at(-1)!;
    const original = (
      await (await a.request.get(`/api/orders?order=${orderId}`)).json()
    )[0];
    expect(Boolean(original?.id)).toBe(true);
    const catalog = await (
      await a.request.get(`/api/catalog?venue=${venue}`)
    ).json();
    const productVersion = catalog.find(
      (p: { id: string }) => p.id === "30000000-0000-4000-8000-000000000001",
    ).version;
    const input = {
      action: "create",
      venueId: venue,
      items: [
        {
          productId: "30000000-0000-4000-8000-000000000001",
          quantity: 1,
          expectedProductVersion: productVersion,
        },
      ],
      termsVersion: "demo-v1",
      privacyVersion: "demo-v1",
      adult: true,
      scenario: "approved",
    };
    for (let i = 0; i < 3; i++) {
      const o =
        i === 0
          ? original
          : await (
              await post(a, { ...input, idempotencyKey: crypto.randomUUID() })
            ).json();
      expect(Boolean(o?.id), o?.error ?? "order missing").toBe(true);
      const results = await Promise.all([
        post(a, {
          action: "cancel",
          orderId: o.id,
          expectedVersion: 1,
          idempotencyKey: crypto.randomUUID(),
          reason: "Prueba demo carrera",
        }),
        post(b, {
          action: "accept",
          orderId: o.id,
          expectedVersion: 1,
          idempotencyKey: crypto.randomUUID(),
        }),
      ]);
      expect(
        results.filter((r) => r.ok()).length,
        JSON.stringify(
          await Promise.all(
            results.map(async (r) => ({
              status: r.status(),
              error: (await r.json()).error,
            })),
          ),
        ),
      ).toBe(1);
      const current = await (
        await post(a, { action: "get", orderId: o.id })
      ).json();
      if (current.status === "preparing") {
        const denied = await post(a, {
          action: "cancel",
          orderId: o.id,
          expectedVersion: current.version,
          idempotencyKey: crypto.randomUUID(),
          reason: "Prueba demo posterior",
        });
        expect(denied.ok()).toBe(false);
        await a.goto(`/orders/${o.id}`);
        await expect(
          a.getByRole("button", { name: "Cancelar pedido", exact: true }),
        ).toHaveCount(0);
        await post(b, {
          action: "cancel",
          orderId: o.id,
          expectedVersion: current.version,
          idempotencyKey: crypto.randomUUID(),
          reason: "Cierre demo de verificación",
        });
      } else expect(current.status).toBe("canceled");
    }
    const closed = await post(a, {
      ...input,
      venueId: "20000000-0000-4000-8000-000000000003",
      idempotencyKey: crypto.randomUUID(),
    });
    expect((await closed.json()).error).toBe("VENUE_CLOSED");
    const initial = await (
      await b.request.get(`/api/catalog?venue=${venue}`)
    ).json();
    expect(Array.isArray(initial)).toBe(true);
    try {
      expect(
        (
          await post(b, {
            action: "venue_update",
            venueId: venue,
            paused: true,
          })
        ).ok(),
      ).toBe(true);
      await a.goto("/v/sala-norte");
      await expect(
        a.getByText("Pedidos pausados", { exact: true }),
      ).toBeVisible();
      await expect(
        a.locator("article").getByRole("button").first(),
      ).toBeDisabled();
      const paused = await post(a, {
        ...input,
        idempotencyKey: crypto.randomUUID(),
      });
      expect((await paused.json()).error).toBe("VENUE_PAUSED");
    } finally {
      await post(b, { action: "venue_update", venueId: venue, paused: false });
    }
  } finally {
    await client.close();
    await bar.close();
  }
});

test("vencimiento real con Realtime conectado: refresco puntual, sin polling continuo", async ({
  page,
}) => {
  test.setTimeout(165000);
  let reads = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/orders?order=")) reads++;
  });
  await page.goto("/v/sala-norte/p/30000000-0000-4000-8000-000000000001");
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  await page.goto("/checkout");
  await page.getByRole("checkbox").nth(0).check();
  await page.getByRole("checkbox").nth(1).check();
  await page.getByRole("button", { name: /^Pedir/ }).click();
  await expect(
    page.getByRole("heading", { name: "Pedido recibido", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(31000);
  expect(reads).toBeLessThanOrEqual(3);
  await expect(
    page.getByRole("heading", { name: "Pedido vencido", exact: true }),
  ).toBeVisible({ timeout: 110000 });
});

test("login real del personal desde formulario", async ({ page }) => {
  await page.goto("/equipo/acceso");
  await page
    .getByLabel("Correo del trabajo")
    .fill(process.env.DEMO_BARTENDER_EMAIL!);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.DEMO_BARTENDER_PASSWORD!);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(/\/(staff\/|equipo\/locales)/);
});
