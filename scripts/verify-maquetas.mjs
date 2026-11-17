#!/usr/bin/env node
/* Verifica las maquetas V1 (design/maquetas-v1) en Chromium:
   recorridos funcionales entre marcos, desbordes 360/390/1440 en ambos temas, errores de consola
   y un conjunto acotado de capturas. Sin red: sirve la carpeta con un servidor local.
   Uso: node scripts/verify-maquetas.mjs [--no-shots] */
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "design",
  "maquetas-v1",
);
const SHOTS = !process.argv.includes("--no-shots");
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".md": "text/plain; charset=utf-8",
};

const server = createServer(async (req, res) => {
  const path = normalize(
    decodeURIComponent(new URL(req.url, "http://x").pathname),
  ).replace(/^(\.\.[/\\])+/, "");
  try {
    const body = await readFile(join(ROOT, path === "/" ? "index.html" : path));
    res.writeHead(200, {
      "content-type": TYPES[extname(path)] || "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const results = [];
const errors = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
};
// Si el proyecto fija otra versión de Playwright sin su navegador, usar el Chromium del entorno
// (PLAYWRIGHT_CHROMIUM o /opt/pw-browsers/chromium).
const browser = await chromium.launch().catch(() =>
  chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium",
  }),
);
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
});
const watch = (page, label) => {
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${label}: ${m.text()}`);
  });
};
const open = async (url, label, viewport) => {
  const page = await context.newPage();
  if (viewport) await page.setViewportSize(viewport);
  watch(page, label);
  await page.goto(BASE + "/" + url);
  if (url.startsWith("app.html")) await page.waitForSelector("#app > *");
  else await page.waitForLoadState("load");
  return page;
};
const text = (page) => page.locator("#app").innerText();
const settle = (page) => page.waitForTimeout(150);

try {
  /* Estado limpio */
  const boot = await open("app.html", "boot");
  await boot.evaluate(() => localStorage.clear());
  await boot.close();

  /* 1. Guardas de acceso */
  const anon = await open("app.html#/explorar", "anon");
  check(
    "Sin sesión, Explorar redirige al acceso conservando el destino",
    (await anon.evaluate(() => location.hash)).startsWith("#/acceso?next="),
  );
  await anon.goto(BASE + "/app.html#/barra/mil948");
  await settle(anon);
  check(
    "Sin sesión, la barra redirige al acceso del equipo",
    (await anon.evaluate(() => location.hash)).startsWith("#/equipo/acceso"),
  );
  await anon.close();

  /* 2. Registro → confirmar → perfil (18+, usuario tomado) */
  const reg = await open(
    "app.html?marco=reg#/acceso/correo?modo=crear",
    "registro",
  );
  await reg.fill("#email", "nueva@correo.demo");
  await reg.fill("#password", "corta");
  await reg.click("button[type=submit]");
  check(
    "Registro rechaza contraseña corta junto al campo",
    (await text(reg)).includes("al menos 10 caracteres"),
  );
  await reg.fill("#password", "una-clave-larga");
  await reg.click("button[type=submit]");
  await settle(reg);
  check(
    "Registro lleva a confirmar el correo",
    (await text(reg)).includes("Revisá tu correo"),
  );
  await reg.click("[data-act=confirm-link]");
  await settle(reg);
  await reg.fill("#name", "Nueva Persona");
  await reg.fill("#username", "mariasolis");
  await reg.fill("#phone", "88887777");
  await reg.fill("#birth", "2012-01-01");
  await reg.click("button[type=submit]");
  const regText = await text(reg);
  check(
    "Perfil valida 18+ en el formulario",
    regText.includes("mayores de 18"),
  );
  check(
    "Perfil exige aceptar condiciones",
    regText.includes("aceptar las condiciones"),
  );
  await reg.fill("#birth", "1995-05-05");
  await reg.check("#terms");
  await reg.click("button[type=submit]");
  await settle(reg);
  check(
    "Usuario ya tomado se rechaza",
    (await text(reg)).includes("Ese usuario ya existe"),
  );
  await reg.fill("#username", "nuevapersona");
  await reg.check("#terms");
  await reg.click("button[type=submit]");
  await settle(reg);
  check(
    "Perfil completo entra a Explorar",
    (await reg.evaluate(() => location.hash)) === "#/explorar",
  );
  await reg.close();

  /* 3. Cliente + barra en dos marcos */
  const cust = await open(
    "app.html?marco=c&rol=cliente#/local/mil948",
    "cliente",
  );
  const bar = await open(
    "app.html?marco=b&rol=empleado#/barra/mil948",
    "barra",
    { width: 1440, height: 900 },
  );
  await cust.click("[data-act=add][data-pid=mil948-0-0]");
  check(
    "Agregar transforma el botón en stepper",
    await cust.locator("#p-mil948-0-0 .stepper").isVisible(),
  );
  check(
    "Con cantidad 1, el − es “Quitar”",
    (await cust.getAttribute(
      "#p-mil948-0-0 [data-delta='-1']",
      "aria-label",
    )) === "Quitar",
  );
  await cust.click("#p-mil948-0-0 [data-delta='-1']");
  check(
    "Quitar con cantidad 1 elimina la línea (nada atrapado)",
    await cust.locator("[data-act=add][data-pid=mil948-0-0]").isVisible(),
  );
  await cust.click("[data-act=add][data-pid=mil948-0-0]");
  await cust.click("[data-act=add][data-pid=mil948-1-0]");
  await cust.click("#p-mil948-1-0 [data-delta='1']");
  check(
    "Dock del carrito muestra 3 productos",
    (await cust.locator(".dock").innerText()).includes("3 productos"),
  );
  await cust.goto(BASE + "/app.html?marco=c#/local/stiefel-pub");
  await cust.click("[data-act=add][data-pid=stiefel-pub-0-0]");
  check(
    "Carrito de otro local pide reemplazar o conservar",
    (await cust.locator("#layer").innerText()).includes(
      "¿Empezar un carrito nuevo?",
    ),
  );
  await cust.click("#layer .sheet .actions [data-act=close-sheet]");
  await cust.goto(BASE + "/app.html?marco=c#/checkout");
  await cust.click("[data-act=place]");
  check(
    "Pedir muestra estado de carga en el botón",
    (await cust.getAttribute("[data-act=place]", "aria-busy")) === "true",
  );
  await cust.waitForFunction(() => location.hash.startsWith("#/confirmado/"));
  check("Confirmación con el vasito", await cust.locator(".vaso").isVisible());
  await cust.waitForFunction(
    () => location.hash.startsWith("#/pedido/"),
    null,
    { timeout: 4000 },
  );
  const orderHash = await cust.evaluate(() => location.hash);
  const number = (await cust.locator("h1").innerText()).replace("#", "").trim();
  await settle(bar);
  check(
    "El pedido aparece en Nuevos de la barra sin recargar",
    (await bar.locator(".board").innerText()).includes("#" + number),
  );
  check(
    "Pedido nuevo resaltado en la barra",
    (await bar.locator(`#o-${orderHash.split("/")[2]}.new`).count()) === 1,
  );
  await bar.click(`#o-${orderHash.split("/")[2]} [data-do=accept]`);
  await settle(cust);
  check(
    "Cliente ve Preparando al aceptar la barra",
    (await text(cust)).includes("Preparando"),
  );
  check(
    "Ya no puede cancelar tras la aceptación",
    (await cust.locator("[data-act=cancel]").count()) === 0,
  );
  await bar.click(`#o-${orderHash.split("/")[2]} [data-do=ready]`);
  await settle(cust);
  check(
    "Cliente ve Listo con ticket y código privado",
    (await text(cust)).includes("Listo para retirar") &&
      (await cust.locator(".ticket .code").count()) === 1,
  );
  const code = (await cust.locator(".ticket .code").innerText()).replace(
    /\s/g,
    "",
  );
  await bar.click(".board-head [data-act=pickup]");
  await bar.fill("#code", number);
  await bar.click("#layer button[type=submit]");
  check(
    "El número público no sirve para retirar",
    (await bar.locator("#layer .result.bad").innerText()).includes(
      "número público",
    ),
  );
  await bar.fill("#code", code);
  await bar.click("#layer button[type=submit]");
  check(
    "El código privado entrega el pedido",
    (await bar.locator("#layer .result.ok").innerText()).includes(
      "Entregado #" + number,
    ),
  );
  await bar.click("#layer [data-act=pickup-again]");
  await bar.fill("#code", code);
  await bar.click("#layer button[type=submit]");
  check(
    "El código consumido se rechaza",
    (await bar.locator("#layer .result.bad").innerText()).includes("ya se usó"),
  );
  await bar.keyboard.press("Escape");
  await settle(cust);
  check("Cliente ve Entregado", (await text(cust)).includes("Entregado"));

  /* 4. Cancelar vs aceptar: un ganador */
  await cust.goto(BASE + "/app.html?marco=c#/local/mil948");
  await cust.click("[data-act=add][data-pid=mil948-0-1]");
  await cust.goto(BASE + "/app.html?marco=c#/checkout");
  await cust.click("[data-act=place]");
  await cust.waitForFunction(
    () => location.hash.startsWith("#/pedido/"),
    null,
    { timeout: 5000 },
  );
  await cust.evaluate(() => window.OnzaStore.simulateVenueAccepts()); // la barra acepta; esta pantalla queda desactualizada
  await cust.click("[data-act=cancel]");
  await cust.click("#layer [data-act=cancel-confirm]");
  await settle(cust);
  check(
    "Cancelar después de que el local aceptó muestra el conflicto, sin cancelar",
    (await text(cust)).includes("El local ya aceptó tu pedido") &&
      (await text(cust)).includes("Preparando"),
  );

  /* 5. Stock que cambia + precio que cambia */
  await cust.goto(BASE + "/app.html?marco=c#/local/mil948");
  await cust.click("[data-act=add][data-pid=mil948-0-2]");
  await cust.click("[data-act=add][data-pid=mil948-1-1]");
  await cust.evaluate(() => {
    window.OnzaStore.simulateSoldOut();
    window.OnzaStore.simulatePriceChange();
  });
  await cust.goto(BASE + "/app.html?marco=c#/checkout");
  await cust.click("[data-act=place]");
  await cust.waitForSelector(".notice.danger");
  check(
    "Checkout rechaza producto agotado con acción para revisar",
    (await text(cust)).includes("Un producto se agotó"),
  );
  await cust.click("text=Revisar carrito");
  await settle(cust);
  const cartText = await text(cust);
  check(
    "Carrito marca agotado y precio nuevo",
    cartText.includes("Se agotó") && cartText.includes("Ahora cuesta"),
  );
  check(
    "Continuar queda bloqueado mientras haya problemas",
    (await cust.getAttribute("a[href='#/checkout']", "aria-disabled")) ===
      "true",
  );
  await cust.click(".prow.soldout [data-delta='-1']");
  await cust.click("[data-act=accept-price]");
  await settle(cust);
  check(
    "Tras quitar el agotado y aceptar el precio, se puede continuar",
    (await cust.getAttribute("a[href='#/checkout']", "aria-disabled")) === null,
  );

  /* 6. Sesión vencida: hoja de reingreso y carrito conservado para la misma cuenta */
  await cust.goto(BASE + "/app.html?marco=c#/checkout");
  await cust.evaluate(() => window.OnzaStore.frame.set({ expired: true }));
  await cust.click("[data-act=place]");
  await cust.waitForSelector("#layer .sheet");
  check(
    "Acción con sesión vencida abre “Tu sesión venció”",
    (await cust.locator("#layer").innerText()).includes("Tu sesión venció"),
  );
  await cust.click("#layer [data-act=reauth]");
  await settle(cust);
  check(
    "Reingreso con correo precargado y aviso",
    (await cust.inputValue("#email")) === "maria@correo.demo" &&
      (await text(cust)).includes("Tu sesión venció"),
  );
  await cust.fill("#password", "x");
  await cust.click("button[type=submit]");
  await cust.waitForFunction(() => location.hash === "#/checkout");
  check(
    "Vuelve al checkout con el mismo carrito",
    (await text(cust)).includes("Confirmar pedido") &&
      (await cust.locator(".line").count()) >= 1,
  );

  /* 7. Sin conexión: no se envía nada */
  await cust.evaluate(() => window.OnzaStore.frame.set({ offline: true }));
  await cust.evaluate(() => window.OnzaApp.render());
  check(
    "Banner de conexión persistente",
    (await cust.locator(".banner").innerText()).includes("Sin conexión"),
  );
  await cust.click("[data-act=place]");
  await cust.waitForSelector(".notice.danger");
  check(
    "Pedir sin conexión no crea pedido y ofrece reintentar",
    (await text(cust)).includes("No se hizo ningún cambio"),
  );
  await cust.evaluate(() => window.OnzaStore.frame.set({ offline: false }));

  /* 8. Doble envío: misma clave de intento → un solo pedido */
  const before = await cust.evaluate(
    () => window.OnzaStore.world().orders.length,
  );
  await cust.evaluate(() => {
    const k = window.OnzaStore.frame.get().attemptKey;
    window.OnzaStore.placeOrder(k);
    try {
      window.OnzaStore.placeOrder(k);
    } catch {
      /* carrito vacío */
    }
  });
  const after = await cust.evaluate(
    () => window.OnzaStore.world().orders.length,
  );
  check("Reenviar el mismo intento no duplica el pedido", after === before + 1);

  /* 9. Administración: alta, correo de cliente, revocar solo un local */
  const adm = await open(
    "app.html?marco=a&rol=admin#/admin/mil948/equipo",
    "admin",
    { width: 1440, height: 900 },
  );
  await adm.click("[data-act=add-member]");
  await adm.fill("#mname", "Pablo");
  await adm.fill("#memail", "maria@correo.demo");
  await adm.click("#layer button[type=submit]");
  check(
    "Alta con correo de cliente rechazada (R1)",
    (await adm.locator("#layer").innerText()).includes(
      "Usá otro correo para la cuenta laboral",
    ),
  );
  await adm.fill("#memail", "pablo@equipo.demo");
  await adm.click("#layer button[type=submit]");
  check(
    "Alta nueva muestra contraseña temporal una vez",
    await adm.locator("#layer .secret").isVisible(),
  );
  await adm.click("#layer .sheet [data-act=close-sheet]");
  check(
    "La persona nueva queda con clave temporal pendiente",
    (await text(adm)).includes("Clave temporal"),
  );
  check(
    "No puede quitarse su propio acceso",
    await adm
      .locator("[data-act=revoke][data-email='ana@equipo.demo']")
      .isDisabled(),
  );
  await bar.goto(BASE + "/app.html?marco=b#/barra/mil948");
  await adm.click("[data-act=revoke][data-email='jorge@equipo.demo']");
  await adm.click("#layer [data-act=revoke-confirm]");
  await settle(bar);
  check(
    "La barra de Jorge pierde el acceso al local revocado",
    (await text(bar)).includes("Ya no tenés acceso a este local"),
  );
  const anaVenues = await adm.evaluate(() =>
    window.OnzaStore.memberships("ana@equipo.demo")
      .map((m) => m.venue)
      .sort()
      .join(","),
  );
  check(
    "Revocar en un local no toca otras membresías",
    anaVenues === "mil948,stiefel-pub",
  );
  const rejected = await bar.evaluate(() => {
    try {
      window.OnzaStore.validatePickup("mil948", "AAAAAAAAAAAA");
      return false;
    } catch (e) {
      return e.code === "NOT_AUTHORIZED";
    }
  });
  check("Acción posterior a la revocación rechazada por las reglas", rejected);

  /* 10. Contraseña temporal: obligatoria también para comandos */
  const luis = await open("app.html?marco=l#/equipo/acceso", "luis");
  await luis.fill("#email", "luis@equipo.demo");
  await luis.fill("#password", "x");
  await luis.click("button[type=submit]");
  await settle(luis);
  check(
    "Clave temporal lleva al cambio obligatorio",
    (await luis.evaluate(() => location.hash)) === "#/equipo/clave",
  );
  await luis.goto(BASE + "/app.html?marco=l#/barra/mil948");
  await settle(luis);
  check(
    "No puede abrir la barra sin cambiarla",
    (await luis.evaluate(() => location.hash)) === "#/equipo/clave",
  );
  const blocked = await luis.evaluate(() => {
    try {
      window.OnzaStore.setVenueState("mil948", "paused");
      return false;
    } catch (e) {
      return e.code === "PASSWORD_CHANGE_REQUIRED";
    }
  });
  check("Comando con clave pendiente rechazado (equivale a la API)", blocked);
  await luis.fill("#pw", "una-clave-nueva");
  await luis.fill("#pw2", "una-clave-nueva");
  await luis.click("button[type=submit]");
  await settle(luis);
  check(
    "Tras cambiarla entra a su barra",
    (await luis.evaluate(() => location.hash)) === "#/barra/mil948",
  );
  await luis.close();

  /* 11. Sesión del tipo equivocado: no se cierra sola */
  const wrong = await open("app.html?marco=b#/explorar", "wrong");
  check(
    "Cuenta del equipo en el área cliente ve “Ya hay una sesión iniciada”",
    (await text(wrong)).includes("Ya hay una sesión iniciada"),
  );
  await wrong.close();

  /* 12. Desbordes horizontales */
  const routes = [
    "#/acceso",
    "#/acceso/correo",
    "#/explorar",
    "#/local/mil948",
    "#/local/otro-bar",
    "#/carrito",
    "#/checkout",
    "#/pedidos",
    "#/cuenta",
    "#/onboarding",
  ];
  const staffRoutes = [
    "#/equipo/locales",
    "#/barra/mil948",
    "#/admin/mil948/resumen",
    "#/admin/mil948/menu",
    "#/admin/mil948/negocio",
    "#/admin/mil948/equipo",
  ];
  let overflow = [];
  for (const theme of ["light", "dark"]) {
    for (const width of [360, 390, 1440]) {
      for (const [marco, list] of [
        ["ov-c", routes],
        ["ov-a", staffRoutes],
      ]) {
        const page = await open(
          `app.html?marco=${marco}&rol=${marco === "ov-c" ? "cliente" : "admin"}&captura=1#/`,
          `overflow-${width}`,
          { width, height: 900 },
        );
        await page.evaluate(
          (t) => window.OnzaStore.frame.set({ theme: t }),
          theme,
        );
        for (const r of list) {
          await page.goto(`${BASE}/app.html?marco=${marco}&captura=1${r}`);
          await page.waitForTimeout(80);
          const wide = await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth + 1,
          );
          if (wide) overflow.push(`${r} ${width} ${theme}`);
        }
        await page.close();
      }
    }
  }
  check(
    "Sin desborde horizontal en 360/390/1440, claro y oscuro",
    overflow.length === 0,
    overflow.join("; "),
  );
  for (const p of ["index.html", "componentes.html", "flujo.html"]) {
    for (const width of [390, 1440]) {
      const page = await open(p, p, { width, height: 900 });
      const wide = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      if (wide && p !== "flujo.html") overflow.push(`${p} ${width}`);
      await page.close();
    }
  }
  check(
    "Índice y catálogo sin desborde",
    overflow.length === 0,
    overflow.join("; "),
  );

  /* 13. Capturas acotadas (para revisión humana) */
  if (SHOTS) {
    const fresh = await open("app.html?captura=1", "reset");
    await fresh.evaluate(() => localStorage.clear());
    await fresh.close();
    const out = join(ROOT, "capturas");
    await mkdir(out, { recursive: true });
    const shots = [
      ["explorar-390-claro", "cliente", "light", 390, "#/explorar"],
      ["local-390-oscuro", "cliente", "dark", 390, "#/local/mil948"],
      ["checkout-390-claro", "cliente", "light", 390, "#/checkout"],
      ["barra-1440-claro", "admin", "light", 1440, "#/barra/mil948"],
      ["barra-390-oscuro", "admin", "dark", 390, "#/barra/mil948"],
      [
        "admin-equipo-1440-oscuro",
        "admin",
        "dark",
        1440,
        "#/admin/mil948/equipo",
      ],
      ["acceso-390", "", "dark", 390, "#/acceso"],
    ];
    for (const [name, rol, theme, width, route] of shots) {
      const marco = "shot-" + name;
      const page = await open(
        `app.html?marco=${marco}${rol ? "&rol=" + rol : ""}&captura=1#/`,
        name,
        { width, height: width < 800 ? 844 : 900 },
      );
      await page.evaluate(
        (t) => window.OnzaStore.frame.set({ theme: t }),
        theme,
      );
      if (route === "#/checkout") {
        await page.evaluate(() => {
          window.OnzaStore.addToCart("mil948-0-0");
          window.OnzaStore.addToCart("mil948-1-0");
          window.OnzaStore.addToCart("mil948-1-0");
        });
      }
      await page.goto(`${BASE}/app.html?marco=${marco}&captura=1${route}`);
      await page.waitForTimeout(700);
      await page.screenshot({ path: join(out, name + ".png") });
      await page.close();
    }
    // Ticket listo en el teléfono, en oscuro.
    const t = await open(
      "app.html?marco=shot-ticket&rol=cliente&captura=1#/local/apotecario",
      "ticket",
      { width: 390, height: 844 },
    );
    await t.evaluate(() => {
      window.OnzaStore.frame.set({ theme: "dark" });
      window.OnzaStore.addToCart("apotecario-0-0");
    });
    const id = await t.evaluate(() => {
      const o = window.OnzaStore.placeOrder("shot-ticket");
      const w = window.OnzaStore.world();
      const x = w.orders.find((y) => y.id === o.id);
      x.status = "ready";
      x.readyAt = Date.now();
      localStorage.setItem("onza-maqueta-v1-world", JSON.stringify(w));
      return o.id;
    });
    await t.goto(`${BASE}/app.html?marco=shot-ticket&captura=1#/pedido/${id}`);
    await t.waitForTimeout(500);
    await t.screenshot({
      path: join(out, "listo-390-oscuro.png"),
      fullPage: true,
    });
    await t.close();
    const flow = await open("flujo.html", "flujo", {
      width: 1440,
      height: 900,
    });
    await flow.waitForTimeout(1200);
    await flow.screenshot({ path: join(out, "flujo-1440.png") });
    await flow.close();
    check("Capturas generadas", true, "design/maquetas-v1/capturas/");
  }
} catch (err) {
  check("Ejecución sin excepciones", false, err.message.split("\n")[0]);
} finally {
  check(
    "Cero errores de consola o de página",
    errors.length === 0,
    errors.slice(0, 5).join(" | "),
  );
  await writeFile(
    join(ROOT, "verificacion.json"),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        passed: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
  server.close();
  process.exitCode = results.every((r) => r.ok) ? 0 : 1;
}
