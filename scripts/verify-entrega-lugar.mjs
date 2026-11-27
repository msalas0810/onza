// Entrega en el lugar y mejoras de administración. Recorrido en navegador contra la app local (scripts/local-shim + next dev).
// No toca bases remotas. Uso: ONZA_APP=http://127.0.0.1:3100 node scripts/verify-entrega-lugar.mjs [carpeta-capturas]
// El shim no tiene Realtime: el aviso de WebSocket de la consola se ignora (la app refresca por consulta).
// Requiere el shim recién iniciado (estado limpio: el recorrido crea pedidos) y la app apuntando a él (ver docs/Onza-Guia-tecnica.md).
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { people } from "./local-shim/index.mjs";
import { sessionCookies } from "./local-shim/session.mjs";
import { stableId } from "./lib/real-venues-seed.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const APP = process.env.ONZA_APP ?? "http://127.0.0.1:3100";
const SHIM = process.env.SHIM_URL ?? "http://127.0.0.1:54321";
const OUT = process.argv[2];
if (OUT) mkdirSync(OUT, { recursive: true });
const PICNIC = "20000000-0000-4000-8000-000000000004";
const mil948 = stableId("onza-real-venue", "mil948");
const spotId = (n) => `50000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
const errors = [];
async function open(email, width = 390, height = 844, { anonymous = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true });
  if (!anonymous) await context.addCookies(await sessionCookies(SHIM, email));
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${email}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource|realtime\/v1\/websocket/.test(m.text()) && errors.push(`${email} @ ${page.url()}: ${m.text().slice(0, 3500)}`));
  return page;
}
// Playwright oculta el cursor de los campos al capturar; si lo hace mientras la página se hidrata, React avisa de una diferencia
// que no es de la app. Se espera a que termine de cargar.
const shot = async (page, name) => {
  if (!OUT) return;
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
};
const text = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");
const addToCart = (page, name) =>
  page.locator("article.prow", { hasText: name }).getByRole("button", { name: "Agregar", exact: true }).click();
const command = (page, body) =>
  page.request.post(`${APP}/api/commands`, { headers: { origin: APP, "content-type": "application/json" }, data: body });
async function openLane(page, label) {
  const tab = page.getByRole("tab", { name: new RegExp(`^${label}`) });
  if (await tab.isVisible().catch(() => false)) await tab.click();
}
async function deliverWithCode(staff, code, { spotLabel } = {}) {
  await staff.getByRole("button", { name: /Entregar en|Validar retiro/ }).first().click();
  await staff.getByLabel("Código privado").fill(code);
  await staff.getByRole("button", { name: "Validar", exact: true }).click();
  if (spotLabel) await staff.getByText(`Entregar en ${spotLabel}`).waitFor({ timeout: 10000 });
  await staff.getByRole("button", { name: /Confirmar cobro simulado/ }).click();
  await staff.getByText("Cobro confirmado (simulado).").waitFor({ timeout: 10000 });
  await staff.getByLabel(/Entregué/).check();
  await staff.getByRole("button", { name: "Confirmar entrega" }).click();
  return staff.locator(".result.ok").waitFor({ timeout: 10000 });
}

try {
  /* ================= Recorrido 1 · Picnic: entrar → pedir → el equipo ve el lugar → entregar ================= */
  console.log("\n# Recorrido 1 · Picnic");
  const visitor = await open("", 390, 844, { anonymous: true });
  await visitor.goto(`${APP}/v/picnic?spot=${spotId(3)}`);
  check("El QR de una mesa sin sesión pasa por el acceso y conserva el lugar", visitor.url().includes("/acceso?next=") && decodeURIComponent(visitor.url()).includes(`?spot=${spotId(3)}`), visitor.url());
  await visitor.getByText("Continuar con correo").click();
  await visitor.getByLabel("Correo", { exact: true }).fill(people.maria.email);
  await visitor.getByLabel("Contraseña", { exact: true }).fill("cualquiera-largo-1");
  await visitor.getByRole("button", { name: "Ingresar" }).click();
  await visitor.waitForURL(/\/v\/picnic/, { timeout: 15000 });
  await visitor.waitForSelector("article.prow");
  check("Tras ingresar vuelve al menú de Picnic con su mesa ya elegida", (await text(visitor)).includes("Te lo llevamos a Mesa 3 · Terraza"));
  await shot(visitor, "01-picnic-menu-mesa-390");
  await visitor.context().close();

  const maria = await open(people.maria.email);
  const ana = await open(people.ana.email, 1280, 800);
  const jorge = await open(people.jorge.email, 1280, 800);

  await maria.goto(`${APP}/v/picnic?spot=${spotId(3)}`);
  await addToCart(maria, "Spritz");
  await addToCart(maria, "Cerveza");
  await maria.goto(`${APP}/checkout`);
  await maria.getByText("¿Cómo recibís tu pedido?").waitFor();
  // Con mapa, la lista de lugares es la alternativa («¿No ves tu mesa?»): se abre para comprobar los grupos por zona.
  await maria.getByText(/No ves tu mesa/).click();
  const checkoutText = await text(maria);
  check("El checkout ofrece barra o lugar y deja elegida la mesa del QR", checkoutText.includes("Llevarlo a mi mesa") && checkoutText.includes("Retirar en la barra") && checkoutText.includes("Entrega: Mesa 3 · Terraza"));
  check("Los lugares se agrupan por zona (Terraza, Jardín, Zona VIP)", ["Terraza", "Jardín", "Zona VIP"].every((z) => checkoutText.includes(z)));
  await shot(maria, "02-checkout-lugar-390");
  await maria.getByRole("button", { name: /^Pedir/ }).click();
  await maria.getByText(/Te lo llevamos a Mesa 3/).waitFor({ timeout: 15000 });
  await maria.waitForURL(/\/orders\//, { timeout: 15000 });
  await maria.getByText("Entrega en Mesa 3 · Terraza").waitFor();
  check("El seguimiento muestra dónde se entrega", (await text(maria)).includes("Entrega en Mesa 3 · Terraza"));
  await shot(maria, "03-seguimiento-recibido-390");

  // El cliente corrige su lugar.
  await maria.getByRole("button", { name: "Cambiar", exact: true }).click();
  await maria.getByText("¿Dónde estás ahora?").waitFor();
  await maria.getByText(/No ves tu mesa/).click();
  await maria.locator("label.spot", { hasText: /^Mesa 7$/ }).click();
  await maria.getByRole("button", { name: "Confirmar este lugar" }).click();
  await maria.getByText("Entrega en Mesa 7 · Jardín").waitFor({ timeout: 10000 });
  check("El cliente puede cambiar su lugar antes de la entrega", (await text(maria)).includes("Lugar actualizado"));

  // El equipo ve qué lleva y adónde.
  await jorge.goto(`${APP}/staff/${PICNIC}`);
  const card = jorge.locator("article.ocard").first();
  await card.waitFor({ timeout: 15000 });
  const cardText = (await card.innerText()).replace(/\s+/g, " ");
  check("La cola muestra «Llevar a Mesa 7 · Jardín» y avisa que cambió", cardText.includes("Llevar a Mesa 7 · Jardín") && /cambió su lugar a las/.test(cardText), cardText);
  await shot(jorge, "04-cola-nuevo-lugar-1280");
  await jorge.getByRole("button", { name: "Aceptar" }).click();
  await openLane(jorge, "Preparando");
  await jorge.getByRole("button", { name: "Marcar listo" }).click();
  await openLane(jorge, "Listos");
  await jorge.getByRole("button", { name: "Entregar en Mesa 7" }).waitFor({ timeout: 10000 });
  check("En «Listos» el botón dice «Entregar en Mesa 7» y se cuentan los pedidos para llevar", (await text(jorge)).includes("1 listo para llevar"));
  await shot(jorge, "05-cola-listo-llevar-1280");

  await maria.reload();
  await maria.locator("[data-private='pickup']").waitFor({ timeout: 15000 });
  const mariaReady = await text(maria);
  check("El cliente recibe el ticket con QR y código privado para el lugar", mariaReady.includes("Te lo llevamos a") && mariaReady.includes("Mesa 7 · Jardín") && (await maria.locator(".ticket .qr img").count()) === 1);
  await shot(maria, "06-ticket-lugar-390");
  const code = (await maria.locator("[data-private='pickup']").innerText()).replace(/\s+/g, "");

  // Un código del cliente no entrega en otro local.
  await deliverWithCode(jorge, code, { spotLabel: "Mesa 7 · Jardín" });
  const doneText = await jorge.locator(".result.ok").innerText();
  check("La entrega se confirma con el QR/código del cliente y nombra el lugar", /Entregado #\w+ en Mesa 7 · Jardín/.test(doneText.replace(/\s+/g, " ")), doneText.replace(/\s+/g, " "));
  await shot(jorge, "07-entrega-confirmada-1280");
  await jorge.getByRole("button", { name: "Volver a la cola" }).click();
  await jorge.getByText(/Cerrados hoy/).click();
  const closedText = await text(jorge);
  check("«Cerrados hoy» dice dónde, cuándo y quién entregó", /Entregado en Mesa 7 · Jardín a las \d{1,2}:\d{2}/.test(closedText) && closedText.includes("Jorge Mora"));
  await maria.reload();
  await maria.getByText(/entregado en Mesa 7 · Jardín a las/i).waitFor({ timeout: 15000 });
  check("El cliente ve «Entregado en Mesa 7» con la hora", true);
  await shot(maria, "08-seguimiento-entregado-390");

  // Validación en servidor.
  await ana.goto(`${APP}/admin/${PICNIC}?tab=entrega`);
  await ana.getByText("Lugares (13)").waitFor();
  await ana.locator(".r", { hasText: "Mesa 9" }).getByRole("switch").click();
  await ana.getByText("Mesa 9 deshabilitado: ya no se puede elegir.").waitFor({ timeout: 10000 });
  const item = [{ productId: "30000000-0000-4000-8000-000000000017", quantity: 1, expectedProductVersion: 1 }];
  const create = (key, delivery) => ({ action: "create", venueId: PICNIC, items: item, idempotencyKey: key, termsVersion: "demo-v1", privacyVersion: "demo-v1", adult: true, delivery });
  const disabled = await command(maria, create("spot-disabled", { mode: "location", spotId: spotId(9) }));
  check("El servidor rechaza un lugar deshabilitado aunque el navegador lo envíe", disabled.status() === 409 && (await disabled.json()).error === "SPOT_INVALID", `${disabled.status()}`);
  const foreign = await command(maria, { ...create("spot-foreign", { mode: "location", spotId: spotId(1) }), venueId: mil948 });
  check("El servidor rechaza un lugar de otro local (y un local sin entrega en el lugar)", foreign.status() === 409 && ["DELIVERY_UNAVAILABLE", "SPOT_INVALID"].includes((await foreign.json()).error), `${foreign.status()}`);
  const noSpot = await command(maria, create("spot-none", { mode: "location", spotId: "00000000-0000-4000-8000-00000000dead" }));
  check("El servidor rechaza un lugar inexistente", noSpot.status() === 409 && (await noSpot.json()).error === "SPOT_INVALID");
  const options = await (await maria.request.get(`${APP}/api/delivery?venue=${PICNIC}`)).json();
  check("El checkout no recibe lugares deshabilitados", !options.spots.some((s) => s.label === "Mesa 9") && options.spots.length === 12);

  /* ================= Recorrido 2 · local normal: barra → retirar con código ================= */
  console.log("\n# Recorrido 2 · local normal (Mil948)");
  const sofia = await open(people.sofia.email);
  await sofia.goto(`${APP}/v/mil948`);
  check("Un local solo de barra no muestra entrada por lugar", !(await text(sofia)).includes("te lo llevamos"));
  await addToCart(sofia, "Margarita");
  await sofia.goto(`${APP}/checkout`);
  await sofia.getByText(/retiro en /).waitFor();
  check("El checkout de un local solo de barra no pregunta por el lugar", !(await text(sofia)).includes("¿Cómo recibís tu pedido?") && (await text(sofia)).includes("retiro en Barra principal"));
  await shot(sofia, "09-checkout-barra-390");
  await sofia.getByRole("button", { name: /^Pedir/ }).click();
  await sofia.waitForURL(/\/orders\//, { timeout: 15000 });
  check("El pedido en barra no lleva lugar", !(await text(sofia)).includes("Entrega en"));
  const barra = await open(people.jorge.email, 1280, 800);
  await barra.goto(`${APP}/staff/${mil948}`);
  await barra.locator("article.ocard").first().waitFor({ timeout: 15000 });
  check("La cola de barra sigue igual: sin lugar ni zona", !(await barra.locator("article.ocard").first().innerText()).includes("Llevar a"));
  await barra.getByRole("button", { name: "Aceptar" }).click();
  await openLane(barra, "Preparando");
  await barra.getByRole("button", { name: "Marcar listo" }).click();
  await openLane(barra, "Listos");
  await barra.getByRole("button", { name: "Validar retiro" }).first().waitFor();
  await sofia.reload();
  await sofia.locator("[data-private='pickup']").waitFor({ timeout: 15000 });
  const sofiaText = await text(sofia);
  check("El ticket de barra dice «Retirá en Barra principal» con QR y código", sofiaText.includes("Retirá en") && sofiaText.includes("Barra principal") && (await sofia.locator(".ticket .qr img").count()) === 1);
  await shot(sofia, "10-ticket-barra-390");
  const barCode = (await sofia.locator("[data-private='pickup']").innerText()).replace(/\s+/g, "");
  await deliverWithCode(barra, barCode);
  check("La barra valida el código, cobra (simulado) y entrega", (await barra.locator(".result.ok").innerText()).includes("Entregado"));
  await sofia.reload();
  await sofia.getByText(/Retirado a las|está entregado\./).waitFor({ timeout: 15000 });
  check("El cliente ve su pedido entregado (momento final o comprobante)", true);
  // Un código de otro pedido no sirve y el número no autoriza.
  const reuse = await command(barra, { action: "resolve", venueId: mil948, code: barCode });
  check("Un código ya usado se rechaza", reuse.status() === 409, `${reuse.status()}`);

  /* ================= Recorrido 3 · administración ================= */
  console.log("\n# Recorrido 3 · administración de Picnic");
  // Un pedido en curso para que «Ahora» y el CSV tengan qué mostrar.
  await maria.goto(`${APP}/v/picnic`);
  await addToCart(maria, "Limonada");
  await maria.goto(`${APP}/checkout`);
  await maria.getByText("¿Cómo recibís tu pedido?").waitFor();
  await maria.getByRole("button", { name: "Llevarlo a mi mesa" }).click();
  await maria.getByText(/No ves tu mesa/).click();
  await maria.locator("label.spot", { hasText: /^VIP 2$/ }).click();
  await maria.getByRole("button", { name: /^Pedir/ }).click();
  await maria.waitForURL(/\/orders\//, { timeout: 15000 });

  await ana.goto(`${APP}/admin/${PICNIC}`); // «Ahora» es la entrada del administrador (D-2026-11-27-01)
  await ana.getByRole("heading", { name: "Ahora", exact: true }).waitFor();
  await ana.getByText(/pedido nuevo espera/).waitFor({ timeout: 15000 });
  const now = await text(ana);
  check("«Ahora» avisa del pedido nuevo que espera aceptación y enlaza a la barra", /1 pedido nuevo espera aceptación/.test(now) && (await ana.getByRole("link", { name: "Ir a la barra" }).count()) >= 1, now.slice(0, 200));
  await shot(ana, "11-admin-resumen-ahora-1280");

  // Pausar y reanudar con un toque, en la misma pantalla «Ahora».
  await ana.getByRole("button", { name: "Pausado" }).click();
  await ana.getByText("Guardado").waitFor({ timeout: 10000 });
  await ana.getByRole("button", { name: "Reanudar pedidos" }).waitFor({ timeout: 10000 });
  await ana.getByRole("button", { name: "Reanudar pedidos" }).click();
  await ana.getByText("El local vuelve a recibir pedidos.").waitFor({ timeout: 10000 });
  check("Un local pausado se reanuda en un toque desde «Ahora»", true);

  // Exportar.
  await ana.goto(`${APP}/admin/${PICNIC}?tab=resumen`);
  const [download] = await Promise.all([ana.waitForEvent("download"), ana.getByRole("button", { name: "Exportar CSV" }).click()]);
  const path = await download.path();
  const csv = readFileSync(path, "utf8");
  if (OUT) writeFileSync(`${OUT}/export-ejemplo.csv`, csv);
  check("El CSV trae encabezados, lugar, zona, hora y quién entregó", csv.startsWith("﻿Noche operativa,Pedido,Estado,Entrega,Lugar,Zona") && csv.includes("Mesa 7") && csv.includes("Jardín") && csv.includes("Jorge Mora") && csv.includes("VIP 2"), csv.split("\r\n")[1]);
  check("El CSV no incluye datos de clientes", !/maria|correo\.demo|@/.test(csv));

  // Configuración de la entrega.
  await ana.goto(`${APP}/admin/${PICNIC}?tab=entrega`);
  await ana.getByRole("heading", { name: "Listo para operar" }).waitFor();
  check("«Entrega» muestra la lista de requisitos del local", (await text(ana)).includes("Todo listo") || (await text(ana)).includes("Falta algo"));
  await shot(ana, "12-admin-entrega-1280");
  await ana.getByRole("group", { name: "Cómo reciben los clientes" }).getByRole("button", { name: "Solo barra" }).click();
  await ana.getByRole("button", { name: "Guardar", exact: true }).first().click();
  await ana.getByText("Guardado: solo retiro en la barra.").waitFor({ timeout: 10000 });
  const offer = await (await maria.request.get(`${APP}/api/delivery?venue=${PICNIC}`)).json();
  check("Con «Solo barra» el cliente deja de recibir lugares", offer.mode === "bar" && offer.spots.length === 0);
  const rejected = await command(maria, create("mode-bar", { mode: "location", spotId: spotId(2) }));
  check("Con «Solo barra» el servidor rechaza pedidos al lugar", rejected.status() === 409 && (await rejected.json()).error === "DELIVERY_UNAVAILABLE");
  await ana.getByRole("group", { name: "Cómo reciben los clientes" }).getByRole("button", { name: "Solo lugar" }).click();
  await ana.getByRole("button", { name: "Guardar", exact: true }).first().click();
  await ana.getByText("Guardado: la entrega en el lugar está activa.").waitFor({ timeout: 10000 });
  const only = await command(maria, create("only-loc-bar", { mode: "bar" }));
  check("Con «Solo lugar» el servidor exige elegir un lugar", only.status() === 409 && (await only.json()).error === "SPOT_REQUIRED");
  await ana.getByRole("group", { name: "Cómo reciben los clientes" }).getByRole("button", { name: "Barra y lugar" }).click();
  await ana.getByLabel("Cómo se llaman los lugares").fill("Mesa");
  await ana.getByRole("button", { name: "Guardar", exact: true }).first().click();
  await ana.getByText("Guardado: la entrega en el lugar está activa.").waitFor({ timeout: 10000 });

  // Altas por rango, QR e impresión.
  const bulk = ana.locator("form", { hasText: "Crear varios de una vez" });
  await bulk.getByLabel("Nombre", { exact: true }).fill("Barra alta");
  await bulk.getByLabel("Zona (opcional)").fill("Barra");
  await bulk.getByLabel("Desde").fill("1");
  await bulk.getByLabel("Hasta").fill("4");
  await bulk.getByRole("button", { name: "Crear lugares" }).click();
  await ana.getByText(/Se crearon 4 lugares/).waitFor({ timeout: 10000 });
  await ana.getByText("Barra alta 4").first().waitFor({ timeout: 10000 });
  check("Crear varios lugares de una vez funciona y los agrupa por zona", (await text(ana)).includes("Barra alta 4"));
  await ana.getByRole("button", { name: "QR de Mesa 1", exact: true }).click();
  await ana.locator(".sheet img.qr-img").waitFor({ timeout: 10000 });
  check("Cada lugar tiene su QR con el enlace al local y su lugar", (await text(ana)).includes(`/v/picnic?spot=${spotId(1)}`));
  await shot(ana, "13-admin-qr-lugar-1280");
  await ana.keyboard.press("Escape");
  await ana.goto(`${APP}/admin/${PICNIC}/qr`);
  await ana.locator(".qr-card").first().waitFor();
  check("La hoja de impresión trae el QR del local y el de cada lugar habilitado", (await ana.locator(".qr-card").count()) === 17, `${await ana.locator(".qr-card").count()} QR`);
  await shot(ana, "14-admin-qr-imprimir-1280");
  // Un empleado no administra la entrega ni exporta.
  const staffCfg = await command(jorge, { action: "venue_delivery", venueId: PICNIC, mode: "bar" });
  check("Un empleado no puede cambiar la configuración de entrega", staffCfg.status() === 403 || staffCfg.status() === 409, `${staffCfg.status()}`);
  const staffExport = await jorge.request.get(`${APP}/api/export?venue=${PICNIC}&from=2026-01-01&to=2026-12-31`);
  check("Un empleado no puede exportar", staffExport.status() === 403, `${staffExport.status()}`);
  const customerExport = await maria.request.get(`${APP}/api/export?venue=${PICNIC}&from=2026-11-01&to=2026-11-30`);
  check("Un cliente no puede exportar", [401, 403].includes(customerExport.status()), `${customerExport.status()}`);

  /* ================= Móvil y escritorio ================= */
  console.log("\n# Revisión de tamaños");
  for (const [w, h, tag] of [[360, 740, "360"], [1280, 800, "1280"]]) {
    const page = await open(people.ana.email, w, h);
    await page.goto(`${APP}/admin/${PICNIC}?tab=entrega`);
    await page.getByRole("heading", { name: /^Lugares \(\d+\)$/ }).waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`Administración · Entrega sin desborde horizontal a ${w}px`, overflow <= 1, `${overflow}px`);
    await shot(page, `15-admin-entrega-${tag}`);
    await page.context().close();
  }
  const phone = await open(people.maria.email, 360, 740);
  await phone.goto(`${APP}/v/picnic`);
  await addToCart(phone, "Spritz");
  await phone.goto(`${APP}/checkout`);
  await phone.getByText("¿Cómo recibís tu pedido?").waitFor();
  await phone.getByRole("button", { name: "Llevarlo a mi mesa" }).click();
  await phone.getByText(/No ves tu mesa/).click();
  await phone.locator("label.spot span").first().waitFor();
  const phoneOverflow = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const touch = await phone.locator("label.spot span").first().boundingBox();
  check("Checkout a 360px sin desborde y con botones de al menos 44 px", phoneOverflow <= 1 && touch && touch.height >= 44, `${phoneOverflow}px · ${touch?.height}px`);
  await shot(phone, "16-checkout-lugar-360");
  const queue = await open(people.jorge.email, 360, 740);
  await queue.goto(`${APP}/staff/${PICNIC}`);
  await queue.waitForSelector("article.ocard", { timeout: 15000 });
  const queueOverflow = await queue.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("La cola a 360px no se desborda", queueOverflow <= 1, `${queueOverflow}px`);
  await shot(queue, "17-cola-360");
  check("Sin errores de consola ni excepciones de página", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (error) {
  check("El recorrido terminó sin interrupciones", false, String(error?.stack ?? error).slice(0, 600));
} finally {
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones`);
  if (OUT) writeFileSync(`${OUT}/verificacion.json`, JSON.stringify({ app: APP, at: new Date().toISOString(), results }, null, 2));
  process.exit(failed.length ? 1 : 0);
}
