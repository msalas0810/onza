// Explicit existing Preview only; no screenshots, credentials, tokens or request dumps.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const origin = process.argv[2];
if (origin !== "https://onza-demo.vercel.app")
  throw new Error("Expected the reviewed Onza Preview URL");
if (
  process.env.NEXT_PUBLIC_SUPABASE_URL !==
    "https://ukdjuubekpanizcmppod.supabase.co" ||
  process.env.PAYMENT_PROVIDER !== "mock" ||
  process.env.REAL_PAYMENTS_ENABLED !== "false"
)
  throw new Error("Expected onza-dev and mock payments");
const venue = "20000000-0000-4000-8000-000000000001";
const browser = await chromium.launch({ channel: "chrome" });
const customer = await browser.newContext({
    viewport: { width: 390, height: 844 },
  }),
  bar = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const checks = [];
const check = (name, ok) => {
  checks.push({ name, passed: !!ok });
  console.log(JSON.stringify({check: name, passed: !!ok}));
  if (!ok) throw new Error(`CHECK_FAILED: ${name}`);
};
let runtimeErrors = 0;
try {
  const a = await customer.newPage(),
    b = await bar.newPage();
  a.on("pageerror", () => runtimeErrors++);
  b.on("pageerror", () => runtimeErrors++);
  await a.goto(origin);
  check("accounts required at public entry", new URL(a.url()).pathname === "/acceso");
  await a.getByText("Continuar con correo", { exact: true }).click();
  await a.getByLabel("Correo", { exact: true }).fill(process.env.DEMO_CUSTOMER_EMAIL);
  await a.getByLabel("Contraseña", { exact: true }).fill(process.env.DEMO_CUSTOMER_PASSWORD);
  await a.locator("form").getByRole("button", { name: "Ingresar", exact: true }).click();
  await a.waitForURL(url => url.pathname === "/onboarding" || url.pathname === "/", { timeout: 30000 });
  check("customer password login", true);
  if (new URL(a.url()).pathname === "/onboarding") {
    await a.getByLabel("Nombre", { exact: true }).fill("Cliente Demo");
    await a.getByLabel("@usuario", { exact: true }).fill("cliente_demo_onza");
    await a.getByLabel("Número de teléfono").fill("00000000");
    await a.getByLabel("Día", { exact: true }).selectOption("1");
    await a.getByLabel("Mes", { exact: true }).selectOption("1");
    await a.getByLabel("Año", { exact: true }).selectOption("2000");
    await a.getByRole("checkbox", { name: /Acepto las/ }).check();
    await a.getByRole("button", { name: "Continuar", exact: true }).click();
    await a.waitForURL(url => url.pathname === "/", { timeout: 30000 });
    check("onboarding persists fictional demo profile", true);
  }
  await b.goto(origin + "/equipo/acceso");
  await b.getByLabel("Correo del personal", { exact: true }).fill(process.env.DEMO_BARTENDER_EMAIL);
  await b.getByLabel("Contraseña", { exact: true }).fill(process.env.DEMO_BARTENDER_PASSWORD);
  await b.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await b.getByRole("link", { name: "Abrir barra", exact: true }).waitFor({ timeout: 30000 });
  check("independent bartender password login", true);
  await a.goto(origin + "/v/sala-norte/p/30000000-0000-4000-8000-000000000001");
  await a.getByRole("button", { name: "Agregar", exact: true }).click();
  await a.goto(origin + "/checkout");
  check("payment scenario selector absent", await a.locator("select").count() === 0);
  await a.getByRole("button", { name: /Confirmar y reservar/ }).click();
  await a
    .getByRole("heading", { name: "Pedido recibido", exact: true })
    .waitFor({ timeout: 25000 });
  check("Preview accepts its own Origin and creates mock order", true);
  const orderId = new URL(a.url()).pathname.split("/").at(-1);
  await a.reload();
  await a.getByRole("heading", { name: "Pedido recibido", exact: true }).waitFor();
  check("customer order survives reload", true);
  const get = async () => {
    const r = await a.request.get(origin + `/api/orders?order=${orderId}`);
    return (await r.json())[0];
  };
  let order = await get();
  await b.goto(origin + `/staff/${venue}`);
  const card = b
    .locator("article")
    .filter({
      has: b.getByRole("heading", {
        name: `#${order.public_code}`,
        exact: true,
      }),
    });
  await card
    .getByRole("button", { name: "Aceptar y preparar", exact: true })
    .click();
  await a
    .getByRole("heading", { name: "Preparando", exact: true })
    .waitFor({ timeout: 25000 });
  check("acceptance reaches customer", true);
  await card.getByRole("button", { name: "Marcar listo", exact: true }).click();
  await a
    .getByRole("heading", { name: "Listo para recoger", exact: true })
    .waitFor({ timeout: 25000 });
  order = await get();
  check(
    "private ticket QR and manual code available",
    !!order.qr_data_url && !!order.pickup_code,
  );
  const headers = { origin };
  const publicAttempt = await b.request.post(origin + "/api/commands", {
    headers,
    data: { action: "resolve", venueId: venue, code: order.public_code },
  });
  check("public number rejected", !publicAttempt.ok());
  await card
    .getByRole("button", { name: "Validar retiro", exact: true })
    .click();
  check(
    "staff action does not prefill credential",
    (await b.getByLabel("Código de retiro (12 caracteres)").inputValue()) ===
      "",
  );
  await b
    .getByLabel("Código de retiro (12 caracteres)")
    .fill(order.pickup_code);
  await b.getByRole("button", { name: "Validar", exact: true }).click();
  await b
    .getByRole("button", { name: "Confirmar cobro simulado", exact: true })
    .waitFor();
  await b
    .getByRole("button", { name: "Confirmar cobro simulado", exact: true })
    .click();
  await b
    .getByRole("heading", { name: "Podés entregar", exact: true })
    .waitFor();
  await b
    .getByRole("checkbox", { name: "Entregué físicamente el pedido completo." })
    .check();
  await b
    .getByRole("button", { name: "Confirmar entrega", exact: true })
    .click();
  await a
    .getByRole("heading", { name: "Entregado", exact: true })
    .waitFor({ timeout: 25000 });
  check(
    "validated mock capture and physical confirmation reach delivered",
    true,
  );
  const consumed = await b.request.post(origin + "/api/commands", {
    headers,
    data: { action: "resolve", venueId: venue, code: order.pickup_code },
  });
  check(
    "consumed pickup rejects reuse",
    !consumed.ok() && (await consumed.json()).error === "ALREADY_DELIVERED",
  );
  await a.goto(origin + "/equipo/acceso");
  check("customer cannot enter team portal", new URL(a.url()).pathname === "/sesion-activa");
  await b.goto(origin + "/acceso");
  check("staff cannot enter customer area", new URL(b.url()).pathname === "/sesion-activa");
  check("no runtime errors", runtimeErrors === 0);
  writeFileSync(
    "docs/evidence/accounts-demo-verification.json",
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        origin,
        physicalDevicesTested: false,
        demoProfile: "fictional test data, not user personal information",
        commit: "d2de7de55c821a50c761d997f7c57d30c31631d7",
        project: "onza-dev",
        paymentProvider: "mock",
        checks,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: checks.length, runtimeErrors, origin }));
} catch (error) {
  console.error(JSON.stringify({lastPassed: checks.at(-1)?.name ?? "browser startup", passed: checks.length, errorType: error.name}));
  console.error(
    error.message.startsWith("CHECK_FAILED:")
      ? error.message
      : "Demo verification failed; sensitive details withheld. Demo order may need attention; no credentials logged.",
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
