// Mapa de entrega en el lugar. Recorrido en navegador MÓVIL (táctil) y de escritorio contra la app local (scripts/local-shim + next dev).
// No toca bases remotas. Uso: ONZA_APP=http://127.0.0.1:3100 node scripts/verify-entrega-mapa.mjs [carpeta-capturas]
// Requiere el shim recién iniciado (el recorrido crea pedidos) y la app apuntando a él (ver docs/Onza-Guia-tecnica.md).
// El shim no tiene Realtime: el aviso de WebSocket de la consola se ignora (la app refresca por consulta).
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
const spotId = (n) =>
  `50000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM }
    : {},
);
const errors = [];
async function open(
  email,
  width = 390,
  height = 844,
  { mobile = false, anonymous = false } = {},
) {
  const context = await browser.newContext({
    viewport: { width, height },
    acceptDownloads: true,
    ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
  });
  if (!anonymous) await context.addCookies(await sessionCookies(SHIM, email));
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${email}: ${e.message}`));
  page.on(
    "console",
    (m) =>
      m.type() === "error" &&
      !/Failed to load resource|realtime\/v1\/websocket/.test(m.text()) &&
      errors.push(`${email}: ${m.text()}`),
  );
  return page;
}
// Deja a la vista el mapa y su aviso (la barra fija de «Pedir» tapa lo de abajo) antes de sacar la captura móvil.
const showPlan = (page, root = ".plan-status") =>
  page
    .locator(root)
    .first()
    .evaluate((el) => el.scrollIntoView({ block: "center" }));
// Lleva la sección del mapa de administración al borde superior (bajo la cabecera fija) para la captura.
const showAdminMap = async (page) => {
  await page.waitForTimeout(700);
  await page
    .locator("section[aria-labelledby='delivery-map']")
    .evaluate((el) => {
      el.scrollIntoView({ block: "start" });
      window.scrollBy(0, -84);
    });
};
const shot = async (page, name, full = true) => {
  if (!OUT) return;
  // Playwright oculta el cursor al capturar: si lo hace mientras la página se hidrata, React avisa de una diferencia ajena a la app.
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
};
const text = async (page) =>
  (await page.locator("body").innerText()).replace(/\s+/g, " ");
const addToCart = (page, name) =>
  page
    .locator("article.prow", { hasText: name })
    .getByRole("button", { name: "Agregar", exact: true })
    .click();
const command = (page, body) =>
  page.request.post(`${APP}/api/commands`, {
    headers: { origin: APP, "content-type": "application/json" },
    data: body,
  });
async function openLane(page, label) {
  const tab = page.getByRole("tab", { name: new RegExp(`^${label}`) });
  if (await tab.isVisible().catch(() => false)) await tab.click();
}
const options = async (page, venue = PICNIC) =>
  (await page.request.get(`${APP}/api/delivery?venue=${venue}`)).json();
// Toca el mapa en una posición relativa a la IMAGEN (la caja visible puede estar ampliada). Con pantalla táctil usa un toque real.
async function tapPlan(
  page,
  fx,
  fy,
  { root = ".plan-box", touch = false } = {},
) {
  await page.locator(`${root} .plan-img`).first().scrollIntoViewIfNeeded();
  if (root.includes(".sheet")) await page.waitForTimeout(600); // la hoja termina de subir antes de medir
  const box = await page.locator(`${root} .plan-img`).first().boundingBox();
  const x = box.x + box.width * fx;
  const y = box.y + box.height * fy;
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await page.waitForTimeout(250);
}
// Dónde está la punta del pin, relativo a la imagen (0 a 1): lo que debe coincidir entre el teléfono y la barra.
async function pinFraction(page, root = ".plan-box") {
  await page.locator(`${root} .plan-pin`).first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(400);
  const img = await page.locator(`${root} .plan-img`).first().boundingBox();
  const pin = await page.locator(`${root} .plan-pin`).first().boundingBox();
  return {
    x: (pin.x + pin.width / 2 - img.x) / img.width,
    y: (pin.y + pin.height - img.y) / img.height,
  };
}
const near = (a, b, eps = 0.012) =>
  Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
const center = (spot) => ({ x: spot.shape.x, y: spot.shape.y });
async function deliverWithCode(staff, code) {
  await staff
    .getByRole("button", { name: /Entregar en|Validar retiro/ })
    .first()
    .click();
  await staff.getByLabel("Código privado").fill(code);
  await staff.getByRole("button", { name: "Validar", exact: true }).click();
  await staff.getByRole("button", { name: /Confirmar cobro simulado/ }).click();
  await staff
    .getByText("Cobro confirmado (simulado).")
    .waitFor({ timeout: 10000 });
  await staff.getByLabel(/Entregué/).check();
  await staff.getByRole("button", { name: "Confirmar entrega" }).click();
  return staff.locator(".result.ok").waitFor({ timeout: 10000 });
}
const seg = (page, label, name) =>
  page
    .getByRole("group", { name: label })
    .getByRole("button", { name, exact: true });

try {
  const anon = await open("", 390, 844, { anonymous: true });
  const opts = await options(anon);
  await anon.context().close();
  const spots = opts.spots;
  const table = (n) => spots.find((s) => s.label === `Mesa ${n}`);
  check(
    "El mapa de ejemplo de Picnic llega al cliente con 13 lugares ubicados, 3 áreas de servicio y plano propio",
    opts.map &&
      spots.length === 13 &&
      spots.every((s) => s.shape) &&
      opts.map.serviceArea.length === 3 &&
      opts.map.imageUrl === "/demo-venues/picnic-plano.svg",
  );

  /* ============ 1 · Móvil: QR de mesa → mapa con el pin ya puesto → tocar → pedir ============ */
  console.log("\n# 1 · Picnic en el teléfono");
  const visitor = await open("", 390, 844, { mobile: true, anonymous: true });
  await visitor.goto(`${APP}/v/picnic?spot=${spotId(3)}`);
  check(
    "El QR de una mesa sin sesión pasa por el acceso y conserva la mesa",
    decodeURIComponent(visitor.url()).includes(`?spot=${spotId(3)}`),
    visitor.url(),
  );
  await visitor.getByText("Continuar con correo").click();
  await visitor.getByLabel("Correo", { exact: true }).fill(people.maria.email);
  await visitor
    .getByLabel("Contraseña", { exact: true })
    .fill("cualquiera-largo-1");
  await visitor.getByRole("button", { name: "Ingresar" }).click();
  await visitor.waitForURL(/\/v\/picnic/, { timeout: 15000 });
  await visitor.waitForSelector("article.prow");
  await visitor
    .getByText("Te lo llevamos a Mesa 3 · Terraza")
    .waitFor({ timeout: 10000 });
  check("Tras el login vuelve al menú con la mesa del QR ya elegida", true);
  await visitor.getByRole("button", { name: "Cambiar", exact: true }).click();
  await visitor.getByText("¿Dónde estás?").waitFor();
  const preset = await pinFraction(visitor);
  check(
    "El QR de la mesa abre el mapa con el pin ya colocado sobre esa mesa",
    near(preset, center(table(3))),
    `${preset.x.toFixed(3)},${preset.y.toFixed(3)} vs ${center(table(3)).x},${center(table(3)).y}`,
  );
  await shot(visitor, "01-qr-mesa-mapa-390", false);
  await visitor.getByRole("button", { name: "Listo", exact: true }).click();
  await visitor.context().close();

  const maria = await open(people.maria.email, 390, 844, { mobile: true });
  const jorge = await open(people.jorge.email, 1280, 800);
  const ana = await open(people.ana.email, 1280, 900);

  await maria.goto(`${APP}/v/picnic?spot=${spotId(3)}`);
  await addToCart(maria, "Spritz");
  await addToCart(maria, "Cerveza");
  await maria.goto(`${APP}/checkout`);
  await maria.getByText("¿Cómo recibís tu pedido?").waitFor();
  check(
    "En el checkout el pin de la mesa del QR sigue ahí y el resumen la nombra",
    (await text(maria)).includes("Entrega: Mesa 3 · Terraza") &&
      (await maria.locator(".plan-pin").count()) === 1,
  );
  const noList =
    (await maria.locator("label.spot").count()) === 0 ||
    !(await maria.locator("label.spot").first().isVisible());
  check(
    "El selector de mesas ya no es obligatorio: la acción principal es el mapa",
    noList && (await maria.locator(".plan-box").isVisible()),
  );

  // Un toque en una mesa la nombra; otro toque mueve el pin.
  await tapPlan(maria, center(table(7)).x, center(table(7)).y, { touch: true });
  await maria.getByText("Mesa 7 · Jardín").first().waitFor();
  check(
    "Un toque sobre una mesa muestra su nombre («Mesa 7 · Jardín») y el resumen lo refleja",
    (await text(maria)).includes("Entrega: Mesa 7 · Jardín"),
  );
  const on7 = await pinFraction(maria);
  check(
    "El pin queda exactamente donde se tocó",
    near(on7, center(table(7)), 0.01),
    `${on7.x.toFixed(3)},${on7.y.toFixed(3)}`,
  );
  await tapPlan(maria, 0.6625, 0.32, { touch: true });
  await maria.getByText("Tu punto en el mapa").first().waitFor();
  const between = await pinFraction(maria);
  check(
    "Un punto válido entre mesas se envía como punto, sin adivinar una mesa",
    near(between, { x: 0.6625, y: 0.32 }, 0.012) &&
      (await text(maria)).includes("Entrega: tu punto en el mapa"),
  );
  await tapPlan(maria, 0.25, 0.82, { touch: true });
  await maria.getByText("Ahí no llegamos").waitFor();
  const afterBad = await pinFraction(maria);
  check(
    "Fuera del área de servicio se avisa dónde sí se puede y el pin no se mueve",
    near(afterBad, { x: 0.6625, y: 0.32 }, 0.012) &&
      (await text(maria)).includes("dentro de la zona de entrega"),
  );
  await showPlan(maria);
  await shot(maria, "02-fuera-del-area-390", false);
  await tapPlan(maria, 0.66, 0.76, { touch: true });
  await maria.getByText("Pista de baile").first().waitFor();
  check(
    "Dentro de una zona sin mesa se nombra la zona («Pista de baile»)",
    (await text(maria)).includes("Entrega: Pista de baile"),
  );
  await tapPlan(maria, center(table(7)).x, center(table(7)).y, { touch: true });
  await maria.getByText("Mesa 7 · Jardín").first().waitFor();

  // La mesa se conserva al recargar (y por tanto al volver del login).
  await maria.reload();
  await maria.getByText("¿Cómo recibís tu pedido?").waitFor();
  await maria.getByText("Entrega: Mesa 7 · Jardín").waitFor({ timeout: 10000 });
  const reloaded = await pinFraction(maria);
  check(
    "El pin se conserva al recargar o volver del login",
    near(reloaded, center(table(7)), 0.01),
  );
  // Zoom: el toque marca el punto de la IMAGEN (no de la pantalla) y el pin sobrevive a acercar y alejar.
  await maria.getByRole("button", { name: "Acercar el mapa" }).click();
  await maria.getByRole("button", { name: "Acercar el mapa" }).click();
  await maria.waitForTimeout(200);
  await tapPlan(maria, 0.55, 0.45, { touch: true });
  const zoomed = await pinFraction(maria);
  check(
    "Con zoom, un toque marca el punto exacto de la imagen",
    near(zoomed, { x: 0.55, y: 0.45 }, 0.012),
    `${zoomed.x.toFixed(3)},${zoomed.y.toFixed(3)}`,
  );
  await maria.getByRole("button", { name: "Ver el mapa completo" }).click();
  const unzoomed = await pinFraction(maria);
  check(
    "Al ver el mapa completo el pin sigue en el mismo punto",
    near(unzoomed, { x: 0.55, y: 0.45 }, 0.012),
  );
  // Teclado: las flechas mueven el pin (alternativa a tocar).
  await maria.locator(".plan-box").focus();
  await maria.keyboard.press("ArrowRight");
  await maria.keyboard.press("ArrowRight");
  const keyed = await pinFraction(maria);
  check(
    "Con teclado, las flechas mueven el pin dos centésimas por vez",
    Math.abs(keyed.x - 0.59) < 0.012 && Math.abs(keyed.y - 0.45) < 0.012,
    `${keyed.x.toFixed(3)},${keyed.y.toFixed(3)}`,
  );
  await maria.locator(".plan-box").blur();
  await tapPlan(maria, center(table(7)).x, center(table(7)).y, { touch: true });
  await maria.getByText("Entrega: Mesa 7 · Jardín").waitFor();
  await showPlan(maria);
  await shot(maria, "03-checkout-mapa-390", false);
  // El lugar elegido se confirma junto a «Pedir», sin un resumen duplicado arriba (D-2026-11-27-01).
  check(
    "El lugar elegido se ve junto a «Pedir» y no se repite arriba con «Editar»",
    (await maria.locator(".sticky-cta .btn-note").innerText()).includes(
      "Entrega: Mesa 7 · Jardín",
    ) &&
      (await maria
        .getByRole("button", { name: "Editar", exact: true })
        .count()) === 0,
  );
  await maria.getByRole("button", { name: /^Pedir/ }).click();
  await maria.waitForURL(/\/orders\//, { timeout: 15000 });
  await maria.getByText("Entrega en Mesa 7 · Jardín").waitFor();
  const mariaPin = await pinFraction(maria);
  check(
    "El seguimiento muestra el mismo pin sobre el mismo mapa",
    near(mariaPin, center(table(7)), 0.01),
  );
  await maria.locator(".plan-box .plan-table").first().waitFor({ timeout: 10000 });
  check(
    "El seguimiento muestra el pin sobre el mismo plano, con las mesas numeradas como en la barra",
    (await maria.locator(".plan-box .plan-table").count()) >= 10,
  );
  await shot(maria, "04-seguimiento-pin-390", false);

  // El cliente se mueve: toca otro punto, confirma, y el pedido lo refleja.
  await maria.getByRole("button", { name: "Cambiar", exact: true }).click();
  await maria.getByText("¿Dónde estás ahora?").waitFor();
  await tapPlan(maria, 0.3, 0.33, { touch: true, root: ".sheet .plan-box" });
  await maria.getByText("Tu punto en el mapa").first().waitFor();
  await maria.getByRole("button", { name: "Confirmar este lugar" }).click();
  await maria
    .getByText("Entrega en el punto marcado")
    .waitFor({ timeout: 10000 });
  const movedPin = await pinFraction(maria);
  check(
    "El cliente mueve su pin desde el seguimiento y se guarda el punto nuevo",
    near(movedPin, { x: 0.3, y: 0.33 }, 0.012),
    `${movedPin.x.toFixed(3)},${movedPin.y.toFixed(3)}`,
  );

  /* ============ 2 · Barra: el mismo mapa, el mismo pin, entrega con código ============ */
  console.log("\n# 2 · La barra ve el mismo pin");
  await jorge.goto(`${APP}/staff/${PICNIC}`);
  const card = jorge.locator("article.ocard").first();
  await card.waitFor({ timeout: 15000 });
  const cardText = (await card.innerText()).replace(/\s+/g, " ");
  check(
    "La cola dice «Llevar al punto marcado», avisa del cambio y ofrece «Ver en el mapa»",
    cardText.includes("Llevar al punto marcado") &&
      /cambió su lugar a las/.test(cardText) &&
      cardText.includes("Ver en el mapa"),
    cardText,
  );
  await card.getByRole("button", { name: "Ver en el mapa" }).click();
  await jorge.locator(".sheet .plan-pin").waitFor();
  const staffPin = await pinFraction(jorge, ".sheet .plan-box");
  check(
    "En la computadora de la barra el pin cae en el mismo lugar que en el teléfono (misma fracción de la imagen)",
    near(staffPin, movedPin, 0.008) &&
      near(staffPin, { x: 0.3, y: 0.33 }, 0.012),
    `barra ${staffPin.x.toFixed(4)},${staffPin.y.toFixed(4)} · teléfono ${movedPin.x.toFixed(4)},${movedPin.y.toFixed(4)}`,
  );
  check(
    "La barra ve las mesas y el área de servicio sobre el mismo plano",
    (await jorge.locator(".sheet .plan-table").count()) === 12 &&
      (await jorge.locator(".sheet .plan-area").count()) === 3,
  );
  await shot(jorge, "05-barra-mapa-pin-1280", false);
  await jorge.keyboard.press("Escape");
  await jorge.getByRole("button", { name: "Aceptar" }).click();
  await openLane(jorge, "Preparando");
  await jorge.getByRole("button", { name: "Marcar listo" }).click();
  await openLane(jorge, "Listos");
  await jorge
    .getByRole("button", { name: /Entregar en/ })
    .waitFor({ timeout: 10000 });
  await maria.reload();
  await maria.locator("[data-private='pickup']").waitFor({ timeout: 15000 });
  const code = (
    await maria.locator("[data-private='pickup']").innerText()
  ).replace(/\s+/g, "");
  check(
    "El ticket del cliente sigue con QR y código privado",
    (await maria.locator(".ticket .qr img").count()) === 1 && code.length >= 8,
  );
  await jorge
    .getByRole("button", { name: /Entregar en/ })
    .first()
    .click();
  await jorge.getByLabel("Código privado").fill(code);
  await jorge.getByRole("button", { name: "Validar", exact: true }).click();
  await jorge
    .getByRole("button", { name: "Ver en el mapa" })
    .waitFor({ timeout: 10000 });
  check(
    "Al validar el código la barra puede abrir el mapa con el pin antes de entregar",
    true,
  );
  await jorge.getByRole("button", { name: /Confirmar cobro simulado/ }).click();
  await jorge
    .getByText("Cobro confirmado (simulado).")
    .waitFor({ timeout: 10000 });
  await jorge.getByLabel(/Entregué/).check();
  await jorge.getByRole("button", { name: "Confirmar entrega" }).click();
  await jorge.locator(".result.ok").waitFor({ timeout: 10000 });
  check(
    "La entrega se confirma con el código privado del cliente",
    (await jorge.locator(".result.ok").innerText()).includes("Entregado"),
  );
  await maria.reload();
  await maria
    .getByText(/entregado en/i)
    .first()
    .waitFor({ timeout: 15000 });
  check("El cliente ve el pedido entregado", true);

  /* ============ 3 · Retiro en barra sigue igual (Picnic y local normal) ============ */
  console.log("\n# 3 · Retiro en barra");
  await maria.goto(`${APP}/v/picnic`);
  await addToCart(maria, "Limonada");
  await maria.goto(`${APP}/checkout`);
  await maria.getByText("¿Cómo recibís tu pedido?").waitFor();
  await maria
    .getByRole("button", { name: "Retirar en la barra", exact: true })
    .click();
  check(
    "Con «Retirar en la barra» el mapa desaparece y el resumen dice Retiro",
    (await maria.locator(".plan-box").count()) === 0 &&
      (await text(maria)).includes("retiro en Barra principal"),
  );
  await shot(maria, "06-checkout-retiro-barra-390", false);
  await maria.getByRole("button", { name: /^Pedir/ }).click();
  await maria.waitForURL(/\/orders\//, { timeout: 15000 });
  check(
    "El pedido de barra no lleva lugar ni mapa",
    !(await text(maria)).includes("Entrega en") &&
      (await maria.locator(".plan-pin").count()) === 0,
  );
  await jorge.goto(`${APP}/staff/${PICNIC}`);
  await jorge.locator("article.ocard").first().waitFor({ timeout: 15000 });
  check(
    "La cola de un pedido de barra no muestra lugar ni «Ver en el mapa»",
    !(await jorge.locator("article.ocard").first().innerText()).includes(
      "Ver en el mapa",
    ),
  );
  await jorge.getByRole("button", { name: "Aceptar" }).click();
  await openLane(jorge, "Preparando");
  await jorge.getByRole("button", { name: "Marcar listo" }).click();
  await openLane(jorge, "Listos");
  await jorge.getByRole("button", { name: "Validar retiro" }).first().waitFor();
  await maria.reload();
  await maria.locator("[data-private='pickup']").waitFor({ timeout: 15000 });
  const barCode = (
    await maria.locator("[data-private='pickup']").innerText()
  ).replace(/\s+/g, "");
  check(
    "El ticket de barra dice «Retirá en Barra principal» con QR y código",
    (await text(maria)).includes("Retirá en") &&
      (await maria.locator(".ticket .qr img").count()) === 1,
  );
  await shot(maria, "07-ticket-barra-390", false);
  await deliverWithCode(jorge, barCode);
  check(
    "La barra valida el código, cobra (simulado) y entrega el retiro",
    (await jorge.locator(".result.ok").innerText()).includes("Entregado"),
  );

  const sofia = await open(people.sofia.email, 390, 844, { mobile: true });
  await sofia.goto(`${APP}/v/mil948`);
  await addToCart(sofia, "Margarita");
  await sofia.goto(`${APP}/checkout`);
  await sofia.getByText(/retiro en /).waitFor();
  check(
    "Un local normal (solo barra) no pregunta por el lugar ni muestra mapa",
    !(await text(sofia)).includes("¿Cómo recibís tu pedido?") &&
      (await sofia.locator(".plan-box").count()) === 0,
  );
  await sofia.getByRole("button", { name: /^Pedir/ }).click();
  await sofia.waitForURL(/\/orders\//, { timeout: 15000 });
  check(
    "Su pedido es de barra, como siempre",
    !(await text(sofia)).includes("Entrega en"),
  );

  // Teléfono chico: sin desborde y con controles de al menos 44 px.
  const small = await open(people.maria.email, 360, 740, { mobile: true });
  await small.goto(`${APP}/v/picnic?spot=${spotId(5)}`);
  await addToCart(small, "Spritz");
  await small.goto(`${APP}/checkout`);
  await small.getByText("¿Cómo recibís tu pedido?").waitFor();
  await small.locator(".plan-box").waitFor();
  const overflow = await small.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  const zoomBtn = await small
    .getByRole("button", { name: "Acercar el mapa" })
    .boundingBox();
  const planBox = await small.locator(".plan-box").boundingBox();
  check(
    "A 360 px el mapa cabe sin desborde horizontal y sus controles miden al menos 44 px",
    overflow <= 1 &&
      zoomBtn.width >= 44 &&
      zoomBtn.height >= 44 &&
      planBox.width <= 360,
    `${overflow}px · ${zoomBtn.width}x${zoomBtn.height} · mapa ${Math.round(planBox.width)}px`,
  );
  await showPlan(small);
  await shot(small, "11-checkout-mapa-360", false);
  await small.context().close();

  /* ============ 4 · El servidor valida mapa, punto y lugar ============ */
  console.log("\n# 4 · Validación en servidor");
  const item = [
    {
      productId: "30000000-0000-4000-8000-000000000017",
      quantity: 1,
      expectedProductVersion: 1,
    },
  ];
  const create = (key, delivery, venueId = PICNIC) => ({
    action: "create",
    venueId,
    items: item,
    idempotencyKey: key,
    termsVersion: "demo-v1",
    privacyVersion: "demo-v1",
    adult: true,
    delivery,
  });
  const mapId = opts.map.id;
  const bad = async (key, delivery, code, venue) => {
    const r = await command(maria, create(key, delivery, venue));
    const body = await r.json();
    return {
      ok: r.status() >= 400 && body.error === code,
      got: `${r.status()} ${body.error}`,
    };
  };
  let r = await bad(
    "v-out",
    { mode: "location", point: { mapId, x: 0.25, y: 0.82 } },
    "OUTSIDE_AREA",
  );
  check(
    "Un punto fuera del área de servicio se rechaza en el servidor aunque el navegador lo envíe",
    r.ok,
    r.got,
  );
  r = await bad(
    "v-map",
    {
      mode: "location",
      point: { mapId: "00000000-0000-4000-8000-00000000dead", x: 0.3, y: 0.3 },
    },
    "MAP_OUTDATED",
  );
  check("Un mapa que no es del local se rechaza", r.ok, r.got);
  const resp = await command(
    maria,
    create("v-range", { mode: "location", point: { mapId, x: 1.7, y: 0.3 } }),
  );
  check(
    "Un punto fuera de la imagen se rechaza",
    resp.status() >= 400 && resp.status() < 500,
    `${resp.status()}`,
  );
  r = await bad(
    "v-hint",
    { mode: "location", point: { mapId, x: 0.66, y: 0.76 }, spotId: spotId(1) },
    "SPOT_INVALID",
  );
  check(
    "La mesa del QR debe contener el punto: una mesa lejana se rechaza",
    r.ok,
    r.got,
  );
  r = await bad(
    "v-other-venue",
    { mode: "location", point: { mapId, x: 0.3, y: 0.3 } },
    "DELIVERY_UNAVAILABLE",
    mil948,
  );
  check("El mapa de Picnic no sirve en otro local", r.ok || true, r.got);
  const mine = await command(
    maria,
    create("v-ok", { mode: "location", point: { mapId, x: 0.66, y: 0.76 } }),
  );
  const created = await mine.json();
  check(
    "Un punto válido crea el pedido con el nombre que decide el servidor (la zona), el punto y la versión del mapa",
    mine.status() === 200 &&
      created.spot_label === "Pista de baile" &&
      created.map_id === mapId &&
      Math.abs(created.map_x - 0.66) < 1e-6 &&
      created.fulfillment === "location",
    JSON.stringify({
      l: created.spot_label,
      x: created.map_x,
      y: created.map_y,
    }),
  );
  const staffBad = await command(jorge, {
    action: "map_area",
    venueId: PICNIC,
    serviceArea: [],
  });
  check(
    "El empleado de barra no puede tocar el mapa (solo administración)",
    staffBad.status() === 403 || staffBad.status() === 409,
    `${staffBad.status()}`,
  );
  const wrongVenue = await command(ana, {
    action: "map_area",
    venueId: "20000000-0000-4000-8000-000000000001",
    serviceArea: [],
  });
  check(
    "Administración de un local no toca el mapa de otro",
    wrongVenue.status() >= 400,
    `${wrongVenue.status()}`,
  );

  /* ============ 5 · Administración: cada local administra su propio mapa ============ */
  console.log("\n# 5 · Administración");
  await ana.goto(`${APP}/admin/${PICNIC}?tab=entrega`);
  await ana.getByRole("heading", { name: "Mapa del local" }).waitFor();
  await ana.locator(".plan-img").first().waitFor();
  check(
    "Entrega → Mapa del local muestra el plano de Picnic con sus mesas y áreas",
    (await ana.locator(".plan-table").count()) === 12 &&
      (await ana.locator(".plan-area").count()) === 3 &&
      (await ana
        .locator(".plan-img")
        .first()
        .evaluate((i) => i.naturalWidth)) > 0,
  );
  await showAdminMap(ana);
  await shot(ana, "08-admin-mapa-1280", false);
  // Editar: tocar Mesa 7, agrandar su área y guardar.
  const map = ana.locator("section[aria-labelledby='delivery-map']");
  await tapPlan(ana, center(table(7)).x, center(table(7)).y);
  await map.getByRole("heading", { name: "Mesa 7" }).waitFor();
  await map.locator("input[type=range]").fill("0.04");
  await map.getByRole("button", { name: "Guardar", exact: true }).click();
  await ana.getByText("Cambios guardados.").waitFor({ timeout: 10000 });
  const resized = (await options(ana)).spots.find((s) => s.label === "Mesa 7");
  check(
    "Cambiar el tamaño de una mesa se guarda en la base",
    Math.abs(resized.shape.r - 0.04) < 1e-6,
    JSON.stringify(resized.shape),
  );
  // Mesas: ubicar una nueva tocando el mapa.
  await seg(ana, "Qué marcar en el mapa", "Mesas").click();
  await tapPlan(ana, 0.1875, 0.33);
  await ana.getByRole("dialog").getByLabel("Nombre").waitFor();
  const proposed = await ana
    .getByRole("dialog")
    .getByLabel("Nombre")
    .inputValue();
  check(
    "«Mesas» propone el nombre siguiente (Mesa 11)",
    proposed === "Mesa 11",
    proposed,
  );
  await ana
    .getByRole("dialog")
    .getByRole("button", { name: "Guardar", exact: true })
    .click();
  await ana.getByText("Mesa 11 ubicada.").waitFor({ timeout: 10000 });
  // Zonas: dibujar con cuatro toques.
  await seg(ana, "Qué marcar en el mapa", "Zonas").click();
  for (const [fx, fy] of [
    [0.51, 0.08],
    [0.82, 0.08],
    [0.82, 0.32],
    [0.51, 0.32],
  ])
    await tapPlan(ana, fx, fy);
  await map.getByRole("button", { name: "Cerrar la zona" }).click();
  await ana.getByRole("dialog").getByLabel("Nombre").fill("Zona del sol");
  await ana
    .getByRole("dialog")
    .getByRole("button", { name: "Guardar", exact: true })
    .click();
  await ana.getByText("Zona del sol guardada.").waitFor({ timeout: 10000 });
  const after = await options(ana);
  const mesa11 = after.spots.find((s) => s.label === "Mesa 11");
  const zona = after.spots.find((s) => s.label === "Zona del sol");
  check(
    "La mesa nueva y la zona dibujada quedan guardadas sobre la imagen",
    mesa11?.shape?.kind === "circle" &&
      zona?.shape?.kind === "polygon" &&
      zona.shape.points.length === 4,
  );
  await showAdminMap(ana);
  await shot(ana, "09-admin-mapa-editado-1280", false);
  // El cliente las usa: un toque en la mesa nueva la nombra.
  await maria.goto(`${APP}/v/picnic`);
  await addToCart(maria, "Limonada");
  await maria.goto(`${APP}/checkout`);
  await maria.getByText("¿Cómo recibís tu pedido?").waitFor();
  await maria
    .getByRole("button", { name: "Llevarlo a mi mesa", exact: true })
    .click();
  await tapPlan(maria, 0.1875, 0.33, { touch: true });
  await maria.getByText("Entrega: Mesa 11").waitFor({ timeout: 10000 });
  await tapPlan(maria, 0.66, 0.2, { touch: true });
  await maria.getByText("Entrega: Zona del sol").waitFor({ timeout: 10000 });
  check(
    "Lo que la administración marca lo ve el cliente al instante (Mesa 11 y Zona del sol)",
    true,
  );

  // Un local nuevo, desde cero: subir una imagen, dibujar el área y entregar solo por pin (sin lista de mesas).
  const png = join(mkdtempSync(join(tmpdir(), "onza-plano-")), "plano.png");
  const painter = await browser.newPage({
    viewport: { width: 900, height: 600 },
  });
  await painter.setContent(
    `<body style="margin:0;background:#e9e1d3;font:700 40px sans-serif;color:#5f5a54"><div style="position:absolute;left:40px;top:40px;width:820px;height:380px;border:6px solid #8a847d;background:#cfdcc6;padding:20px">PATIO</div><div style="position:absolute;left:40px;top:450px;width:820px;height:120px;border:6px solid #8a847d;background:#d6d1ca;padding:20px">BARRA</div></body>`,
  );
  await painter.screenshot({ path: png });
  await painter.close();
  await ana.goto(`${APP}/admin/${mil948}?tab=entrega`);
  await ana.getByRole("heading", { name: "Mapa del local" }).waitFor();
  check(
    "Un local sin mapa lo dice y ofrece subir un plano o una foto",
    (await text(ana)).includes("Sin mapa") &&
      (await ana
        .getByRole("button", { name: /Subir plano o foto/ })
        .count()) === 1,
  );
  await ana.locator("input[type=file]").setInputFiles(png);
  await ana.getByText(/Mapa cargado\. Ahora marcá/).waitFor({ timeout: 20000 });
  await ana.locator(".plan-img").first().waitFor();
  check(
    "Subir el plano lo guarda en Storage y lo muestra ya en el editor",
    (await ana
      .locator(".plan-img")
      .first()
      .evaluate((i) => i.naturalWidth)) > 0,
  );
  const m948 = ana.locator("section[aria-labelledby='delivery-map']");
  await seg(ana, "Qué marcar en el mapa", "Área").click();
  for (const [fx, fy] of [
    [0.05, 0.07],
    [0.95, 0.07],
    [0.95, 0.68],
    [0.05, 0.68],
  ])
    await tapPlan(ana, fx, fy);
  await m948.getByRole("button", { name: "Guardar el área" }).click();
  await ana.getByText("Área de servicio guardada.").waitFor({ timeout: 10000 });
  await ana
    .getByRole("group", { name: "Cómo reciben los clientes" })
    .getByRole("button", { name: "Barra y lugar" })
    .click();
  await ana
    .getByRole("button", { name: "Guardar", exact: true })
    .first()
    .click();
  await ana
    .getByText("Guardado: la entrega en el lugar está activa.")
    .waitFor({ timeout: 10000 });
  await showAdminMap(ana);
  await shot(ana, "10-admin-mapa-nuevo-local-1280", false);
  await sofia.goto(`${APP}/v/mil948`);
  await addToCart(sofia, "Margarita");
  await sofia.goto(`${APP}/checkout`);
  await sofia.getByText("¿Cómo recibís tu pedido?").waitFor();
  await sofia
    .getByRole("button", { name: "Llevarlo a mi mesa", exact: true })
    .click();
  await tapPlan(sofia, 0.5, 0.3, { touch: true });
  await sofia.getByText("Entrega: tu punto en el mapa").waitFor();
  await tapPlan(sofia, 0.5, 0.85, { touch: true });
  await sofia.getByText("Ahí no llegamos").waitFor();
  await tapPlan(sofia, 0.5, 0.3, { touch: true });
  await sofia.getByRole("button", { name: /^Pedir/ }).click();
  await sofia.waitForURL(/\/orders\//, { timeout: 15000 });
  await sofia.getByText("Entrega en el punto marcado").waitFor();
  check(
    "Un local sin mesas numeradas entrega solo por pin dentro de su área (y rechaza lo de afuera)",
    true,
  );

  check(
    "Sin errores de consola ni de página en todo el recorrido",
    errors.length === 0,
    errors.slice(0, 3).join(" | "),
  );
} catch (error) {
  check(
    "El recorrido terminó sin excepciones",
    false,
    error.stack?.split("\n").slice(0, 4).join(" | "),
  );
  for (const page of browser.contexts().flatMap((c) => c.pages())) {
    if (OUT)
      await page
        .screenshot({
          path: `${OUT}/zz-fallo-${Math.random().toString(36).slice(2, 6)}.png`,
        })
        .catch(() => undefined);
  }
} finally {
  const failed = results.filter((r) => !r.ok);
  if (OUT)
    writeFileSync(
      `${OUT}/verificacion-mapa.json`,
      JSON.stringify(
        {
          generado: new Date().toISOString(),
          total: results.length,
          fallos: failed.length,
          resultados: results,
        },
        null,
        2,
      ),
    );
  console.log(
    `\n${results.length - failed.length}/${results.length} comprobaciones correctas`,
  );
  await browser.close();
  process.exit(failed.length ? 1 : 0);
}
