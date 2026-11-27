// Administración para operar una noche (D-2026-11-27-03): «Ahora» con el pulso del local, «Antes de abrir» mientras está
// cerrado, pausa/reanudar, agotados, edición de menú que persiste y «Al cerrar» con no entregados y tiempos.
// Uso (shim recién iniciado + app apuntando a él, ver docs/Onza-Guia-tecnica.md):
//   ONZA_APP=http://127.0.0.1:3100 node scripts/verify-admin-noche.mjs [carpeta-capturas]
// El aviso de retraso en preparación (10/15 min) se prueba en tests/admin/attention.test.ts: el shim no adelanta el reloj.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { people } from "./local-shim/index.mjs";
import { sessionCookies } from "./local-shim/session.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const APP = process.env.ONZA_APP ?? "http://127.0.0.1:3100";
const SHIM = process.env.SHIM_URL ?? "http://127.0.0.1:54321";
const OUT = process.argv[2];
if (OUT) mkdirSync(OUT, { recursive: true });
const PICNIC = "20000000-0000-4000-8000-000000000004";
const ADMIN = `${APP}/admin/${PICNIC}`;
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const browser = await chromium.launch();
const errors = [];
async function open(email, width = 390, height = 844) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 600 });
  await context.addCookies(await sessionCookies(SHIM, email));
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${email}: ${e.message}`));
  return page;
}
const shot = async (page, name, full = true) => {
  if (!OUT) return;
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
};
const text = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");
const strip = async (page) =>
  Object.fromEntries(
    await page.locator(".now-strip > div").evaluateAll((els) =>
      els.map((el) => [el.querySelector("dt").textContent.trim(), el.querySelector("dd").textContent.replace(/\s+/g, " ").trim()]),
    ),
  );
// Los pedidos en vivo llegan después de pintar la página: espera hasta 10 s a que el pulso muestre el valor.
async function stripValue(page, key, value) {
  for (let i = 0; i < 20; i++) {
    if ((await strip(page))[key] === value) return true;
    await page.waitForTimeout(500);
  }
  return false;
}
async function order(page, product) {
  await page.goto(`${APP}/v/picnic`);
  await page.locator("article.prow", { hasText: product }).getByRole("button", { name: "Agregar", exact: true }).first().click();
  await page.goto(`${APP}/checkout`);
  await page.getByRole("button", { name: "Retirar en la barra", exact: true }).click();
  await page.getByRole("button", { name: /^Pedir/ }).click();
  await page.waitForURL(/\/orders\//, { timeout: 15000 });
}

try {
  const [ana, anaPhone, maria, sofia, jorge] = await Promise.all([
    open(people.ana.email, 1280, 900),
    open(people.ana.email),
    open(people.maria.email),
    open(people.sofia.email),
    open(people.jorge.email, 1280, 800),
  ]);

  /* 1 · La entrada es «Ahora» */
  await ana.goto(ADMIN);
  await ana.getByRole("heading", { name: "Ahora", exact: true }).waitFor();
  check("La administración abre en «Ahora»", ana.url().endsWith(PICNIC) || ana.url().includes("tab=ahora"));
  check("«Ahora» muestra nuevos, preparando, listos y activos frente a la capacidad", Object.keys(await strip(ana)).join(",") === "Nuevos,Preparando,Listos,Activos");
  const nav = await ana.locator("nav.side").innerText();
  check("La navegación está agrupada por momento de la noche", ["Durante la noche", "Antes de abrir", "Al cerrar"].every((g) => nav.includes(g)));

  /* 2 · Antes de abrir: cerrar muestra la lista y se abre en un toque */
  await ana.getByRole("button", { name: "Cerrado", exact: true }).click();
  await ana.getByText("Guardado").waitFor({ timeout: 10000 });
  await ana.getByRole("heading", { name: "Antes de abrir" }).waitFor({ timeout: 10000 });
  const before = await ana.locator(".open-checklist").innerText();
  check("Con el local cerrado, «Antes de abrir» revisa menú, agotados, horario, entrega y capacidad",
    ["productos disponibles", "agotados", "orario", "Entrega en el lugar", "Capacidad"].every((t) => before.includes(t)), before.replace(/\s+/g, " ").slice(0, 160));
  await shot(ana, "a1-antes-de-abrir-1280");
  await ana.getByRole("button", { name: "Abrir el local" }).click();
  await ana.getByText("El local vuelve a recibir pedidos.").waitFor({ timeout: 10000 });
  await ana.locator(".open-checklist").waitFor({ state: "detached", timeout: 10000 }).catch(() => undefined);
  check("Se abre el local desde «Ahora» y la lista desaparece", (await ana.locator(".open-checklist").count()) === 0);

  /* 3 · Durante la noche: pedidos en vivo y pausa */
  await order(maria, "Spritz");
  await ana.reload();
  await ana.getByText(/pedido nuevo espera aceptación/).waitFor({ timeout: 15000 });
  check("Un pedido nuevo aparece en el pulso y como atención con atajo a la barra", (await stripValue(ana, "Nuevos", "1")) && (await ana.getByRole("link", { name: "Ir a la barra" }).count()) >= 1);
  await jorge.goto(`${APP}/staff/${PICNIC}`);
  await jorge.getByRole("button", { name: "Aceptar" }).first().click();
  await jorge.waitForTimeout(1200);
  await ana.reload();
  await ana.getByRole("heading", { name: "Ahora", exact: true }).waitFor();
  check("Al aceptarlo en la barra, «Ahora» lo cuenta en preparación", await stripValue(ana, "Preparando", "1"), JSON.stringify(await strip(ana)));
  await ana.getByRole("button", { name: "Pausado", exact: true }).click();
  await ana.getByRole("button", { name: "Reanudar pedidos" }).waitFor({ timeout: 10000 });
  check("Pausar muestra «Pedidos pausados» y el botón para reanudar", (await text(ana)).includes("Pedidos pausados"));
  await ana.getByRole("button", { name: "Reanudar pedidos" }).click();
  await ana.getByText("El local vuelve a recibir pedidos.").waitFor({ timeout: 10000 });
  check("Reanudar en un toque", true);
  await shot(ana, "a2-ahora-1280");
  await anaPhone.goto(ADMIN);
  await anaPhone.getByRole("heading", { name: "Ahora", exact: true }).waitFor();
  const phone = await anaPhone.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1, tabsTop: getComputedStyle(document.querySelector("nav.admin-tabs")).top }));
  check("En el teléfono no hay desplazamiento horizontal y las pestañas quedan bajo la cabecera", !phone.overflow && phone.tabsTop !== "0px", JSON.stringify(phone));
  await shot(anaPhone, "a3-ahora-390");

  /* 4 · Antes de abrir: menú y agotados persisten */
  await ana.goto(`${ADMIN}?tab=menu`);
  await ana.locator(".product-row", { hasText: "Gin tonic" }).getByRole("button", { name: "Editar" }).click();
  await ana.getByLabel(/Precio/).fill("5400");
  await ana.getByRole("button", { name: "Guardar producto" }).click();
  await ana.waitForTimeout(1500);
  await maria.goto(`${APP}/v/picnic`);
  const gin = (await maria.locator("article.prow", { hasText: "Gin tonic" }).innerText()).replace(/\s+/g, " ");
  check("Editar un precio persiste y el cliente lo ve", /5[\s .]?400/.test(gin), gin);
  await ana.goto(`${ADMIN}?tab=menu`);
  await ana.locator(".product-row", { hasText: "Mojito" }).getByRole("switch").first().click();
  await ana.waitForTimeout(1200);
  await ana.goto(ADMIN);
  await ana.locator("#agotados").getByText("Mojito").waitFor({ timeout: 10000 });
  check("Lo agotado en Menú aparece en «Ahora» y en la atención", (await text(ana)).includes("1 producto agotado"));
  await ana.locator("#agotados").getByRole("switch").first().click();
  await ana.locator("#agotados").getByText("Todo disponible.").waitFor({ timeout: 10000 });
  check("Se reactiva desde «Ahora»", true);

  /* 5 · Al cerrar: no entregados, tiempos y montos simulados */
  await order(sofia, "Cerveza");
  await sofia.getByRole("button", { name: "Cancelar pedido" }).click();
  await sofia.getByRole("button", { name: "Sí, cancelar pedido" }).click();
  await sofia.getByText(/Cancelado/).first().waitFor({ timeout: 10000 });
  await ana.goto(`${ADMIN}?tab=resumen`);
  await ana.locator(".kpis").waitFor();
  const kpis = (await ana.locator(".kpis").innerText()).replace(/\s+/g, " ");
  check("«Al cerrar» muestra entregados, no entregados, ventas netas simuladas y preparación con aceptación",
    ["Entregados", "No entregados", "Ventas netas (simuladas)", "Preparación", "Aceptación"].every((k) => kpis.includes(k)), kpis);
  const notDelivered = Number((await ana.locator(".kpis .metric", { hasText: "No entregados" }).locator(".v").innerText()).trim());
  check("El pedido cancelado cuenta como no entregado", notDelivered >= 1, String(notDelivered));
  check("Los montos se rotulan como simulados", (await text(ana)).includes("Montos simulados"));
  await shot(ana, "a4-al-cerrar-1280");
  check("Sin errores de página", errors.length === 0, errors.join(" | "));
} catch (error) {
  check("El recorrido terminó sin excepciones", false, String(error).split("\n")[0]);
} finally {
  await browser.close();
  if (OUT)
    writeFileSync(`${OUT}/verificacion-admin.json`, JSON.stringify({ generado: new Date().toISOString(), total: results.length, fallos: results.filter((r) => !r.ok).length, resultados: results }, null, 2));
  process.exitCode = results.every((r) => r.ok) ? 0 : 1;
}
