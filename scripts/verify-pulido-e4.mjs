// Plan de pulido · Entrega 4. Administración a 360 px contra la app local (shim). Ejecutar después de
// verify-pulido-e3.mjs para tener pedidos entregados con cobro simulado. No prueba subida real a Storage.
// Uso: ONZA_APP=http://127.0.0.1:3100 node scripts/verify-pulido-e4.mjs [carpeta-capturas]
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
const context = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" });
await context.addCookies(await sessionCookies(SHIM, people.ana.email));
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
const shot = (name) => OUT && page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const noHorizontal = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
try {
  await page.goto(`${APP}/equipo/acceso`);
  await page.waitForURL(/\/equipo\/locales/);
  await page.getByRole("link", { name: "Administrar" }).click();
  await page.waitForURL(/\/admin\//);
  const tabs = page.locator("nav.admin-tabs");
  await tabs.locator("a").first().waitFor();
  const labels = await tabs.locator("a").allTextContents();
  check("Seis secciones en la fila de tabs", ["Resumen", "Pedidos", "Menú", "Disponibilidad", "Negocio", "Equipo"].every((l) => labels.some((t) => t.includes(l))), labels.join(" | "));
  const row = await tabs.evaluate((el) => ({ scroll: el.scrollWidth > el.clientWidth, overflow: getComputedStyle(el).overflowX, sticky: getComputedStyle(el).position }));
  check("La fila de tabs desliza sola y queda fija arriba", row.scroll && row.overflow === "auto" && row.sticky === "sticky", JSON.stringify(row));
  check("La página no se desplaza en horizontal (Resumen)", await noHorizontal());
  for (const name of ["Equipo", "Negocio", "Disponibilidad", "Menú", "Pedidos", "Resumen"]) {
    await tabs.getByRole("link", { name }).click();
    await page.waitForURL(new RegExp(`tab=${{ Equipo: "equipo", Negocio: "negocio", Disponibilidad: "disponibilidad", Menú: "menu", Pedidos: "pedidos", Resumen: "resumen" }[name]}`));
    const active = tabs.locator('[aria-current="page"]');
    const inView = await active.evaluate((el) => {
      const a = el.getBoundingClientRect();
      const b = el.parentElement.getBoundingClientRect();
      return a.left >= b.left - 1 && a.right <= b.right + 1;
    });
    if (!inView || !(await noHorizontal())) {
      check(`Tab ${name} activo a la vista y sin scroll horizontal`, false);
    }
  }
  check("Se llega a cada tab con el dedo; el activo queda a la vista y nunca hay scroll horizontal", true);
  // Teclado: Tab llega a los enlaces de la fila.
  await page.keyboard.press("Tab");
  let reached = false;
  for (let i = 0; i < 12 && !reached; i++) {
    reached = await page.evaluate(() => !!document.activeElement?.closest("nav.admin-tabs"));
    if (!reached) await page.keyboard.press("Tab");
  }
  check("Con teclado se llega a la fila de tabs", reached);

  // Resumen.
  await page.goto(`${APP}/admin/${mil}?tab=resumen`);
  await page.locator(".kpis").waitFor();
  const kpis = await page.locator(".kpis .metric").allInnerTexts();
  check("KPIs: entregados, ventas netas, preparación y pedidos activos", ["Entregados", "Ventas netas", "Preparación", "Pedidos activos"].every((k) => kpis.some((t) => t.includes(k))));
  check("Reservas en una tarjeta aparte, como saldo actual", (await page.locator(".reserve-card").innerText()).includes("actual"));
  const delivered = Number((await page.locator(".kpis .metric").first().locator(".v").innerText()).trim());
  check("El resumen de esta noche refleja los pedidos entregados en la prueba de barra", delivered >= 1, String(delivered));
  check("Gráfico de pedidos por hora con pico rotulado", (await page.locator(".summary-chart .bar").count()) === 24 && (await page.locator(".summary-chart .peak").count()) === 1);
  await page.getByRole("button", { name: "Ventas netas" }).click();
  check("Selector Pedidos / Ventas netas cambia la serie", (await page.getByRole("heading", { name: /Ventas netas por hora de cobro/ }).count()) === 1);
  await shot("e4-resumen-360");
  await page.locator(".row-link").click();
  check("Productos abre un detalle con unidades y montos", (await page.getByRole("dialog").locator("tbody tr").count()) > 0);
  await page.keyboard.press("Escape");
  await page.locator(".period-button").click();
  await page.getByRole("dialog").getByRole("button", { name: "Semana" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Aplicar" }).click();
  await page.waitForTimeout(800);
  check("Período Semana: gráfico por noche", (await page.locator(".summary-chart .bar").count()) === 7, String(await page.locator(".summary-chart .bar").count()));
  check("Sin scroll horizontal en Resumen", await noHorizontal());

  // Pedidos.
  await page.goto(`${APP}/admin/${mil}?tab=pedidos`);
  await page.getByRole("heading", { name: "Pedidos e incidencias" }).waitFor();
  check("Filtro «Activos (N) / Todos»", (await page.getByRole("button", { name: /Activos \(\d+\)/ }).count()) === 1);

  // Menú: editar a 360 px.
  await page.goto(`${APP}/admin/${mil}?tab=menu`);
  await page.locator(".product-row", { hasText: "Gin tonic" }).getByRole("button", { name: "Editar" }).click();
  const price = page.getByLabel(/Precio/);
  await price.waitFor();
  check("Editar producto a 360 px sin desborde", await noHorizontal());
  await shot("e4-editar-360");

  // Negocio.
  await page.goto(`${APP}/admin/${mil}?tab=negocio`);
  await page.getByText("Portada del local").waitFor();
  check("Portada y logo como controles separados, sin «Choose File» visible",
    (await page.getByText("Portada del local").count()) === 1 && (await page.getByText("Logo del local").count()) >= 1 &&
      (await page.locator('input[type="file"]').evaluateAll((els) => els.every((el) => el.getBoundingClientRect().width <= 1))) && (await page.getByRole("button", { name: "Subir" }).count()) === 2);
  check("Vista previa de la tarjeta de Explorar y de la cabecera", (await page.locator(".profile-previews .vcard").count()) === 1 && (await page.locator(".header-preview").count()) === 1);
  await page.getByLabel("Nombre del local").fill("Mil948 Bar");
  check("La vista previa marca «Sin guardar» y muestra el cambio", (await page.getByText("Sin guardar").count()) === 1 && (await page.locator(".profile-previews").innerText()).includes("Mil948 Bar"));
  check("Sin scroll horizontal en Negocio", await noHorizontal());
  await shot("e4-negocio-360");
  await page.goto(`${APP}/admin/${mil}?tab=equipo`);
  await page.getByText(/Jorge Mora/).first().waitFor({ timeout: 10000 }).catch(() => undefined);
  check("Equipo y permisos siguen disponibles", (await page.getByText(/Jorge Mora/).count()) > 0);
} catch (e) {
  check("Recorrido sin excepciones", false, e.message.split("\n")[0]);
} finally {
  check("Sin errores de página", errors.length === 0, errors.join(" | "));
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} comprobaciones`);
  process.exit(results.every(Boolean) ? 0 : 1);
}
