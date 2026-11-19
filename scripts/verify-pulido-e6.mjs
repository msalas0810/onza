// Plan de pulido · Entrega 6. Aceptación automática en navegador contra la app local (shim recién iniciado).
// Uso: ONZA_APP=http://127.0.0.1:3100 node scripts/verify-pulido-e6.mjs
import { createRequire } from "node:module";
import { people } from "./local-shim/index.mjs";
import { sessionCookies } from "./local-shim/session.mjs";
import { stableId } from "./lib/real-venues-seed.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const APP = process.env.ONZA_APP ?? "http://127.0.0.1:3100";
const SHIM = process.env.SHIM_URL ?? "http://127.0.0.1:54321";
const mil = stableId("onza-real-venue", "mil948");
const results = [];
const errors = [];
const check = (name, ok, detail = "") => {
  results.push(!!ok);
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
async function open(email, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 } });
  await context.addCookies(await sessionCookies(SHIM, email));
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${email}: ${e.message}`));
  return page;
}
async function order(page, name) {
  await page.goto(`${APP}/v/mil948`);
  await page.locator("article.prow", { hasText: name }).getByRole("button", { name: "Agregar", exact: true }).click();
  await page.goto(`${APP}/checkout`);
  await page.getByRole("button", { name: /^Pedir/ }).click();
  await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/, { timeout: 15000 });
  await page.locator(".page-head .badge").waitFor();
  return (await page.locator(".page-head .badge").innerText()).trim();
}
try {
  const ana = await open(people.ana.email, 1280);
  await ana.goto(`${APP}/admin/${mil}?tab=disponibilidad`);
  const toggle = ana.getByRole("switch", { name: /Aceptar automáticamente/ });
  check("Apagada por defecto", !(await toggle.isChecked()));
  await ana.getByLabel("Máximo de pedidos en preparación").fill("1");
  await toggle.click();
  await ana.getByText("Aceptación automática activada").waitFor();
  // Sin ninguna barra abierta: la decisión ocurre en el servidor.
  const maria = await open(people.maria.email);
  const first = await order(maria, "Margarita");
  check("Con la barra cerrada, el pedido elegible pasa solo a Preparando", first === "Preparando", first);
  const sofia = await open(people.sofia.email);
  const second = await order(sofia, "Paloma");
  check("Con la preparación llena, el siguiente queda para aceptar a mano", /Recibido/.test(second), second);
  const jorge = await open(people.jorge.email);
  await jorge.goto(`${APP}/staff/${mil}`);
  check("La barra muestra que la aceptación automática está activa", (await jorge.locator(".reception.auto").count()) === 1);
  await jorge.getByRole("button", { name: "Ajustes" }).click();
  const auto = jorge.getByRole("dialog").getByRole("switch", { name: "Aceptación automática" });
  check("El empleado ve el interruptor encendido", await auto.isChecked());
  await auto.click();
  await jorge.waitForTimeout(800);
  check("El empleado vuelve a manual desde Ajustes", !(await auto.isChecked()));
  check("Apagada, el empleado no puede reactivarla", await auto.isDisabled());
  await jorge.keyboard.press("Escape");
  check("Sin automática, desaparece el aviso de la cabecera", (await jorge.locator(".reception.auto").count()) === 0);
} catch (e) {
  check("Recorrido sin excepciones", false, e.message.split("\n")[0]);
} finally {
  check("Sin errores de página", errors.length === 0, errors.join(" | "));
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} comprobaciones`);
  process.exit(results.every(Boolean) ? 0 : 1);
}
