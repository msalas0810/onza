// Plan de pulido · Entrega 3. Cliente → barra → retiro en dos sesiones contra la app local (shim). La cámara no existe en
// Chromium sin dispositivo: el escáner cae al código manual (equivale a «cámara denegada»). No prueba cámara real.
// Uso: ONZA_APP=http://127.0.0.1:3100 node scripts/verify-pulido-e3.mjs [carpeta-capturas]
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
async function open(email, width = 390, extra = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, ...extra });
  if (email) await context.addCookies(await sessionCookies(SHIM, email));
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${email}: ${e.message}`));
  return page;
}
const shot = (page, name) => OUT && page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
async function placeOrder(page, name) {
  await page.goto(`${APP}/v/mil948`);
  await page.locator("article.prow", { hasText: name }).getByRole("button", { name: "Agregar", exact: true }).click();
  await page.goto(`${APP}/checkout`);
  await page.getByRole("button", { name: /^Pedir/ }).click();
  await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/, { timeout: 15000 });
  return page.url().split("/").pop();
}
async function advance(bar, code) {
  const card = bar.locator("article.ocard", { hasText: `#${code}` });
  await bar.getByRole("tab", { name: /Nuevos/ }).click();
  await card.getByRole("button", { name: "Aceptar" }).click();
  await bar.getByRole("tab", { name: /Preparando/ }).click();
  await card.getByRole("button", { name: "Marcar listo" }).click();
  await bar.getByRole("tab", { name: /Listos/ }).click();
  await card.waitFor();
}
try {
  const maria = await open(people.maria.email);
  const jorge = await open(people.jorge.email);
  const orderId = await placeOrder(maria, "Margarita");
  const publicCode = (await maria.locator("h1.num").innerText()).replace("#", "");
  await jorge.goto(`${APP}/staff/${mil}`);
  await jorge.locator("article.ocard", { hasText: `#${publicCode}` }).waitFor({ timeout: 15000 });
  check("Barra: cabecera compacta con estado de recepción visible", (await jorge.locator(".reception").innerText()).includes("Recibiendo pedidos"));
  check("Barra: tabs segmentados con contadores", (await jorge.getByRole("tab", { name: /Nuevos/ }).innerText()).match(/\d/) !== null);
  const card = jorge.locator("article.ocard", { hasText: `#${publicCode}` });
  check("Tarjeta nueva: miniatura, cantidades, hora de entrada y cuenta regresiva",
    (await card.locator(".mini").count()) > 0 && /Entró a las/.test(await card.innerText()) && /0[0-4]:[0-5]\d/.test(await card.innerText()));
  const accept = card.getByRole("button", { name: "Aceptar" });
  check("Aceptar es verde y Rechazar secundario",
    (await accept.getAttribute("class")).includes("success") &&
      (await card.getByRole("button", { name: "Rechazar" }).getAttribute("class")).includes("secondary"));
  check("«Validar retiro» fijo abajo en teléfono", await jorge.locator(".pickup-dock").isVisible());
  await jorge.getByRole("button", { name: "Ajustes" }).click();
  const settings = jorge.getByRole("dialog");
  check("Ajustes: recepción, sonido y salir; sin cierre del local para empleado",
    (await settings.getByText("Recibir pedidos nuevos").count()) === 1 &&
      (await settings.getByText("Sonido de pedidos nuevos").count()) === 1 &&
      (await settings.getByRole("button", { name: "Salir" }).count()) === 1 &&
      (await settings.getByText(/Cerrar el local/).count()) === 0);
  await shot(jorge, "e3-ajustes");
  await jorge.keyboard.press("Escape");
  await shot(jorge, "e3-barra-390");
  await advance(jorge, publicCode);
  check("Pedido avanza Nuevos → Preparando → Listos", true);

  await maria.reload();
  const ticketCode = (await maria.locator(".ticket .code").innerText()).replace(/\s/g, "");
  check("Ticket listo: QR, «Código privado» con candado y código en grupos de cuatro",
    (await maria.locator(".ticket .qr img").count()) === 1 && (await maria.locator(".private-label svg").count()) === 1 && /^[0-9A-F]{12}$/.test(ticketCode));
  await shot(maria, "e3-ticket");

  // Retiro: escáner primero → sin cámara cae a manual sin perder el contexto.
  await jorge.locator(".pickup-dock").getByRole("button", { name: "Validar retiro" }).click();
  const sheet = jorge.getByRole("dialog");
  await sheet.getByLabel("Código privado").waitFor({ timeout: 10000 });
  check("Sin cámara/permiso, el escáner pasa al código manual con aviso", /cámara|no lee QR/i.test(await sheet.innerText()));
  const field = sheet.getByLabel("Código privado");
  await field.focus();
  await jorge.evaluate((text) => {
    const data = new DataTransfer();
    data.setData("text", text);
    document.activeElement.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, ticketCode.toLowerCase().replace(/(.{4})(.{4})(.{4})/, "$1-$2-$3"));
  check("Pegar con guiones se normaliza a «AB12 CD34 EF56»", (await field.inputValue()) === ticketCode.replace(/(.{4})(.{4})(.{4})/, "$1 $2 $3"), await field.inputValue());
  await sheet.getByRole("button", { name: "Validar" }).click();
  await sheet.getByText("Cobro simulado", { exact: true }).waitFor();
  check("Resumen con artículos y monto; entrega deshabilitada antes del cobro",
    (await sheet.getByText("Margarita").count()) > 0 && (await sheet.getByRole("button", { name: "Confirmar entrega" }).isDisabled()));
  await shot(jorge, "e3-retiro-resumen");
  await sheet.getByRole("button", { name: /Confirmar cobro simulado/ }).click();
  await sheet.getByText("Cobro confirmado (simulado).").waitFor();
  check("Tras el cobro ya no se ofrece «Validar otro código» (se retoma la entrega)", (await sheet.getByRole("button", { name: "Validar otro código" }).count()) === 0);
  // Corte entre cobro y entrega: se cierra el panel y se retoma desde la incidencia sin volver a cobrar.
  await jorge.keyboard.press("Escape");
  await jorge.getByRole("button", { name: "Retomar entrega" }).click();
  const resume = jorge.getByRole("dialog");
  await resume.getByText("Cobro confirmado (simulado).").waitFor();
  check("«Retomar entrega» vuelve al paso de entrega sin un segundo cobro", (await resume.getByRole("button", { name: /Confirmar cobro simulado/ }).count()) === 0);
  await resume.getByLabel("Entregué físicamente el pedido completo.").check();
  await resume.getByRole("button", { name: "Confirmar entrega" }).click();
  await resume.getByText(`Entregado #${publicCode}`).waitFor();
  check("Confirmación verde de entrega y vuelta a la cola", (await resume.getByRole("button", { name: "Volver a la cola" }).count()) === 1);
  await resume.getByRole("button", { name: "Volver a la cola" }).click();

  await maria.reload();
  await maria.getByText("¡Disfrutá!").waitFor({ timeout: 10000 });
  check("Cliente: «¡Disfrutá!» con la mano levantando el vasito tras la entrega física", (await maria.locator(".enjoy-hand").count()) === 1);
  await shot(maria, "e3-disfruta");
  await maria.reload();
  await maria.getByText("Entregado · comprobante").waitFor({ timeout: 10000 }).catch(() => undefined);
  check("En el historial queda el comprobante y no se repite la animación",
    (await maria.getByText("¡Disfrutá!").count()) === 0 && (await maria.getByText("Entregado · comprobante").count()) === 1);
  await maria.goto(`${APP}/orders/${orderId}`);

  // Dos empleados ante el mismo pedido.
  const second = await placeOrder(maria, "Paloma");
  const code2 = (await maria.locator("h1.num").innerText()).replace("#", "");
  await jorge.reload();
  await jorge.locator("article.ocard", { hasText: `#${code2}` }).waitFor({ timeout: 15000 });
  await advance(jorge, code2);
  await maria.goto(`${APP}/orders/${second}`);
  const code2Ticket = (await maria.locator(".ticket .code").innerText()).replace(/\s/g, "");
  await jorge.locator(".pickup-dock").getByRole("button", { name: "Validar retiro" }).click();
  await jorge.getByRole("dialog").getByLabel("Código privado").fill(code2Ticket);
  await jorge.getByRole("dialog").getByRole("button", { name: "Validar" }).click();
  await jorge.getByRole("dialog").getByText("Cobro simulado", { exact: true }).waitFor();
  const ana = await open(people.ana.email);
  await ana.goto(`${APP}/staff/${mil}`);
  await ana.locator(".pickup-dock").getByRole("button", { name: "Validar retiro" }).click();
  await ana.getByRole("dialog").getByLabel("Código privado").fill(code2Ticket);
  await ana.getByRole("dialog").getByRole("button", { name: "Validar" }).click();
  await ana.getByRole("dialog").getByText(/Otra persona está atendiendo este retiro/).waitFor({ timeout: 10000 });
  check("Segundo empleado con el mismo código: no puede cobrar ni entregar", (await ana.getByRole("dialog").getByRole("button", { name: /Confirmar cobro/ }).count()) === 0);
  check("Admin ve «Cerrar el local» en Ajustes", await (async () => {
    await ana.keyboard.press("Escape");
    await ana.getByRole("button", { name: "Ajustes" }).click();
    return (await ana.getByRole("dialog").getByText(/Cerrar el local/).count()) === 1;
  })());

  // Entrada por membresía.
  const anaLogin = await open(people.ana.email);
  await anaLogin.goto(`${APP}/equipo/acceso`);
  await anaLogin.waitForURL(/\/equipo\/locales/);
  const picker = await anaLogin.locator(".venue-pick").allInnerTexts();
  check("Con dos locales: selector con acción según rol (Administrar / Abrir barra)",
    picker.length === 2 && picker.some((t) => t.includes("Mil948") && t.includes("Administrar")) && picker.some((t) => t.includes("Stiefel") && t.includes("Abrir barra") && !t.includes("Administrar")));
  await shot(anaLogin, "e3-selector");
  const luis = await open(people.luis.email);
  await luis.goto(`${APP}/equipo/acceso`);
  await luis.waitForURL(/\/equipo\/clave/);
  check("Clave temporal pendiente: primero cambiarla", luis.url().includes("/equipo/clave"));
} catch (e) {
  check("Recorrido sin excepciones", false, e.message.split("\n")[0]);
} finally {
  check("Sin errores de página", errors.length === 0, errors.join(" | "));
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} comprobaciones`);
  process.exit(results.every(Boolean) ? 0 : 1);
}
