// Capturas comparables (antes/después) de los recorridos principales: cliente y Picnic en teléfono, barra en computadora,
// administración en ambos tamaños y, si existen, Explorar con actividad y Amigos. No verifica: solo deja imágenes para revisar.
// Uso (shim recién iniciado + next dev, ver docs/Onza-Guia-tecnica.md): ONZA_APP=http://127.0.0.1:3100 node scripts/shots-noche.mjs <carpeta>
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { people } from "./local-shim/index.mjs";
import { sessionCookies } from "./local-shim/session.mjs";
import { stableId } from "./lib/real-venues-seed.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const APP = process.env.ONZA_APP ?? "http://127.0.0.1:3100";
const SHIM = process.env.SHIM_URL ?? "http://127.0.0.1:54321";
const OUT = process.argv[2];
if (!OUT) throw new Error("Uso: node scripts/shots-noche.mjs <carpeta>");
mkdirSync(OUT, { recursive: true });
const PICNIC = "20000000-0000-4000-8000-000000000004";
const MIL948 = stableId("onza-real-venue", "mil948");
const SPOT3 = "50000000-0000-4000-8000-000000000003";
const browser = await chromium.launch();
async function open(email, width, height, mobile = false) {
  const context = await browser.newContext({
    viewport: { width, height },
    ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
  });
  if (email) await context.addCookies(await sessionCookies(SHIM, email));
  return context.newPage();
}
async function shot(page, name, full = false) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log(`· ${name}`);
}
// Una captura que falla no detiene las demás: deja constancia y sigue.
async function step(name, fn) {
  try {
    await fn();
  } catch (error) {
    console.log(`✗ ${name}: ${error.message.split("\n")[0]}`);
  }
}
const add = (page, name) =>
  page
    .locator("article.prow", { hasText: name })
    .getByRole("button", { name: "Agregar", exact: true })
    .first()
    .click();

const maria = await open(people.maria.email, 390, 844, true);
const jorge = await open(people.jorge.email, 1280, 800);
const ana = await open(people.ana.email, 1280, 900);
const anaPhone = await open(people.ana.email, 390, 844, true);

await step("picnic", async () => {
  await maria.goto(`${APP}/v/picnic?spot=${SPOT3}`);
  await maria.waitForSelector("article.prow");
  await shot(maria, "p1-picnic-qr-menu-390");
  await add(maria, "Spritz");
  await maria.goto(`${APP}/checkout`);
  await maria.locator(".plan-box").first().scrollIntoViewIfNeeded();
  await shot(maria, "p2-picnic-checkout-mapa-390");
  await maria.getByRole("button", { name: /^Pedir/ }).click();
  await maria.waitForURL(/\/orders\//, { timeout: 15000 });
  await shot(maria, "p3-picnic-seguimiento-390", true);
});
await step("cliente", async () => {
  await maria.goto(`${APP}/`);
  await shot(maria, "c1-explorar-390");
  await maria.goto(`${APP}/v/mil948`);
  await maria.waitForSelector("article.prow");
  await shot(maria, "c2-local-menu-390");
  await add(maria, "Margarita");
  await maria.goto(`${APP}/checkout`);
  await shot(maria, "c3-checkout-barra-390", true);
});
await step("barra", async () => {
  await jorge.goto(`${APP}/staff/${PICNIC}`);
  await jorge.waitForTimeout(1500);
  await shot(jorge, "b1-barra-cola-1280");
  const map = jorge.getByRole("button", { name: "Ver en el mapa" }).first();
  if (await map.isVisible().catch(() => false)) {
    await map.click();
    await jorge.waitForTimeout(600);
    await shot(jorge, "b2-barra-pin-1280");
    await jorge.keyboard.press("Escape");
  }
});
await step("admin", async () => {
  await ana.goto(`${APP}/admin/${PICNIC}`);
  await ana.waitForTimeout(1200);
  await shot(ana, "a1-admin-1280", true);
  await anaPhone.goto(`${APP}/admin/${PICNIC}`);
  await anaPhone.waitForTimeout(1200);
  await shot(anaPhone, "a2-admin-390", true);
  await ana.goto(`${APP}/admin/${MIL948}`);
  await ana.waitForTimeout(1200);
  await shot(ana, "a3-admin-mil948-1280");
});
await step("social", async () => {
  for (const [path, name] of [
    ["/explorar/actividad", "s1-actividad-390"],
    ["/amigos", "s2-amigos-390"],
  ]) {
    const response = await maria.goto(`${APP}${path}`);
    if (response?.ok()) await shot(maria, name, true);
  }
});
await browser.close();
