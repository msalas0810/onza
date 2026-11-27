// Recorrido real de la app (código de producción, migraciones reales) contra el servidor de verificación local sobre PGlite.
// NO es Supabase: no prueba Realtime, Storage, correo, Google ni límites de tasa. Sirve para comprobar el flujo de pedidos, los
// permisos y los estados de la interfaz sin acceso a un proyecto remoto.
// Uso: node scripts/verify-local-flow.mjs [--shots]   (levanta el servidor local; reutiliza la app si ONZA_APP responde)
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  startShim,
  people,
  SERVICE_KEY,
  PUBLISHABLE_KEY,
} from "./local-shim/index.mjs";
import { sessionCookies } from "./local-shim/session.mjs";
import { stableId } from "./lib/real-venues-seed.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const SHOTS = process.argv.includes("--shots");
const APP = process.env.ONZA_APP ?? "http://127.0.0.1:3000";
const PORT = Number(process.env.SHIM_PORT ?? 54321);
const results = [];
const errors = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
};
const venue = (slug) => stableId("onza-real-venue", slug);
const shotsDir = new URL("../docs/evidence/v1/", import.meta.url).pathname;
if (SHOTS) mkdirSync(shotsDir, { recursive: true });

const shim = await startShim({ port: PORT });
let server = null;
const up = async () =>
  fetch(`${APP}/acceso`).then(
    (r) => r.ok,
    () => false,
  );
if (!(await up())) {
  const env = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: shim.url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    APP_ORIGIN: APP,
    DEMO_MODE: "true",
    PAYMENT_PROVIDER: "mock",
    REAL_PAYMENTS_ENABLED: "false",
    PICKUP_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    PICKUP_TOKEN_KEY_VERSION: "1",
    ACCOUNTS_REQUIRED: "true",
  };
  server = spawn(
    "npx",
    ["next", "dev", "--hostname", "127.0.0.1", "-p", new URL(APP).port],
    { env, stdio: "ignore" },
  );
  for (let i = 0; i < 60 && !(await up()); i++)
    await new Promise((r) => setTimeout(r, 2000));
}
const browser = await chromium.launch().catch(() =>
  chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium",
  }),
);
const watch = (page, label) => {
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      !/websocket|realtime|Failed to load resource|ERR_INTERNET|net::/i.test(
        m.text(),
      )
    )
      errors.push(`${label}: ${m.text().slice(0, 200)}`);
  });
};
async function open(email, width = 390, height = 844, scheme = "light") {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: scheme,
  });
  if (email) await context.addCookies(await sessionCookies(shim.url, email));
  const page = await context.newPage();
  watch(page, email ?? "anon");
  return { context, page };
}
const text = (page) => page.locator("body").innerText();
const loaded = (page) =>
  page.waitForFunction(
    () =>
      !/Consultando/.test(document.body.innerText) &&
      !document.querySelector('[aria-label="Cargando"]'),
    null,
    { timeout: 15000 },
  );
const norm = (value) => value.replace(/\s+/g, " ");
const settle = (page, ms = 400) => page.waitForTimeout(ms);
const refetch = async (page) => {
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await settle(page, 700);
};
const shot = async (page, name) => {
  if (!SHOTS) return;
  await page.addStyleTag({ content: ".banner{display:none!important}" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${shotsDir}${name}.png` });
};
const post = (page, input) =>
  page.evaluate(async (body) => {
    const r = await fetch("/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, input);

try {
  /* 1. Entrada y separación de áreas */
  const anon = await open(null);
  await anon.page.goto(`${APP}/`);
  check(
    "Sin sesión, la entrada pide acceso",
    /\/acceso/.test(anon.page.url()),
    anon.page.url(),
  );
  await anon.page.goto(`${APP}/equipo/acceso`);
  check(
    "El acceso del equipo ofrece correo y contraseña, sin registro ni Google",
    (await text(anon.page)).includes("Acceso del equipo") &&
      !(await text(anon.page)).includes("Google"),
  );
  await anon.context.close();

  const maria = await open(people.maria.email);
  const mp = maria.page;
  await mp.goto(`${APP}/`);
  const explore = await text(mp);
  check(
    "Explorar lista los locales reales abiertos y no los ficticios",
    ["Mil948", "Stiefel Pub", "Wilk Craft Beer", "Apotecario"].every((n) =>
      explore.includes(n),
    ) && !explore.includes("Sala Norte"),
  );
  check(
    "Otro Bar queda en Cerrados con estado evidente",
    /cerrados[\s\S]*otro bar[\s\S]*cerrado/i.test(explore),
  );
  check(
    "Sin ubicación se ofrece sin inventar distancias",
    explore.includes("Usar mi ubicación") && !/Aprox\./.test(explore),
  );
  await shot(mp, "explorar-390");
  await mp.goto(`${APP}/staff/${venue("mil948")}`);
  check(
    "Una cuenta personal no entra a la barra y se le explica",
    /sesion-activa/.test(mp.url()),
  );

  const jorge = await open(people.jorge.email, 1440, 900);
  const jp = jorge.page;
  await jp.goto(`${APP}/`);
  check(
    "Una cuenta del equipo no entra al área de clientes",
    /sesion-activa/.test(jp.url()),
  );
  await jp.goto(`${APP}/equipo/acceso`);
  await jp.waitForURL(/\/staff\//);
  check(
    "Con un solo local, el equipo entra directo a la barra",
    jp.url().endsWith(venue("mil948")),
  );

  /* 2. El cliente pide */
  await mp.goto(`${APP}/v/mil948`);
  const add = (name) =>
    mp
      .locator("article.prow", { hasText: name })
      .getByRole("button", { name: "Agregar", exact: true });
  await add("Margarita").click();
  await mp
    .locator("article.prow", { hasText: "Margarita" })
    .getByRole("button", { name: "Agregar una unidad" })
    .click();
  await add("Negroni").click();
  check(
    "Agregar abre el stepper y el dock resume la ronda",
    (await mp.locator(".dock").innerText()).includes("3 productos"),
  );
  const key = await mp.evaluate(() =>
    Object.keys(localStorage).find((k) => k.startsWith("onza-cart-draft")),
  );
  check(
    "El carrito vive en la clave de la cuenta",
    key === `onza-cart-draft:${people.maria.id}`,
    key,
  );
  await mp
    .locator("article.prow", { hasText: "Negroni" })
    .getByRole("button", { name: "Quitar", exact: true })
    .click();
  check(
    "Con cantidad 1, quitar elimina la línea",
    (await mp.locator(".dock").innerText()).includes("2 productos"),
  );
  await add("Negroni").click();
  await shot(mp, "local-dock-390");
  await mp.goto(`${APP}/cart`);
  await mp.locator("text=Margarita").first().waitFor();
  check(
    "El carrito muestra la ronda y el total",
    (await text(mp)).includes("Margarita") &&
      norm(await text(mp)).includes("₡18 900"),
  );
  await shot(mp, "carrito-390");
  await mp.getByRole("link", { name: "Continuar", exact: true }).click();
  await mp.waitForURL(/\/checkout/);
  await shot(mp, "checkout-390");
  await mp.getByRole("button", { name: /^Pedir/ }).click();
  await mp.waitForSelector("text=Pedido enviado");
  check(
    "Confirmación con el vasito tras pedir",
    await mp.locator(".vaso").isVisible(),
  );
  await mp.waitForURL(/\/orders\//, { timeout: 8000 });
  const orderUrl = mp.url();
  const orderId = orderUrl.split("/orders/")[1];
  const code = (await mp.locator("h1").first().innerText())
    .replace("#", "")
    .trim();
  check(
    "El pedido nace Recibido y se puede cancelar",
    (await text(mp)).includes("Recibido") &&
      (await mp
        .getByRole("button", { name: "Cancelar pedido", exact: true })
        .count()) === 1,
  );
  const stored = await mp.evaluate(
    () =>
      Object.keys(localStorage).some((k) => k.startsWith("onza-cart-draft:")) &&
      localStorage.getItem(
        Object.keys(localStorage).find((k) => k.startsWith("onza-cart-draft:")),
      ),
  );
  check("El carrito se vacía al pedir", !stored);
  await shot(mp, "pedido-recibido-390");

  /* 3. La barra recibe, acepta y marca listo */
  await jp.goto(`${APP}/staff/${venue("mil948")}`);
  const card = jp.locator("article.ocard", { hasText: `#${code}` });
  await card.waitFor();
  check(
    "La barra recibe el pedido con número, productos y tiempo",
    norm(await card.innerText()).includes("2× Margarita") &&
      /Espera \d+ min/.test(await card.innerText()),
  );
  await shot(jp, "barra-nuevo-1440");
  await card.getByRole("button", { name: "Aceptar", exact: true }).click();
  await jp
    .locator("article.ocard", { hasText: `#${code}` })
    .getByRole("button", { name: "Marcar listo" })
    .waitFor();
  check("Aceptar pasa el pedido a Preparando", true);
  await refetch(mp);
  await mp.goto(orderUrl);
  await mp.waitForSelector("text=Preparando");
  check(
    "El cliente ve Preparando y ya no puede cancelar",
    (await text(mp)).includes("Preparando") &&
      (await mp
        .getByRole("button", { name: "Cancelar pedido", exact: true })
        .count()) === 0,
  );
  await jp
    .locator("article.ocard", { hasText: `#${code}` })
    .getByRole("button", { name: "Marcar listo" })
    .click();
  await jp
    .locator("article.ocard", { hasText: `#${code}` })
    .getByRole("button", { name: "Validar retiro" })
    .waitFor();
  await mp.goto(orderUrl);
  await mp.waitForSelector(".ticket");
  const ticketText = await mp.locator(".ticket").innerText();
  const privateCode = (await mp.locator(".ticket .code").innerText()).replace(
    /\s/g,
    "",
  );
  check(
    "El cliente ve Listo con QR y código privado de 12 caracteres",
    /Listo para retirar/.test(await text(mp)) &&
      privateCode.length === 12 &&
      (await mp.locator(".ticket .qr img").count()) === 1,
    privateCode.length + " caracteres",
  );
  check(
    "El número público no es el código privado",
    !privateCode.includes(code) && ticketText.includes("El número no sirve"),
  );
  await shot(mp, "ticket-390");

  /* 4. Retiro */
  await jp.getByRole("button", { name: "Validar retiro" }).first().click();
  await jp
    .getByLabel("Código de retiro (12 caracteres)")
    .fill(code.padEnd(12, "0"));
  await jp
    .locator("[role=dialog]")
    .getByRole("button", { name: "Validar", exact: true })
    .click();
  await jp.waitForSelector(".result.bad");
  check("Un código que no es el privado se rechaza", true);
  await jp.getByLabel("Código de retiro (12 caracteres)").fill(privateCode);
  await shot(jp, "validar-retiro-1440");
  await jp
    .locator("[role=dialog]")
    .getByRole("button", { name: "Validar", exact: true })
    .click();
  await jp.getByRole("button", { name: "Confirmar cobro simulado" }).click();
  await jp.getByLabel("Entregué físicamente el pedido completo.").check();
  await jp.getByRole("button", { name: "Confirmar entrega" }).click();
  await jp.waitForSelector(".result.ok");
  check(
    "Cobro simulado y entrega confirmados",
    (await jp.locator(".result.ok").innerText()).includes(`Entregado #${code}`),
  );
  await jp.getByRole("button", { name: "Validar otro retiro" }).click();
  await jp.getByLabel("Código de retiro (12 caracteres)").fill(privateCode);
  await jp
    .locator("[role=dialog]")
    .getByRole("button", { name: "Validar", exact: true })
    .click();
  await jp.waitForSelector(".result.bad");
  check(
    "El código consumido no sirve otra vez",
    /ya fue utilizado|ya se usó|no es válido/i.test(
      await jp.locator(".result.bad").innerText(),
    ),
    (await jp.locator(".result.bad").innerText()).slice(0, 80),
  );
  await jp.keyboard.press("Escape");
  await mp.goto(orderUrl);
  await loaded(mp);
  check("El cliente ve Entregado", (await text(mp)).includes("Entregado"));

  /* 5. Cancelación y carrera aceptar/cancelar */
  const order = async (page, product) => {
    await page.goto(`${APP}/v/mil948`);
    await page
      .locator("article.prow", { hasText: product })
      .getByRole("button", { name: "Agregar", exact: true })
      .click();
    await page.goto(`${APP}/checkout`);
    await page.getByRole("button", { name: /^Pedir/ }).click();
    await page.waitForURL(/\/orders\//, { timeout: 12000 });
    return page.url();
  };
  await order(mp, "Old fashioned");
  await mp
    .getByRole("button", { name: "Cancelar pedido", exact: true })
    .click();
  await mp.getByRole("button", { name: "Sí, cancelar pedido" }).click();
  await mp.waitForSelector("text=Pedido cancelado");
  check("El cliente cancela antes de que el local acepte", true);
  const third = await order(mp, "Paloma");
  const thirdId = third.split("/orders/")[1];
  await jp.goto(`${APP}/staff/${venue("mil948")}`);
  const thirdCode = (await mp.locator("h1").first().innerText())
    .replace("#", "")
    .trim();
  await jp
    .locator("article.ocard", { hasText: `#${thirdCode}` })
    .getByRole("button", { name: "Aceptar", exact: true })
    .click();
  await jp
    .locator("article.ocard", { hasText: `#${thirdCode}` })
    .getByRole("button", { name: "Marcar listo" })
    .waitFor();
  await mp
    .getByRole("button", { name: "Cancelar pedido", exact: true })
    .click();
  await mp.getByRole("button", { name: "Sí, cancelar pedido" }).click();
  await mp.waitForSelector("text=ya aceptó tu pedido");
  check(
    "Cancelar después de que el local aceptó se rechaza con un mensaje claro",
    true,
  );

  /* 6. Rechazo con motivo */
  await mp.goto(`${APP}/v/mil948`);
  await mp
    .locator("article.prow", { hasText: "Margarita" })
    .getByRole("button", { name: "Agregar", exact: true })
    .click();
  await mp.goto(`${APP}/checkout`);
  await mp.getByRole("button", { name: /^Pedir/ }).click();
  await mp.waitForURL(/\/orders\//, { timeout: 12000 });
  const rejCode = (await mp.locator("h1").first().innerText())
    .replace("#", "")
    .trim();
  const rejUrl = mp.url();
  await jp.goto(`${APP}/staff/${venue("mil948")}`);
  await jp
    .locator("article.ocard", { hasText: `#${rejCode}` })
    .getByRole("button", { name: "Rechazar", exact: true })
    .click();
  await jp.locator("[role=dialog]").getByLabel("Otro motivo").check();
  await jp
    .locator("[role=dialog]")
    .getByRole("button", { name: "Rechazar pedido" })
    .click();
  check(
    "El rechazo exige un motivo",
    (await text(jp)).includes("al menos 3 caracteres"),
  );
  await jp.locator("[role=dialog] textarea").fill("Sin hielo");
  await jp
    .locator("[role=dialog]")
    .getByRole("button", { name: "Rechazar pedido" })
    .click();
  await jp.waitForSelector(`article.ocard:has-text("#${rejCode}")`, {
    state: "detached",
  });
  await mp.goto(rejUrl);
  await loaded(mp);
  check(
    "El cliente ve el pedido rechazado",
    (await text(mp)).includes("Pedido cancelado"),
  );

  /* 7. Permisos y aislamiento */
  const sofia = await open(people.sofia.email);
  await sofia.page.goto(orderUrl);
  await loaded(sofia.page);
  check(
    "Otra cuenta no ve el pedido de María",
    /No encontramos este pedido/.test(await text(sofia.page)),
  );
  await sofia.page.goto(`${APP}/orders`);
  check(
    "Otra cuenta no tiene pedidos ajenos en su lista",
    await sofia.page
      .locator("text=Todavía no pediste")
      .waitFor({ timeout: 8000 })
      .then(
        () => true,
        () => false,
      ),
  );
  const denied = await post(mp, {
    action: "accept",
    orderId: thirdId,
    expectedVersion: 1,
    idempotencyKey: crypto.randomUUID(),
  });
  check(
    "Un cliente no puede operar la barra por la API",
    denied.status === 403 || denied.status === 409,
    `HTTP ${denied.status} ${denied.body?.error ?? ""}`,
  );
  await jp.goto(`${APP}/staff/${venue("stiefel-pub")}`);
  await loaded(jp);
  check(
    "Un empleado de un local no entra a otro",
    /Ya no tenés acceso/.test(await text(jp)),
  );
  await jp.goto(`${APP}/admin/${venue("mil948")}`);
  await loaded(jp);
  check(
    "Un empleado no administra el local",
    /Ya no tenés acceso/.test(await text(jp)),
  );
  await jp.goto(`${APP}/staff/${venue("mil948")}`);
  await jp
    .getByRole("button", { name: "Sonido de pedidos nuevos: desactivado" })
    .click();
  check("El sonido de la barra es opcional y se activa con un gesto", true);

  /* 8. Administración y equipo */
  const ana = await open(people.ana.email, 1440, 900);
  const ap = ana.page;
  await ap.goto(`${APP}/equipo/acceso`);
  await ap.waitForURL(/equipo\/locales/);
  await ap.locator("text=Tus locales").waitFor();
  check(
    "Con dos locales, el equipo elige entre ellos por nombre",
    (await text(ap)).includes("Mil948") &&
      (await text(ap)).includes("Stiefel Pub"),
  );
  await shot(ap, "locales-1440");
  await ap.goto(`${APP}/admin/${venue("mil948")}?tab=equipo`);
  await ap.getByRole("button", { name: "Agregar persona" }).click();
  const dialog = ap.locator("[role=dialog]");
  await dialog.getByLabel("Nombre").fill("Pablo Mora");
  await dialog.getByLabel("Correo del trabajo").fill(people.maria.email);
  await dialog.getByRole("button", { name: "Crear cuenta" }).click();
  await dialog.locator("text=cuenta personal").waitFor();
  check("El correo de un cliente no se convierte en cuenta laboral", true);
  await dialog.getByLabel("Correo del trabajo").fill("pablo@equipo.demo");
  await dialog.getByRole("button", { name: "Crear cuenta" }).click();
  await dialog.locator("[data-private=temporary-password]").waitFor();
  const temp = await dialog
    .locator("[data-private=temporary-password]")
    .innerText();
  check(
    "La contraseña temporal se muestra una sola vez",
    /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(temp),
    temp.replace(/./g, "•"),
  );
  await ap.addStyleTag({ content: ".secret{filter:blur(8px)}" });
  await shot(ap, "equipo-alta-1440");
  await dialog.getByRole("button", { name: "Listo" }).click();
  check(
    "La persona nueva queda con clave temporal pendiente",
    (await text(ap)).includes("Pablo Mora") &&
      (await text(ap)).includes("Clave temporal"),
  );
  // Pablo entra por el formulario del equipo: debe cambiar la clave antes de operar, en navegación y en la API.
  const pablo = await open(null, 390, 844);
  const pg = pablo.page;
  await pg.goto(`${APP}/equipo/acceso`);
  await pg.getByLabel("Correo del trabajo").fill("pablo@equipo.demo");
  await pg.getByLabel("Contraseña", { exact: true }).fill(temp);
  await pg.getByRole("button", { name: "Ingresar" }).click();
  await pg.waitForURL(/equipo\/clave/);
  check(
    "Con clave temporal, el equipo debe crear la suya antes de operar",
    true,
  );
  const pablosId = (
    await shim.db.query(
      "select id from auth.users where email='pablo@equipo.demo'",
    )
  ).rows[0].id;
  const blocked = await post(pg, {
    action: "venue_update",
    venueId: venue("mil948"),
    paused: true,
  });
  check(
    "La API rechaza operar con la clave temporal pendiente",
    blocked.status === 403 &&
      blocked.body?.error === "PASSWORD_CHANGE_REQUIRED",
    `HTTP ${blocked.status} ${blocked.body?.error}`,
  );
  await pg.goto(`${APP}/staff/${venue("mil948")}`);
  check("La navegación también lo bloquea", /equipo\/clave/.test(pg.url()));
  await pg.getByLabel("Contraseña nueva").fill(temp);
  await pg.getByLabel("Repetir contraseña").fill(temp);
  await pg.getByRole("button", { name: "Guardar y continuar" }).click();
  await pg.waitForSelector("text=distinta");
  check("No se acepta repetir la contraseña temporal", true);
  await pg.getByLabel("Contraseña nueva").fill("una-clave-propia-1");
  await pg.getByLabel("Repetir contraseña").fill("una-clave-propia-1");
  await pg.getByRole("button", { name: "Guardar y continuar" }).click();
  await pg.waitForURL(/\/staff\//);
  check("Tras cambiarla, entra a su barra", pg.url().endsWith(venue("mil948")));
  // Pablo también trabaja en Stiefel Pub; se le quita el acceso solo a Mil948.
  await shim.db.query(
    "insert into public.memberships(user_id,venue_id,role) values($1,$2,'bartender')",
    [pablosId, venue("stiefel-pub")],
  );
  await ap.goto(`${APP}/admin/${venue("mil948")}?tab=equipo`);
  await ap
    .locator(".r", { hasText: "Pablo Mora" })
    .getByRole("button", { name: "Quitar acceso" })
    .click();
  await ap
    .locator("[role=dialog]")
    .getByRole("button", { name: "Quitar acceso" })
    .click();
  await ap.waitForSelector("text=ya no tiene acceso a Mil948");
  check(
    "Quitar acceso lo confirma sin tocar a otras personas",
    (await text(ap)).includes("Ana Rojas"),
  );
  await pg.goto(`${APP}/staff/${venue("mil948")}`);
  await loaded(pg);
  check(
    "Quien perdió el acceso ya no entra a ese local",
    /Ya no tenés acceso/.test(await text(pg)),
  );
  const after = await post(pg, {
    action: "venue_update",
    venueId: venue("mil948"),
    paused: true,
  });
  check(
    "Sus acciones posteriores en ese local se rechazan en el servidor",
    after.status === 403,
    `HTTP ${after.status} ${after.body?.error ?? ""}`,
  );
  await pg.goto(`${APP}/staff/${venue("stiefel-pub")}`);
  await pg.locator("h1").first().waitFor();
  check(
    "Conserva el acceso a su otro local",
    /Barra/.test(await text(pg)) && !/Ya no tenés acceso/.test(await text(pg)),
    pg.url().split("/").slice(-2).join("/") +
      " " +
      (await text(pg)).slice(0, 80).replace(/\n/g, " "),
  );
  await ap.goto(`${APP}/admin/${venue("mil948")}?tab=disponibilidad`);
  await shot(ap, "admin-disponibilidad-1440");
  await ap.getByRole("button", { name: "Pausado" }).click();
  await ap.waitForSelector("text=Visible, pero nadie puede pedir");
  await mp.goto(`${APP}/v/mil948`);
  await mp.locator("article.prow").first().waitFor();
  const pausedText = await text(mp);
  const firstAdd = mp
    .getByRole("button", { name: "Agregar", exact: true })
    .first();
  check(
    "Pausar el local se refleja para el cliente y bloquea Agregar",
    pausedText.includes("Pedidos pausados") && (await firstAdd.isDisabled()),
    `${pausedText.includes("Pedidos pausados")} ${await firstAdd.count()}`,
  );
  await ap.getByRole("button", { name: "Abierto" }).click();
  await ap.waitForSelector("text=Los clientes ven el menú y pueden pedir");

  /* 9. Stock y precio que cambian con el carrito abierto */
  await mp.goto(`${APP}/v/mil948`);
  await mp
    .locator("article.prow", { hasText: "Margarita" })
    .getByRole("button", { name: "Agregar", exact: true })
    .click();
  await mp.goto(`${APP}/checkout`);
  await shim.db.query(
    "update public.products set available=false where name='Margarita' and venue_id=$1",
    [venue("mil948")],
  );
  await mp.getByRole("button", { name: /^Pedir/ }).click();
  await mp.waitForSelector("text=No se hizo el pedido");
  check(
    "Un producto agotado se rechaza con salida clara",
    (await text(mp)).includes("Revisar carrito"),
  );
  await mp.getByRole("link", { name: "Revisar carrito" }).click();
  await mp.waitForSelector("text=Se agotó");
  check(
    "El carrito marca el agotado y bloquea Continuar",
    (await mp
      .getByRole("link", { name: "Continuar", exact: true })
      .getAttribute("aria-disabled")) === "true",
  );
  await mp
    .locator("article.prow", { hasText: "Margarita" })
    .getByRole("button", { name: "Quitar", exact: true })
    .click();
  check(
    "El agotado se puede quitar: nada queda atrapado",
    (await text(mp)).includes("Tu carrito está vacío"),
  );
  await shim.db.query(
    "update public.products set available=true where name='Margarita'",
  );

  /* 10. Sesión vencida y desconexión */
  await mp.goto(`${APP}/v/mil948`);
  await mp
    .locator("article.prow", { hasText: "Margarita" })
    .getByRole("button", { name: "Agregar", exact: true })
    .click();
  await mp.goto(`${APP}/checkout`);
  await maria.context.setOffline(true);
  await settle(mp, 300);
  check(
    "Sin conexión aparece el aviso y Pedir queda bloqueado",
    (await text(mp)).includes("Sin conexión") &&
      (await mp.getByRole("button", { name: /^Pedir/ }).isDisabled()),
  );
  await maria.context.setOffline(false);
  await settle(mp, 300);
  const stale = await maria.context.cookies();
  await maria.context.clearCookies();
  await mp.getByRole("button", { name: /^Pedir/ }).click();
  await mp.waitForSelector("text=Tu sesión venció");
  check(
    "Con la sesión vencida se ofrece volver a entrar sin cerrar nada solo",
    true,
  );
  await shot(mp, "sesion-vencida-390");
  const cartKept = await mp.evaluate(
    () =>
      Object.keys(localStorage).filter((k) => k.startsWith("onza-cart-draft:"))
        .length,
  );
  check("El carrito se conserva para la misma cuenta", cartKept === 1);
  await mp.getByRole("button", { name: "Volver a entrar" }).click();
  await mp.waitForURL(/\/acceso\?next=%2Fcheckout/);
  check("Volver a entrar conserva el destino", true);
  await maria.context.addCookies(stale);
  await mp.goto(`${APP}/checkout`);
  check(
    "Con la sesión de vuelta, el carrito sigue ahí",
    await mp
      .locator("text=Margarita")
      .first()
      .waitFor({ timeout: 8000 })
      .then(
        () => true,
        () => false,
      ),
  );

  /* 11. Cola densa: muchos pedidos a la vez */
  await mp.goto(`${APP}/orders`);
  const menu = await mp.evaluate(
    async (id) => (await fetch(`/api/catalog?venue=${id}`)).json(),
    venue("mil948"),
  );
  const sellable = menu.filter((p) => p.available);
  const created = [];
  for (let i = 0; i < 14; i++) {
    const product = sellable[i % sellable.length];
    // Cada cuenta puede crear hasta 12 pedidos por minuto: la carga se reparte entre dos clientes.
    const made = await post(i % 2 ? sofia.page : mp, {
      action: "create",
      venueId: venue("mil948"),
      items: [
        {
          productId: product.id,
          quantity: 1 + (i % 3),
          expectedProductVersion: product.version,
        },
      ],
      termsVersion: "demo-v1",
      privacyVersion: "demo-v1",
      adult: true,
      idempotencyKey: crypto.randomUUID(),
    });
    if (made.status === 200) created.push(made.body);
  }
  check(
    "Se crearon 14 pedidos para probar la densidad de la barra",
    created.length === 14,
    `${created.length} creados`,
  );
  // Algunos avanzan para tener las tres columnas con contenido.
  for (const [index, order] of created.entries()) {
    if (index % 3 === 0) {
      const accepted = await post(jp, {
        action: "accept",
        orderId: order.id,
        expectedVersion: order.version,
        idempotencyKey: crypto.randomUUID(),
      });
      if (index % 6 === 0 && accepted.status === 200)
        await post(jp, {
          action: "ready",
          orderId: order.id,
          expectedVersion: accepted.body.version,
          idempotencyKey: crypto.randomUUID(),
        });
    }
  }
  await jp.goto(`${APP}/staff/${venue("mil948")}`);
  await jp.locator("article.ocard").first().waitFor();
  const cards = await jp.locator("article.ocard").count();
  const scrollable = await jp.evaluate(() =>
    [...document.querySelectorAll(".col-scroll")].some(
      (c) => c.scrollHeight > c.clientHeight + 4,
    ),
  );
  check(
    "Con muchos pedidos, las columnas desplazan sin perder la cabecera de la barra",
    cards >= 12 && scrollable,
    `${cards} tarjetas, desplaza: ${scrollable}`,
  );
  const headTop = await jp
    .locator(".board-head")
    .evaluate((el) => el.getBoundingClientRect().top);
  await jp
    .locator(".col-scroll")
    .first()
    .evaluate((el) => (el.scrollTop = el.scrollHeight));
  check(
    "La cabecera con Validar retiro sigue a la vista tras desplazar",
    (await jp
      .locator(".board-head")
      .evaluate((el) => el.getBoundingClientRect().top)) === headTop,
  );
  const heights = await jp
    .locator("article.ocard .btn")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  check(
    "Las acciones de la barra tienen al menos 56 px de alto",
    heights.length > 0 && Math.min(...heights) >= 55.5,
    `mínimo ${Math.min(...heights)} px`,
  );
  await shot(jp, "barra-densa-1440");
  const staffPhone = await open(people.jorge.email, 390, 844);
  await staffPhone.page.goto(`${APP}/staff/${venue("mil948")}`);
  await staffPhone.page.locator("article.ocard").first().waitFor();
  const last = staffPhone.page.locator("article.ocard:visible").last();
  await last.scrollIntoViewIfNeeded();
  const lastButton = last.getByRole("button").last();
  check(
    "En el teléfono, la última tarjeta y su acción se alcanzan desplazando",
    await lastButton.isVisible(),
  );
  const overflow = await staffPhone.page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  check("La barra del teléfono no desborda horizontalmente", !overflow);
  await shot(staffPhone.page, "barra-densa-390");
  await staffPhone.page.getByRole("tab", { name: /Listos/ }).click();
  check(
    "Las pestañas Nuevos/Preparando/Listos cambian la lista en el teléfono",
    (await staffPhone.page.locator("article.ocard:visible").count()) > 0,
  );

  /* 12. Apariencia */
  const night = await open(people.maria.email, 390, 844, "dark");
  await night.page.goto(`${APP}/`);
  await shot(night.page, "explorar-390-oscuro");
  await night.page.goto(`${APP}/orders/${orderId}`);
  await shot(night.page, "pedido-entregado-390-oscuro");
  check("El tema oscuro renderiza sin errores", true);
} catch (error) {
  check(
    "Ejecución sin excepciones",
    false,
    String(error.message).split("\n")[0],
  );
} finally {
  check(
    "Cero errores de ejecución en el navegador",
    errors.length === 0,
    errors.slice(0, 4).join(" | "),
  );
  const summary = {
    date: new Date().toISOString(),
    note: "Servidor local sobre PGlite con migraciones reales; no es Supabase.",
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
    errors,
  };
  if (SHOTS)
    writeFileSync(
      `${shotsDir}flow-verification.json`,
      JSON.stringify(summary, null, 2),
    );
  await browser.close();
  await shim.close();
  server?.kill();
  process.exitCode = summary.failed ? 1 : 0;
}
