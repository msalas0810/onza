// Prueba del demo publicado: pedido con pin en Picnic, mismo pin en la barra, entrega con código, admin, Actividad y Amigos.
// Usa las cuentas demo de .env.local (no imprime correos ni claves). Deja un pedido de prueba entregado.
// Uso: node scripts/verify-dominio-picnic.mjs [carpeta-de-salida]
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const APP = "https://onza-demo.vercel.app";
const OUT = `${process.argv[2] ?? `${tmpdir()}/onza-dominio`}/`;
mkdirSync(OUT, { recursive: true });
const PICNIC = "20000000-0000-4000-8000-000000000004";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const browser = await chromium.launch();
const errors = [];
const sockets = [];
async function open(label, width, height, mobile = false) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 500) errors.push(`${label}: ${r.status()} ${new URL(r.url()).pathname}`); });
  page.on("websocket", (ws) => {
    if (!ws.url().includes("/realtime/")) return;
    const s = { label, frames: 0, joined: false };
    sockets.push(s);
    ws.on("framereceived", (f) => { s.frames++; if (String(f.payload).includes('"status":"ok"')) s.joined = true; });
  });
  return page;
}
const shot = (page, name, full = false) => page.screenshot({ path: `${OUT}${name}.png`, fullPage: full });
const text = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");
async function pinFraction(page, root = ".plan-box") {
  await page.locator(`${root} .plan-pin`).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(700);
  const img = await page.locator(`${root} .plan-img`).first().boundingBox();
  const pin = await page.locator(`${root} .plan-pin`).first().boundingBox();
  return { x: (pin.x + pin.width / 2 - img.x) / img.width, y: (pin.y + pin.height - img.y) / img.height };
}
async function tapPlan(page, fx, fy) {
  const el = page.locator(".plan-box .plan-img").first();
  await el.evaluate((n) => n.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(500);
  const box = await el.boundingBox();
  await page.touchscreen.tap(box.x + box.width * fx, box.y + box.height * fy);
  await page.waitForTimeout(400);
}
const fmt = (p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`;
const openLane = async (page, label) => {
  const tab = page.getByRole("tab", { name: new RegExp(`^${label}`) });
  if (await tab.isVisible().catch(() => false)) await tab.click();
};
async function staffLogin(page, email, password) {
  await page.goto(`${APP}/equipo/acceso`);
  await page.getByLabel("Correo del trabajo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL((u) => !u.pathname.endsWith("/equipo/acceso"), { timeout: 30000 });
}
let step = "inicio";
try {
  const customer = await open("cliente", 390, 844, true);
  const bar = await open("barra", 1280, 800);

  step = "barra: ingreso";
  await staffLogin(bar, env.DEMO_BARTENDER_EMAIL, env.DEMO_BARTENDER_PASSWORD);
  await bar.goto(`${APP}/staff/${PICNIC}`);
  await bar.waitForLoadState("networkidle").catch(() => undefined);
  check("La barra de Picnic abre con la cuenta demo del equipo", bar.url().includes(`/staff/${PICNIC}`));
  const cardsBefore = await bar.locator("article.ocard").count();

  step = "cliente: ingreso";
  await customer.goto(`${APP}/acceso`);
  await customer.locator("summary", { hasText: "Continuar con correo" }).click();
  await customer.getByLabel("Correo", { exact: true }).fill(env.DEMO_CUSTOMER_EMAIL);
  await customer.getByLabel("Contraseña", { exact: true }).fill(env.DEMO_CUSTOMER_PASSWORD);
  await customer.getByRole("button", { name: "Ingresar", exact: true }).click();
  await customer.waitForURL((u) => !u.pathname.startsWith("/acceso"), { timeout: 30000 });
  await customer.goto(`${APP}/`);
  await customer.getByText("Picnic").first().waitFor({ timeout: 20000 });
  check("Picnic aparece en Explorar", true, new URL(customer.url()).pathname);
  await shot(customer, "01-explorar", true);

  step = "cliente: menú";
  await customer.goto(`${APP}/v/picnic`);
  await customer.locator("article.prow").first().waitFor({ timeout: 20000 });
  const menu = await customer.locator("article.prow").count();
  check("/v/picnic abre con su menú de 5 productos y el rótulo de demostración", menu === 5 && (await text(customer)).includes("Menú de demostración"), `${menu} productos`);
  await shot(customer, "02-picnic-menu", true);
  await customer.locator("article.prow", { hasText: "Spritz" }).getByRole("button", { name: "Agregar", exact: true }).click();

  step = "cliente: checkout y pin";
  await customer.goto(`${APP}/checkout`);
  await customer.getByText("¿Cómo recibís tu pedido?").waitFor({ timeout: 20000 });
  await customer.getByRole("button", { name: /Llevarlo a mi/ }).click();
  await customer.locator(".plan-box .plan-img").first().waitFor({ timeout: 20000 });
  check("El checkout muestra el plano de Picnic", (await customer.locator(".plan-box").count()) === 1);
  await tapPlan(customer, 0.6625, 0.32);
  const chosen = await pinFraction(customer);
  check("Un toque coloca el pin donde se tocó", Math.abs(chosen.x - 0.6625) < 0.012 && Math.abs(chosen.y - 0.32) < 0.012, fmt(chosen));
  await shot(customer, "03-checkout-pin");
  const terms = customer.locator("form input[type=checkbox], main input[type=checkbox]");
  for (let i = 0; i < (await terms.count()); i++) {
    const box = terms.nth(i);
    if ((await box.isVisible()) && !(await box.isChecked())) await box.check();
  }
  await customer.getByRole("button", { name: /^Pedir/ }).click();
  await customer.waitForURL(/\/orders\/[0-9a-f-]{36}/, { timeout: 30000 });
  const orderId = customer.url().match(/orders\/([0-9a-f-]{36})/)[1];
  check("El pedido con pin se crea", true, `pedido ${orderId}`);

  step = "barra: llega el pedido";
  let live = true;
  try {
    await bar.waitForFunction((n) => document.querySelectorAll("article.ocard").length > n, cardsBefore, { timeout: 30000 });
  } catch {
    live = false;
    await bar.reload();
    await bar.locator("article.ocard").first().waitFor({ timeout: 20000 });
  }
  check("La barra recibe el pedido sin recargar la página", live);
  const card = bar.locator("article.ocard", { hasText: "Spritz" }).last();
  const cardText = (await card.innerText()).replace(/\s+/g, " ");
  check("La tarjeta de la barra dice «Llevar al punto marcado» y ofrece el mapa", cardText.includes("Llevar al punto marcado") && cardText.includes("Ver en el mapa"));
  await shot(bar, "04-barra-cola");
  await card.getByRole("button", { name: "Ver en el mapa" }).click();
  const staffPin = await pinFraction(bar, ".sheet .plan-box");
  check("La barra ve el mismo pin que marcó el cliente", Math.abs(staffPin.x - chosen.x) < 0.008 && Math.abs(staffPin.y - chosen.y) < 0.008, `barra ${fmt(staffPin)} · cliente ${fmt(chosen)}`);
  await shot(bar, "05-barra-mismo-pin");
  await bar.keyboard.press("Escape");

  step = "barra: preparar";
  await card.getByRole("button", { name: "Aceptar" }).click();
  await openLane(bar, "Preparando");
  await bar.getByRole("button", { name: "Marcar listo" }).first().click();
  await openLane(bar, "Listos");
  await bar.getByRole("button", { name: /Entregar en/ }).first().waitFor({ timeout: 20000 });

  step = "cliente: código";
  await customer.reload();
  await customer.locator("[data-private='pickup']").waitFor({ timeout: 25000 });
  const code = (await customer.locator("[data-private='pickup']").innerText()).replace(/\s+/g, "");
  check("El cliente ve su QR y código privado", (await customer.locator(".ticket .qr img").count()) === 1 && code.length >= 8);

  step = "barra: entregar";
  await bar.getByRole("button", { name: /Entregar en/ }).first().click();
  await bar.getByLabel("Código privado").fill(code);
  await bar.getByRole("button", { name: "Validar", exact: true }).click();
  await bar.getByRole("button", { name: /Confirmar cobro simulado/ }).click({ timeout: 20000 });
  await bar.getByText("Cobro confirmado (simulado).").waitFor({ timeout: 20000 });
  await bar.getByLabel(/Entregué/).check();
  await bar.getByRole("button", { name: "Confirmar entrega" }).click();
  await bar.locator(".result.ok").waitFor({ timeout: 20000 });
  check("La barra cierra la entrega con el código y el cobro simulado", (await bar.locator(".result.ok").innerText()).includes("Entregado"));
  await shot(bar, "06-barra-entregado");
  await customer.reload();
  await customer.getByText(/entregado en/i).first().waitFor({ timeout: 25000 });
  check("El cliente ve el pedido entregado", true);

  step = "cliente: actividad";
  await customer.goto(`${APP}/actividad`);
  await customer.getByText("Todavía no hay actividad visible").waitFor({ timeout: 20000 });
  check("Actividad abre con su estado vacío (sin coordenadas inventadas)", true);
  await customer.goto(`${APP}/actividad?ejemplo=1`);
  check("El ejemplo de Actividad está rotulado «Simulado»", (await text(customer)).includes("Simulado"));
  await shot(customer, "07-actividad-simulada", true);

  step = "cliente: amigos";
  await customer.goto(`${APP}/amigos`);
  await customer.getByLabel("@usuario de Onza").waitFor({ timeout: 20000 });
  check("Amigos abre para la cuenta de cliente", true);
  await customer.goto(`${APP}/v/picnic`);
  await customer.getByRole("link", { name: "Estoy acá" }).click();
  await customer.waitForURL(/\/amigos\?local=picnic/, { timeout: 20000 });
  const sw = customer.getByRole("switch", { name: "Que mis amigos vean este local" });
  check("Compartir arranca apagado", !(await sw.isChecked()));
  await customer.getByRole("button", { name: "1 h" }).click();
  await customer.getByRole("button", { name: "Estoy acá", exact: true }).click();
  await customer.getByText("Listo, contás para la actividad del local.").waitFor({ timeout: 20000 });
  check("El check-in en Picnic funciona contra la base real", true);
  await shot(customer, "08-amigos-checkin", true);
  const out = await customer.request.post(`${APP}/api/social`, { headers: { origin: APP, "content-type": "application/json" }, data: { action: "checkout" } });
  check("Salir del check-in funciona (no queda actividad de prueba)", out.ok(), String(out.status()));

  step = "admin";
  const admin = await open("admin", 1280, 900);
  await staffLogin(admin, env.DEMO_ADMIN_EMAIL, env.DEMO_ADMIN_PASSWORD);
  await admin.goto(`${APP}/admin/${PICNIC}`);
  await admin.getByRole("heading", { name: "Ahora", exact: true }).waitFor({ timeout: 20000 });
  const nav = await admin.locator("nav.side").innerText();
  check("El admin nuevo abre en «Ahora», agrupado por momento", ["Durante la noche", "Antes de abrir", "Al cerrar"].every((g) => nav.includes(g)));
  await shot(admin, "09-admin-ahora");
  await admin.goto(`${APP}/admin/${PICNIC}?tab=resumen`);
  await admin.locator(".kpis").waitFor({ timeout: 20000 });
  const delivered = Number((await admin.locator(".kpis .metric", { hasText: "Entregados" }).first().locator(".v").innerText()).trim());
  check("«Al cerrar» cuenta la entrega", delivered >= 1, `Entregados ${delivered}`);
  await shot(admin, "10-admin-resumen");
  await admin.goto(`${APP}/admin/${PICNIC}?tab=entrega`);
  await admin.waitForLoadState("networkidle").catch(() => undefined);
  check("La pestaña de entrega y QR muestra el plano", (await admin.locator(".plan-img").count()) >= 1);

  check("Sin errores de página ni respuestas 5xx", errors.length === 0, errors.join(" | "));
} catch (error) {
  check(`El recorrido terminó sin excepciones (paso: ${step})`, false, String(error).split("\n").slice(0, 3).join(" "));
  let i = 0;
  for (const c of browser.contexts()) for (const p of c.pages()) await p.screenshot({ path: `${OUT}error-${i++}.png` }).catch(() => undefined);
} finally {
  console.log("realtime:", JSON.stringify(sockets));
  await browser.close();
  writeFileSync(`${OUT}resultado.json`, JSON.stringify({ app: APP, generado: new Date().toISOString(), total: results.length, fallos: results.filter((r) => !r.ok).length, resultados: results, realtime: sockets }, null, 2));
  process.exitCode = results.every((r) => r.ok) ? 0 : 1;
}
