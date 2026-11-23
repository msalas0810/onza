import { mkdirSync } from "node:fs";
import { loginStaff as login } from "./helpers/auth";
import { test, expect } from "@playwright/test";
const venue = "20000000-0000-4000-8000-000000000001";
const live = process.env.E2E_LIVE === "true";
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
  const bartender = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  const competitor = await browser.newContext();
  const administrator = await browser.newContext();
  try {
    const a = await customer.newPage();
    let readyEvent!: () => void;
    const readySignal = new Promise<void>((resolve) => {
      readyEvent = resolve;
    });
    a.on("websocket", (socket) =>
      socket.on("framereceived", (frame) => {
        if (
          typeof frame.payload === "string" &&
          /"status"\s*:\s*"ready"/.test(frame.payload)
        )
          readyEvent();
      }),
    );
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
    await a.getByRole("button", { name: /^Pedir/ }).click();
    const original = (await submitted).postDataJSON();
    // La confirmación con el vasito dura ~2 s antes de pasar al seguimiento; el servidor de desarrollo compila la ruta al entrar.
    await expect(
      a.locator(".badge", { hasText: "Recibido · esperando al local" }),
    ).toBeVisible({ timeout: 45000 });
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
    const card = b.locator("article.ocard", {
      hasText: `#${order.public_code}`,
    });
    await card.getByRole("button", { name: "Aceptar", exact: true }).click();
    await expect(a.locator(".badge", { hasText: "Preparando" })).toBeVisible({
      timeout: 25000,
    });
    await a.reload();
    await expect(a.locator(".badge", { hasText: "Preparando" })).toBeVisible();
    // Hold an old preparing snapshot while the real ready event arrives. The
    // pending refetch must run after this response, without connected polling.
    let release!: () => void, fetched!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const snapshotFetched = new Promise<void>((resolve) => {
      fetched = resolve;
    });
    let first = true;
    await a.route(`**/api/orders?order=${orderId}`, async (route) => {
      const response = await route.fetch();
      if (first) {
        first = false;
        fetched();
        await held;
      }
      await route.fulfill({ response });
    });
    await a.evaluate(() =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    await snapshotFetched;
    await card.getByRole("button", { name: "Marcar listo" }).click();
    await readySignal;
    release();
    await expect(
      a.locator(".badge", { hasText: "Listo para retirar" }),
    ).toBeVisible({ timeout: 25000 });
    await expect(a.getByAltText("QR de autorización de retiro")).toBeVisible();
    await a.unroute(`**/api/orders?order=${orderId}`);
    mkdirSync("docs/evidence/hosted-ux", { recursive: true });
    await a.emulateMedia({ colorScheme: "dark" });
    await a.addStyleTag({ content: "nextjs-portal{display:none}" });
    await a.screenshot({
      path: "docs/evidence/hosted-ux/ticket-390-dark-redacted.png",
      mask: [a.locator(".ticket img,.ticket .code")],
      maskColor: "#66666D",
    });
    await b.evaluate(() => window.scrollTo(0, 0));
    await b.addStyleTag({ content: "nextjs-portal{display:none}" });
    await b.screenshot({ path: "docs/evidence/hosted-ux/staff-1440-dark.png" });
    const ticketResponse = await a.request.get(`/api/orders?order=${orderId}`);
    const ticket = (await ticketResponse.json())[0];
    expect(Boolean(ticket.pickup_code)).toBe(true);
    const headers = { origin: "http://127.0.0.1:3000" };
    const staffList = await b.request.get(`/api/orders?venue=${venue}`);
    const staffOrder = (await staffList.json()).find(
      (o: { id: string }) => o.id === orderId,
    );
    expect(
      Boolean(
        staffOrder.pickup_code ||
        staffOrder.pickup_token ||
        staffOrder.encrypted_token ||
        staffOrder.qr_data_url,
      ),
    ).toBe(false);
    for (const input of [
      { venueId: venue, code: order.public_code },
      { venueId: venue, code: "000000000000" },
      {
        venueId: "20000000-0000-4000-8000-000000000002",
        code: ticket.pickup_code,
      },
    ]) {
      const invalid = await b.request.post("/api/commands", {
        headers,
        data: { action: "resolve", ...input },
      });
      expect(invalid.ok()).toBe(false);
    }
    const request = {
      headers: { origin: "http://127.0.0.1:3000" },
      data: { action: "resolve", venueId: venue, code: ticket.pickup_code },
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

    await owner.goto(`/staff/${venue}`);
    const incident = owner.locator(".notice", {
      hasText: `#${order.public_code}`,
    });
    await incident
      .getByRole("button", { name: "Retomar entrega", exact: true })
      .click();
    await expect(
      owner.getByText("Cobro confirmado (simulado).", { exact: true }),
    ).toBeVisible();
    // Al retomar, el formulario de código no se muestra: no queda ninguna credencial a la vista.
    await expect(owner.getByLabel("Código privado")).toHaveCount(0);
    await owner
      .getByRole("checkbox", {
        name: "Entregué físicamente el pedido completo.",
      })
      .check();
    await owner
      .getByRole("button", { name: "Confirmar entrega", exact: true })
      .click();
    await expect(owner.locator(".result.ok")).toContainText(
      `Entregado #${order.public_code}`,
    );
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
    const consumed = await owner.request.post("/api/commands", request);
    expect(consumed.ok()).toBe(false);
    expect((await consumed.json()).error).toBe("ALREADY_DELIVERED");
    await a.reload();
    await expect(a.locator(".badge", { hasText: "Entregado" })).toBeVisible();
    await login(admin, "ADMIN");
    await admin.goto(`/admin/${venue}`);
    await expect(
      admin.getByRole("heading", { name: "Resumen", exact: true }),
    ).toBeVisible();
    // Los productos entregados viven en una hoja que se abre desde «Productos».
    await admin.getByRole("button", { name: /^Productos/ }).click();
    await expect(
      admin
        .getByRole("dialog", { name: "Productos entregados" })
        .getByText("Paloma", { exact: true }),
    ).toBeVisible();
  } finally {
    await Promise.all([
      customer.close(),
      bartender.close(),
      competitor.close(),
      administrator.close(),
    ]);
  }
});
