// Explicit existing Preview only; no screenshots, credentials, tokens or request dumps.
import { chromium } from "playwright";
import { createServerClient } from "@supabase/ssr";
import { writeFileSync } from "node:fs";
const origin = process.argv[2];
if (origin !== "https://onza-demo-ml94rxfry-msalas0810s-projects.vercel.app")
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
  if (!ok) throw new Error(`CHECK_FAILED: ${name}`);
};
let runtimeErrors = 0;
try {
  const a = await customer.newPage(),
    b = await bar.newPage();
  a.on("pageerror", () => runtimeErrors++);
  b.on("pageerror", () => runtimeErrors++);
  const cookies = [];
  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => [],
        setAll: (values) => cookies.push(...values),
      },
    },
  );
  check(
    "real staff authentication",
    !(
      await db.auth.signInWithPassword({
        email: process.env.DEMO_BARTENDER_EMAIL,
        password: process.env.DEMO_BARTENDER_PASSWORD,
      })
    ).error,
  );
  await bar.addCookies(
    cookies.map(({ name, value }) => ({
      name,
      value,
      domain: new URL(origin).hostname,
      path: "/",
      sameSite: "Lax",
      secure: true,
    })),
  );
  await a.goto(origin + "/v/sala-norte/p/30000000-0000-4000-8000-000000000001");
  await a.getByRole("button", { name: "Agregar", exact: true }).click();
  await a.goto(origin + "/checkout");
  await a.getByRole("checkbox").nth(0).check();
  await a.getByRole("checkbox").nth(1).check();
  await a.getByRole("button", { name: /^Pedir/ }).click();
  await a
    .getByRole("heading", { name: "Pedido recibido", exact: true })
    .waitFor({ timeout: 25000 });
  check("Preview accepts its own Origin and creates mock order", true);
  const orderId = new URL(a.url()).pathname.split("/").at(-1);
  const get = async () => {
    const r = await a.request.get(origin + `/api/orders?order=${orderId}`);
    return (await r.json())[0];
  };
  let order = await get();
  await b.goto(origin + `/staff/${venue}`);
  const card = b.locator("article").filter({
    has: b.getByRole("heading", {
      name: `#${order.public_code}`,
      exact: true,
    }),
  });
  await card.getByRole("button", { name: "Aceptar", exact: true }).click();
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
    .first()
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
  check("no runtime errors", runtimeErrors === 0);
  writeFileSync(
    "docs/evidence/hosted-ux/preview-verification.json",
    JSON.stringify(
      {
        origin,
        commit: "e1e8987344ec7299f88cee023dbebad7992f8dac",
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
  console.error(
    error.message.startsWith("CHECK_FAILED:")
      ? error.message
      : "Preview verification failed; sensitive details withheld. Demo order may need attention; no credentials logged.",
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
