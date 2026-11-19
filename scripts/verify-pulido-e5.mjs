// Plan de pulido · Entrega 5. Lista de espera en navegador: barra llena → lista → recarga → cupo liberado → confirmar.
// Contra la app local (shim recién iniciado). El límite por cancelaciones está en observación por defecto y se prueba en
// tests/orders/abuse-waitlist.test.ts (requiere cambiar private.configuration por SQL).
// Uso: ONZA_APP=http://127.0.0.1:3100 node scripts/verify-pulido-e5.mjs [carpeta-capturas]
import { createRequire } from "node:module";
import { people } from "./local-shim/index.mjs";
import { sessionCookies } from "./local-shim/session.mjs";
import { stableId } from "./lib/real-venues-seed.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const APP = process.env.ONZA_APP ?? "http://127.0.0.1:3100";
const SHIM = process.env.SHIM_URL ?? "http://127.0.0.1:54321";
const OUT = process.argv[2];
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
const shot = (page, name) => OUT && page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
async function setCapacity(admin, value) {
  await admin.goto(`${APP}/admin/${mil}?tab=disponibilidad`);
  await admin.getByLabel("Pedidos activos al mismo tiempo").fill(String(value));
  await admin.getByRole("button", { name: "Guardar" }).first().click();
  await admin.getByText("Guardado").waitFor();
}
async function fillCart(page, name) {
  await page.goto(`${APP}/v/mil948`);
  await page.locator("article.prow", { hasText: name }).getByRole("button", { name: "Agregar", exact: true }).click();
  await page.goto(`${APP}/checkout`);
}
try {
  const ana = await open(people.ana.email, 1280);
  const maria = await open(people.maria.email);
  const sofia = await open(people.sofia.email);
  const jorge = await open(people.jorge.email, 1280);
  await setCapacity(ana, 1);
  await fillCart(maria, "Margarita");
  await maria.getByRole("button", { name: /^Pedir/ }).click();
  await maria.waitForURL(/\/orders\//, { timeout: 15000 });
  const code = (await maria.locator("h1.num").innerText()).replace("#", "");

  await fillCart(sofia, "Paloma");
  await sofia.getByRole("button", { name: /^Pedir/ }).click();
  await sofia.getByRole("button", { name: "Entrar en lista de espera" }).waitFor({ timeout: 10000 });
  check("Barra llena: «La barra está llena · Entrar en lista de espera»", (await sofia.getByText("La barra está llena").count()) === 1);
  await sofia.getByRole("button", { name: "Entrar en lista de espera" }).click();
  await sofia.getByText("Estás en la lista de espera").waitFor();
  check("En espera: posición sin tiempo estimado, carrito conservado y sin pedido ni reserva",
    /próxima persona/.test(await sofia.locator(".waitlist").innerText()) && /no hay pedido ni reserva/.test(await sofia.locator(".waitlist").innerText()));
  await shot(sofia, "e5-espera");
  await sofia.reload();
  await sofia.getByText("Estás en la lista de espera").waitFor({ timeout: 10000 });
  check("Recargar la pantalla recupera el lugar en la fila", true);
  check("El carrito sigue intacto durante la espera", (await sofia.locator(".lines").innerText()).includes("Paloma"));

  // La barra rechaza el pedido activo → se libera el cupo → se ofrece a Sofía.
  await jorge.goto(`${APP}/staff/${mil}`);
  const card = jorge.locator("article.ocard", { hasText: `#${code}` });
  await card.getByRole("button", { name: "Rechazar" }).click();
  await jorge.getByRole("dialog").getByRole("button", { name: "Rechazar pedido" }).click();
  await sofia.getByText("¡Se liberó un cupo!").waitFor({ timeout: 15000 });
  check("Cupo liberado: oferta con cuenta regresiva y «Confirmar pedido»",
    /0[0-2]:[0-5]\d/.test(await sofia.locator(".waitlist").innerText()) && (await sofia.getByRole("button", { name: "Confirmar pedido" }).count()) === 1);
  check("Durante la espera no queda el botón «Pedir» duplicado", (await sofia.getByRole("button", { name: /^Pedir/ }).count()) === 0);
  await shot(sofia, "e5-oferta");
  // Mientras la oferta está retenida, otra cuenta no puede tomar el cupo.
  await fillCart(maria, "Negroni");
  await maria.getByRole("button", { name: /^Pedir/ }).click();
  await maria.getByText("La barra está llena").waitFor({ timeout: 10000 });
  check("Con la oferta retenida, otra cuenta ve la barra llena", true);
  await sofia.getByRole("button", { name: "Confirmar pedido" }).click();
  await sofia.waitForURL(/\/orders\//, { timeout: 15000 });
  check("Confirmar la oferta crea el pedido (recién ahí nace la reserva)", /\/orders\//.test(sofia.url()));
  await setCapacity(ana, 25);
} catch (e) {
  check("Recorrido sin excepciones", false, e.message.split("\n")[0]);
} finally {
  check("Sin errores de página", errors.length === 0, errors.join(" | "));
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} comprobaciones`);
  process.exit(results.every(Boolean) ? 0 : 1);
}
