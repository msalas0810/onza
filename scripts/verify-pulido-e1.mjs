// Plan de pulido · Entrega 1. Recorrido en navegador contra la app local (scripts/local-shim + next dev). No toca bases remotas.
// Uso: ONZA_APP=http://127.0.0.1:3100 node scripts/verify-pulido-e1.mjs [carpeta-capturas]
// Requiere el shim recién iniciado (estado limpio) y la app apuntando a él.
import { createRequire } from "node:module";
import { people } from "./local-shim/index.mjs";
import { sessionCookies } from "./local-shim/session.mjs";
import { stableId } from "./lib/real-venues-seed.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const APP = process.env.ONZA_APP ?? "http://127.0.0.1:3100";
const SHIM = process.env.SHIM_URL ?? "http://127.0.0.1:54321";
const OUT = process.argv[2];
const venue = stableId("onza-real-venue", "mil948");
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
const errors = [];
async function open(email, width = 390, height = 844) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addCookies(await sessionCookies(SHIM, email));
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${email}: ${e.message}`));
  return page;
}
const shot = (page, name) => OUT && page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const notices = async (page) => (await page.locator(".notice").allInnerTexts()).join(" | ");
const names = async (page) =>
  page.locator(".product-row .product-row-name").allInnerTexts();
const addToCart = (page, name) =>
  page.locator("article.prow", { hasText: name }).getByRole("button", { name: "Agregar", exact: true }).click();
try {
  const admin = await open(people.ana.email);
  const maria = await open(people.maria.email);
  const jorge = await open(people.jorge.email, 1280, 800);

  await maria.goto(`${APP}/v/mil948`);
  await addToCart(maria, "Margarita");
  await addToCart(maria, "Negroni");

  await admin.goto(`${APP}/admin/${venue}?tab=menu`);
  await admin.waitForSelector(".product-row");
  const before = await names(admin);
  await admin.getByRole("switch", { name: /Disponible para pedir: Margarita/ }).click();
  await admin.locator(".product-row", { hasText: "Margarita" }).getByText("Agotado").waitFor();
  await admin.reload();
  await admin.waitForSelector(".product-row");
  const after = await names(admin);
  check("Agotar deja el producto en su lugar con estado Agotado (tras recargar)",
    JSON.stringify(before) === JSON.stringify(after) &&
      (await admin.locator(".product-row", { hasText: "Margarita" }).innerText()).includes("Agotado"));
  await shot(admin, "e1-admin-agotado-360");

  await maria.goto(`${APP}/v/mil948`);
  check("El cliente ve el agotado en su lugar, con etiqueta",
    (await maria.locator("article.prow.soldout", { hasText: "Margarita" }).count()) === 1);

  await maria.goto(`${APP}/checkout`);
  await maria.getByRole("button", { name: /^Pedir/ }).click();
  await maria.getByRole("button", { name: "Quitar Margarita" }).waitFor({ timeout: 10000 });
  check("Checkout indica qué línea se agotó y ofrece quitarla", (await notices(maria)).includes("Margarita se agotó"));
  await shot(maria, "e1-checkout-agotado");
  await maria.getByRole("button", { name: "Quitar Margarita" }).click();
  await maria.getByRole("button", { name: /^Pedir/ }).click();
  await maria.waitForURL(/\/orders\//, { timeout: 15000 });
  check("Tras quitar la línea el pedido sale sin bloqueo por intento anterior", /\/orders\//.test(maria.url()));

  // Barra: hora de entrada y cuenta regresiva.
  await jorge.goto(`${APP}/staff/${venue}`);
  const card = jorge.locator("article.ocard").first();
  await card.waitFor({ timeout: 15000 });
  const text = await card.innerText();
  check("La barra muestra hora de entrada y tiempo restante mm:ss", /Entró a las/.test(text) && /0[0-4]:[0-5]\d/.test(text), text.replace(/\n/g, " / "));
  await shot(jorge, "e1-barra-nuevos");

  // Reactivar y pedir con un carrito armado antes del cambio (versión vieja, mismo precio).
  await admin.goto(`${APP}/admin/${venue}?tab=disponibilidad`);
  await admin.getByRole("link", { name: "Margarita" }).waitFor();
  check("«Agotados ahora» lista el producto y enlaza a editarlo",
    (await admin.getByRole("link", { name: "Margarita" }).getAttribute("href")).includes("editar="));
  await admin.locator(".rows .r", { hasText: "Margarita" }).getByRole("switch").click();
  await admin.getByText("Margarita vuelve a estar disponible.").waitFor();
  await maria.goto(`${APP}/v/mil948`);
  await addToCart(maria, "Margarita");
  await maria.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("onza-cart-draft"));
    const cart = JSON.parse(localStorage.getItem(key));
    cart.items = cart.items.map((i) => ({ ...i, version: 1 }));
    localStorage.setItem(key, JSON.stringify(cart));
  });
  await maria.goto(`${APP}/checkout`);
  await maria.getByRole("button", { name: /^Pedir/ }).click();
  await maria.waitForURL(/\/orders\//, { timeout: 15000 });
  check("Reactivado: el carrito armado antes del cambio pide sin «El menú cambió»", /\/orders\//.test(maria.url()));

  // Archivar → Archivados → Restaurar (vuelve agotado).
  await admin.goto(`${APP}/admin/${venue}?tab=menu`);
  await admin.locator(".product-row", { hasText: "Negroni" }).getByRole("button", { name: "Archivar" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Archivar" }).click();
  await admin.getByText("Negroni quedó en Archivados.").waitFor();
  await admin.getByRole("button", { name: /Archivados \(1\)/ }).click();
  await admin.locator(".product-row", { hasText: "Negroni" }).getByRole("button", { name: "Restaurar" }).click();
  await admin.getByText(/Negroni volvió al menú como agotado/).waitFor();
  await admin.reload();
  await admin.waitForSelector(".product-row");
  check("Restaurar devuelve el producto al menú como Agotado",
    (await admin.locator(".product-row", { hasText: "Negroni" }).innerText()).includes("Agotado"));

  // Respuesta perdida: el intento anterior creó un pedido y el carrito cambió → se muestra el pedido activo.
  await maria.goto(`${APP}/v/mil948`);
  await addToCart(maria, "Old fashioned");
  const lost = await maria.evaluate(async () => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("onza-cart-draft"));
    const cart = JSON.parse(localStorage.getItem(key));
    const userId = key.split(":")[1];
    const idempotencyKey = crypto.randomUUID();
    const input = { action: "create", venueId: cart.venueId, items: cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity, expectedProductVersion: i.version, expectedPriceMinor: i.priceMinor })), termsVersion: "demo-v1", privacyVersion: "demo-v1", adult: true };
    const r = await fetch("/api/commands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, idempotencyKey }) });
    localStorage.setItem(`onza-checkout-attempt:${userId}`, JSON.stringify({ fingerprint: JSON.stringify(input), key: idempotencyKey }));
    return r.status;
  });
  await maria.locator("article.prow", { hasText: "Old fashioned" }).getByRole("button", { name: "Agregar una unidad" }).click();
  await maria.goto(`${APP}/checkout`);
  await maria.getByRole("button", { name: /^Pedir/ }).click();
  await maria.getByRole("link", { name: "Ver pedido activo" }).waitFor({ timeout: 10000 });
  check("Intento previo con pedido activo: se nombra el pedido y el local y se ofrece «Ver pedido activo»",
    lost === 200 && /Mil948/.test(await notices(maria)));
  await shot(maria, "e1-pedido-activo");
} catch (e) {
  check("Recorrido sin excepciones", false, e.message.split("\n")[0]);
} finally {
  check("Sin errores de página", errors.length === 0, errors.join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} comprobaciones`);
  process.exit(failed ? 1 : 0);
}
