import { test, expect, type Page } from "@playwright/test";
const venue = "20000000-0000-4000-8000-000000000001";
const live = process.env.E2E_LIVE === "true";
async function login(page: Page, alias = "BARTENDER") {
  await page.goto("/login");
  await page
    .getByLabel("Correo del personal")
    .fill(process.env[`DEMO_${alias}_EMAIL`]!);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env[`DEMO_${alias}_PASSWORD`]!);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tus espacios de trabajo" }),
  ).toBeVisible();
}
test("Supabase real: cliente → barra → retiro concurrente → administrador", async ({
  browser,
}) => {
  test.skip(
    !live,
    "Requiere Supabase local real y .env.local; no se sustituye por mocks.",
  );
  test.setTimeout(180000);
  const customer = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const bartender = await browser.newContext();
  const competitor = await browser.newContext();
  const administrator = await browser.newContext();
  try {
    const a = await customer.newPage();
    const b = await bartender.newPage();
    const c = await competitor.newPage();
    const admin = await administrator.newPage();
    await a.goto("/v/sala-norte/p/30000000-0000-4000-8000-000000000001");
    await a.getByRole("button", { name: "Agregar", exact: true }).click();
    await a.goto("/checkout");
    await a.getByRole("checkbox").nth(0).check();
    await a.getByRole("checkbox").nth(1).check();
    const submitted = a.waitForRequest(
      (request) =>
        request.url().endsWith("/api/commands") && request.method() === "POST",
    );
    await a.getByRole("button", { name: /Confirmar y reservar/ }).click();
    const original = (await submitted).postDataJSON();
    await expect(
      a.getByRole("heading", { name: "Pedido recibido", exact: true }),
    ).toBeVisible();
    const orderId = new URL(a.url()).pathname.split("/").at(-1)!;
    const duplicates = await Promise.all([
      a.request.post("/api/commands", {
        headers: { origin: "http://127.0.0.1:3000" },
        data: original,
      }),
      a.request.post("/api/commands", {
        headers: { origin: "http://127.0.0.1:3000" },
        data: original,
      }),
    ]);
    for (const response of duplicates)
      expect((await response.json()).id).toBe(orderId);

    await login(b);
    await login(c);
    await b.goto(`/staff/${venue}`);
    const orders = await a.request.get("/api/orders");
    const list = await orders.json();
    const order = list.find((o: { id: string }) => o.id === orderId);
    const card = b.locator("article").filter({
      has: b.getByRole("heading", {
        name: `#${order.public_code}`,
        exact: true,
      }),
    });
    await card.getByRole("button", { name: "Aceptar y preparar" }).click();
    await expect(
      a.getByRole("heading", { name: "Preparando", exact: true }),
    ).toBeVisible({ timeout: 25000 });
    await a.reload();
    await expect(
      a.getByRole("heading", { name: "Preparando", exact: true }),
    ).toBeVisible();
    await card.getByRole("button", { name: "Marcar listo" }).click();
    await expect(
      a.getByRole("heading", { name: "Listo para recoger", exact: true }),
    ).toBeVisible({ timeout: 25000 });
    await expect(a.getByAltText("QR de autorización de retiro")).toBeVisible();
    const request = {
      headers: { origin: "http://127.0.0.1:3000" },
      data: { action: "resolve", venueId: venue, code: order.public_code },
    };
    const results = await Promise.all([
      b.request.post("/api/commands", request),
      c.request.post("/api/commands", request),
    ]);
    const claims = await Promise.all(results.map((r) => r.json()));
    expect(claims.filter((r) => r.claim_id)).toHaveLength(1);
    expect(claims.filter((r) => r.claimed_elsewhere)).toHaveLength(1);
    const owner = claims[0].claim_id ? b : c;
    const other = owner === b ? c : b;
    const claim = claims.find((r) => r.claim_id);
    const capture = {
      action: "capture",
      orderId,
      claimId: claim.claim_id,
      scenario: "timeout_after_success",
    };
    const blocked = await other.request.post("/api/commands", {
      headers: request.headers,
      data: capture,
    });
    expect(blocked.status()).toBe(409);
    const unknown = await owner.request.post("/api/commands", {
      headers: request.headers,
      data: capture,
    });
    expect((await unknown.json()).payment_state).toBe("unknown");
    const reconciled = await owner.request.post("/api/commands", {
      headers: request.headers,
      data: { action: "reconcile", orderId, claimId: claim.claim_id },
    });
    expect((await reconciled.json()).payment_state).toBe("captured");
    const captureReplays = await Promise.all([
      owner.request.post("/api/commands", {
        headers: request.headers,
        data: { ...capture, scenario: "approved" },
      }),
      owner.request.post("/api/commands", {
        headers: request.headers,
        data: { ...capture, scenario: "approved" },
      }),
    ]);
    for (const replay of captureReplays)
      expect((await replay.json()).payment_state).toBe("captured");

    const complete = {
      action: "complete",
      orderId,
      claimId: claim.claim_id,
      physicalHandoff: true,
    };
    for (let i = 0; i < 2; i++) {
      const done = await owner.request.post("/api/commands", {
        headers: request.headers,
        data: complete,
      });
      expect((await done.json()).status).toBe("delivered");
    }
    await a.reload();
    await expect(
      a.getByRole("heading", { name: "Entregado", exact: true }),
    ).toBeVisible();
    await login(admin, "ADMIN");
    await admin.goto(`/admin/${venue}`);
    await expect(
      admin.getByRole("heading", { name: "Ventas de Onza" }),
    ).toBeVisible();
    await expect(admin.getByText("Paloma", { exact: true })).toBeVisible();
    await admin.screenshot({
      path: "test-results/admin-live.png",
      fullPage: true,
    });
  } finally {
    await Promise.all([
      customer.close(),
      bartender.close(),
      competitor.close(),
      administrator.close(),
    ]);
  }
});
