// Auditoría de sesiones (prioridad 1): recorrido cliente → barra → admin → cliente con cuentas separadas, sesión equivocada,
// cierre de sesión (alcance), vencimiento, regreso a la ruta prevista, acceso revocado con la pantalla abierta, fallas
// transitorias de Auth/base y sincronía entre pestañas.
// AISLADO: servidor de verificación local (scripts/local-shim, PGlite) + app en :3100. NO es Supabase Auth: no prueba cookies
// reales con refresh, expiración real de JWT, ni Realtime. Nada toca onza-dev ni un despliegue público.
// Uso: ONZA_APP=http://127.0.0.1:3100 node scripts/verify-audit-sesiones.mjs [carpeta-de-capturas]
// (el shim debe estar en :54321 con datos limpios y la app apuntada a él; ver README «Plan de pulido»).
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { people, SERVICE_KEY } from "./local-shim/index.mjs";
import { sessionCookies } from "./local-shim/session.mjs";
import { stableId } from "./lib/real-venues-seed.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const APP = process.env.ONZA_APP ?? "http://127.0.0.1:3100";
const SHIM = process.env.SHIM_URL ?? "http://127.0.0.1:54321";
const OUT = process.argv[2] ?? join(tmpdir(), "onza-audit-sesiones");
mkdirSync(OUT, { recursive: true });
const venue = (slug) => stableId("onza-real-venue", slug);
const MIL = venue("mil948");
const STIEFEL = venue("stiefel-pub");
const OTRO = venue("apotecario");

const only = process.env.ONLY?.split(",");
const want = (n) => !only || only.includes(String(n));
let total = 0;
let failed = 0;
const check = (name, ok, detail = "") => {
  total++;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${detail}`}`);
};
const service = (path, body) =>
  fetch(`${SHIM}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
  });
const sql = (text) => service("/__fixture/sql", { sql: text });
const fault = (target, count) => service("/__fixture/fault", { target, count });
const logouts = () => fetch(`${SHIM}/__fixture/logouts`).then((r) => r.json());

const browser = await chromium.launch().catch(() =>
  chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium" }),
);
async function open(email, { width = 390, height = 844 } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  if (email) await context.addCookies(await sessionCookies(SHIM, email));
  const page = await context.newPage();
  return { context, page };
}
const settle = (page) => page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => undefined);
const text = async (page) => {
  await settle(page);
  return page.locator("body").innerText();
};
/** Espera (hasta 8 s) a que la navegación termine en la ruta esperada y la devuelve. */
const landed = async (page, expected) => {
  await page.waitForURL((u) => expected(u.pathname + u.search), { timeout: 8000 }).catch(() => undefined);
  await settle(page);
  return path(page);
};
const path = (page) => new URL(page.url()).pathname + new URL(page.url()).search;
const post = (page, url, body) =>
  page.evaluate(
    async ([u, b]) => {
      const r = await fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
      return { status: r.status, body: await r.json().catch(() => null) };
    },
    [url, body],
  );
const get = (page, url) =>
  page.evaluate(async (u) => {
    const r = await fetch(u, { cache: "no-store" });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, url);

try {
  // Fixture: Ana admin de Mil948 y barra en Stiefel (ya sembrado); Jorge barra de Mil948.
  /* 1. Cliente sin membresías: Equipo no cierra su sesión */
  if (want(1)) {
    const { context, page } = await open(people.maria.email);
    await page.goto(`${APP}/equipo/locales`);
    check("Cliente en /equipo/locales → elección de cuenta (no cierra sesión)", path(page) === "/sesion-activa?want=equipo", path(page));
    check("El aviso dice que la cuenta es personal y sin acceso al equipo", (await text(page)).includes("no tiene acceso al equipo"));
    await page.screenshot({ path: `${OUT}/01-cliente-en-equipo.png` });
    await page.goto(`${APP}/`);
    check("La sesión del cliente sigue viva después", path(page) === "/" && !(await text(page)).includes("Acceso"), path(page));
    const denied = await get(page, `/api/orders?venue=${MIL}`);
    check("API de barra con cuenta de cliente → 403", denied.status === 403, JSON.stringify(denied));
    const team = await get(page, `/api/team?venue=${MIL}`);
    check("API de equipo con cuenta de cliente → 403", team.status === 403, JSON.stringify(team));
    const summary = await get(page, `/api/summary?venue=${MIL}&day=2026-11-19`);
    check("Resumen del local con cuenta de cliente → 403", summary.status === 403, JSON.stringify(summary));
    await context.close();
  }

  /* 2. Empleado con un local: entra a su barra; el área de clientes le ofrece volver a su espacio */
  if (want(2)) {
    const { context, page } = await open(people.jorge.email);
    await page.goto(`${APP}/equipo/acceso`);
    check("Empleado con un local entra directo a su barra", (await landed(page, (p) => p === `/staff/${MIL}`)) === `/staff/${MIL}`, path(page));
    await page.goto(`${APP}/`);
    check("Empleado en el área de clientes → elección de cuenta", path(page) === "/sesion-activa?want=cliente", path(page));
    check("El aviso dice que la cuenta del equipo no puede pedir", (await text(page)).includes("no puede pedir"));
    await page.goto(`${APP}/admin/${MIL}`);
    check("Empleado en administración → «Ya no tenés acceso» con salida", (await text(page)).includes("Ya no tenés acceso a este local"));
    const order = await post(page, "/api/commands", {
      action: "create", venueId: MIL, items: [], idempotencyKey: "x", termsVersion: "demo-v1", privacyVersion: "demo-v1", adult: true,
    });
    check("Empleado no puede crear pedidos (validación o STAFF_CANNOT_ORDER)", order.status === 422 || order.status === 403, JSON.stringify(order));
    await context.close();
  }

  /* 3. Dos locales con permisos distintos (Ana: admin en Mil948, barra en Stiefel) */
  if (want(3)) {
    const { context, page } = await open(people.ana.email);
    await page.goto(`${APP}/equipo/locales`);
    const body = await text(page);
    check("«Tus locales» muestra los dos locales con su rol por local", /Mil948[\s\S]*Administrador/.test(body) && /Stiefel[\s\S]*Empleado/.test(body), body.slice(0, 300));
    await page.screenshot({ path: `${OUT}/03-dos-locales.png`, fullPage: true });
    await page.goto(`${APP}/admin/${STIEFEL}`);
    check("Admin en Mil948 pero barra en Stiefel: /admin/Stiefel se deniega", (await text(page)).includes("Ya no tenés acceso a este local"));
    await page.goto(`${APP}/staff/${STIEFEL}`);
    check("Barra de Stiefel sí abre", !(await text(page)).includes("Ya no tenés acceso"));
    await page.goto(`${APP}/admin/${MIL}`);
    check("Administración de Mil948 sí abre", !(await text(page)).includes("Ya no tenés acceso"));
    const other = await get(page, `/api/orders?venue=${OTRO}`);
    check("Local ajeno (sin membresía) → 403 en pedidos", other.status === 403, JSON.stringify(other));
    const stiefelSummary = await get(page, `/api/summary?venue=${STIEFEL}&day=2026-11-19`);
    check("Resumen de Stiefel (solo barra) → 403", stiefelSummary.status === 403, JSON.stringify(stiefelSummary));
    const milSummary = await get(page, `/api/summary?venue=${MIL}&day=2026-11-19`);
    check("Resumen de Mil948 (admin) → 200", milSummary.status === 200, JSON.stringify(milSummary).slice(0, 200));
    await context.close();
  }

  /* 4. Cierre de sesión: alcance exacto */
  if (want(4)) {
    const before = (await logouts()).length;
    const { context, page } = await open(people.maria.email);
    await page.goto(`${APP}/cuenta`);
    await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
    await page.waitForURL(/\/acceso/);
    const first = (await logouts()).slice(before);
    check("«Cerrar sesión» cierra solo este dispositivo (scope=local)", first.length === 1 && first[0].scope === "local", JSON.stringify(first));
    await context.close();
    const again = await open(people.maria.email);
    await again.page.goto(`${APP}/cuenta`);
    await again.page.getByRole("button", { name: "Cerrar sesión en todos mis dispositivos" }).click();
    await again.page.waitForURL(/\/acceso/);
    const second = (await logouts()).slice(before + 1);
    check("«Cerrar sesión en todos mis dispositivos» usa scope=global", second.length === 1 && second[0].scope === "global", JSON.stringify(second));
    await again.context.close();
  }

  /* 5. Sesión vencida: regreso a la ruta prevista, sin bucles */
  if (want(5)) {
    const { context, page } = await open(people.maria.email);
    const good = await context.cookies();
    await context.clearCookies();
    await page.goto(`${APP}/orders`);
    await settle(page);
    check("Cliente sin sesión en /orders → /acceso con destino", path(page) === "/acceso?next=%2Forders", path(page));
    await page.locator("summary", { hasText: "Continuar con correo" }).click();
    await page.getByLabel("Correo").fill(people.maria.email);
    await page.getByLabel("Contraseña").first().fill("cualquiera-largo-1");
    await page.getByRole("button", { name: "Ingresar", exact: true }).click();
    await page.waitForURL((u) => u.pathname === "/orders", { timeout: 10000 }).catch(() => undefined);
    check("Tras volver a entrar regresa a la ruta prevista (/orders)", path(page) === "/orders", path(page));
    await context.close();
    const st = await open(null);
    await st.page.goto(`${APP}/staff/${MIL}`);
    await settle(st.page);
    check("Equipo sin sesión → /equipo/acceso con destino", path(st.page) === `/equipo/acceso?next=${encodeURIComponent(`/staff/${MIL}`)}`, path(st.page));
    await st.page.getByLabel("Correo del trabajo").fill(people.jorge.email);
    await st.page.getByLabel("Contraseña").fill("cualquiera-largo-1");
    await st.page.getByRole("button", { name: "Ingresar" }).click();
    await st.page.waitForURL((u) => u.pathname === `/staff/${MIL}`, { timeout: 10000 }).catch(() => undefined);
    check("Tras entrar el empleado regresa a su barra", path(st.page) === `/staff/${MIL}`, path(st.page));
    await st.context.close();
    void good;
  }

  /* 6. Cuenta de cliente en el acceso del equipo: no se queda abierta y no cierra otras sesiones */
  if (want(6)) {
    const before = (await logouts()).length;
    const { context, page } = await open(null);
    await page.goto(`${APP}/equipo/acceso`);
    await settle(page);
    await page.getByLabel("Correo del trabajo").fill(people.maria.email);
    await page.getByLabel("Contraseña").fill("cualquiera-largo-1");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForSelector("text=Esta es una cuenta personal");
    const closed = (await logouts()).slice(before);
    check("Cliente en el formulario del equipo: se informa y se cierra solo este dispositivo", closed.length === 1 && closed[0].scope === "local", JSON.stringify(closed));
    await context.close();
  }

  /* 7. Acceso revocado con la pantalla abierta */
  if (want(7)) {
    // Un pedido real de Sofía (pagos mock) para que la barra tenga algo visible que debe desaparecer al revocar.
    const customer = await open(people.sofia.email);
    await customer.page.goto(`${APP}/`);
    const products = await fetch(`${SHIM}/rest/v1/products?venue_id=eq.${MIL}&archived=is.false&limit=1`).then((r) => r.json());
    const made = await post(customer.page, "/api/commands", {
      action: "create", venueId: MIL, items: [{ productId: products[0].id, quantity: 1, expectedProductVersion: products[0].version }],
      idempotencyKey: `audit-${Date.now()}`, termsVersion: "demo-v1", privacyVersion: "demo-v1", adult: true,
    });
    check("Fixture: Sofía crea un pedido mock en Mil948", made.status === 200 && !!made.body?.public_code, JSON.stringify(made).slice(0, 200));
    const code = made.body?.public_code;
    await customer.context.close();

    const { context, page } = await open(people.jorge.email);
    await page.goto(`${APP}/staff/${MIL}`);
    await page.waitForSelector(`text=#${code}`, { timeout: 20000 }).catch(() => undefined);
    const before = await text(page);
    check("Antes de revocar, la barra muestra el pedido y no hay aviso de acceso", !before.includes("Ya no tenés acceso") && before.includes(code), before.slice(0, 200));
    await sql(`delete from public.memberships where user_id='${people.jorge.id}' and venue_id='${MIL}'`);
    const op = await post(page, "/api/commands", { action: "venue_update", venueId: MIL, paused: true });
    check("La siguiente operación sensible (pausar) se rechaza con 403", op.status === 403, JSON.stringify(op));
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.waitForSelector("text=Ya no tenés acceso a este local", { timeout: 10000 });
    check("La barra abierta muestra «Ya no tenés acceso» tras la revocación", true);
    const after = await text(page);
    check("La vista retira los pedidos del local (el código ya no está en pantalla)", !after.includes(code), after.slice(0, 200));
    await page.screenshot({ path: `${OUT}/07-revocado.png` });
    const navs = [];
    page.on("framenavigated", (f) => f === page.mainFrame() && navs.push(f.url()));
    await page.getByRole("link", { name: "Ver mis locales" }).click();
    await landed(page, (p) => p === "/equipo/locales");
    check("«Ver mis locales» lleva a un contexto válido sin bucles", path(page) === "/equipo/locales" && navs.length <= 3, `${path(page)} (${navs.length} navegaciones)`);
    await page.waitForSelector("text=Tu acceso está pendiente", { timeout: 8000 }).catch(() => undefined);
    check("«Tus locales» ya no ofrece el local revocado", (await text(page)).includes("Tu acceso está pendiente"), (await text(page)).slice(0, 200));
    const readAgain = await get(page, `/api/orders?venue=${MIL}`);
    check("Lectura directa de pedidos del local revocado → 403", readAgain.status === 403, JSON.stringify(readAgain));
    await sql(`insert into public.memberships(user_id,venue_id,role) values('${people.jorge.id}','${MIL}','bartender') on conflict do nothing`);
    await context.close();
  }

  /* 8. Rol rebajado de admin a empleado con la administración abierta */
  if (want(8)) {
    const { context, page } = await open(people.ana.email);
    await page.goto(`${APP}/admin/${MIL}`);
    check("Admin abre administración", !(await text(page)).includes("Ya no tenés acceso"));
    await sql(`update public.memberships set role='bartender' where user_id='${people.ana.id}' and venue_id='${MIL}'`);
    const summary = await get(page, `/api/summary?venue=${MIL}&day=2026-11-19`);
    const team = await get(page, `/api/team?venue=${MIL}`);
    check("Con el rol rebajado, resumen y equipo se rechazan al instante", summary.status === 403 && team.status === 403, `${summary.status}/${team.status}`);
    await page.reload();
    check("Recargar administración muestra salida clara", (await text(page)).includes("Ya no tenés acceso a este local"));
    await page.goto(`${APP}/staff/${MIL}`);
    check("Sigue pudiendo operar la barra con el rol vigente", !(await text(page)).includes("Ya no tenés acceso"));
    await sql(`update public.memberships set role='admin' where user_id='${people.ana.id}' and venue_id='${MIL}'`);
    await context.close();
  }

  /* 9. Fallas transitorias: nunca «sin sesión» ni «cuenta personal» */
  if (want(9)) {
    const { context, page } = await open(people.maria.email);
    await page.goto(`${APP}/cuenta`);
    await fault("user", 1);
    const response = await page.goto(`${APP}/orders`);
    check("Falla de Auth → 503 con reintento (no redirige al acceso)", response?.status() === 503 && (await text(page)).includes("No pudimos verificar tu sesión"), `${response?.status()} ${path(page)}`);
    await page.getByRole("link", { name: "Reintentar" }).click();
    await page.waitForLoadState();
    check("Reintentar recupera la misma sesión", path(page) === "/orders", path(page));
    await context.close();
    const staff = await open(people.jorge.email);
    await fault("account", 1);
    const r2 = await staff.page.goto(`${APP}/staff/${MIL}`);
    check("Falla de la base en un empleado → 503 (no «cuenta personal sin acceso»)", r2?.status() === 503 && !path(staff.page).startsWith("/sesion-activa"), `${r2?.status()} ${path(staff.page)}`);
    await staff.page.getByRole("link", { name: "Reintentar" }).click();
    await staff.page.waitForLoadState();
    check("Reintentar abre la barra del empleado", path(staff.page) === `/staff/${MIL}`, path(staff.page));
    await staff.context.close();
  }

  /* 10. Dos pestañas, misma identidad: otra pestaña cierra sesión */
  if (want(10)) {
    const { context, page } = await open(people.maria.email);
    await page.goto(`${APP}/cuenta`);
    const other = await context.newPage();
    await other.goto(`${APP}/cuenta`);
    await other.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
    await other.waitForURL(/\/acceso/);
    await page.waitForURL(/\/acceso/, { timeout: 10000 }).catch(() => undefined);
    check("La otra pestaña deja de mostrar la cuenta cerrada", /\/acceso/.test(page.url()), page.url());
    await context.close();
  }

  /* 11. Cliente en una pestaña y barra en otro perfil (identidades simultáneas con perfiles distintos) */
  if (want(11)) {
    const customer = await open(people.maria.email);
    const staff = await open(people.jorge.email);
    await customer.page.goto(`${APP}/cuenta`);
    await staff.page.goto(`${APP}/staff/${MIL}`);
    check("Cliente y barra a la vez en contextos separados", path(customer.page) === "/cuenta" && path(staff.page) === `/staff/${MIL}`);
    check("La cuenta de cada contexto es la suya", (await text(customer.page)).includes(people.maria.name) && (await text(staff.page)).includes("Jorge"));
    await customer.context.close();
    await staff.context.close();
  }
} finally {
  await browser.close();
}
console.log(`\n${total - failed}/${total} comprobaciones superadas${failed ? `, ${failed} fallaron` : ""}. Capturas: ${OUT}`);
process.exit(failed ? 1 : 0);
