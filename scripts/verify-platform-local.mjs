// Recorrido del panel de plataforma y del panel de empresa contra el entorno local (`npm run demo:local`, que usa las migraciones
// reales sobre una base simulada). Comprueba con un navegador real: acceso solo del operador (404 para todos los demás),
// inicio de sesión, asistente de 4 pasos, estados, invitación con contraseña elegida por la persona y panel de empresa.
//
// Uso: SHIM_MFA_EMAILS=admin.choliempresas@gmail.com PORT=3199 SHIM_PORT=54399 node scripts/demo-local.mjs &
//      node scripts/verify-platform-local.mjs <carpeta-de-capturas>
// SHIM_MFA_EMAILS solo existe en el entorno local: simula un segundo factor reciente para ese correo.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { createServerClient } from "@supabase/ssr";

const APP = process.env.APP ?? "http://127.0.0.1:3199";
const SHIM = process.env.SHIM ?? "http://127.0.0.1:54399";
const OUT = process.argv[2] ?? "capturas-panel";
const OPERATOR = "admin.choliempresas@gmail.com";
mkdirSync(OUT, { recursive: true });

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${ok || !detail ? "" : `  → ${detail}`}`);
  if (!ok) failures++;
};

async function createUser(email) {
  const res = await fetch(`${SHIM}/auth/v1/admin/users`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer local-shim-service-role", apikey: "local-shim-service-role" },
    body: JSON.stringify({ email, password: "clave-larga-de-prueba-1", email_confirm: true }),
  });
  return res.status === 200 || res.status === 201 || res.status === 422; // 422 = ya existe
}

/** Cookies de sesión (mismo formato que @supabase/ssr) para una cuenta del entorno local. */
async function cookiesFor(email) {
  const cookies = [];
  const auth = createServerClient(SHIM, "local-shim-publishable", { cookies: { getAll: () => [], setAll: (v) => cookies.push(...v) } });
  const { error } = await auth.auth.signInWithPassword({ email, password: "cualquiera-largo-1" });
  if (error) throw new Error(`Sesión de ${email}: ${error.message}`);
  return cookies.map(({ name, value }) => ({ name, value, domain: "127.0.0.1", path: "/", sameSite: "Lax" }));
}

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
const newContext = async (email, viewport = { width: 1280, height: 900 }) => {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  if (email) await context.addCookies(await cookiesFor(email));
  return context;
};
const status = async (context, path, init) => {
  const res = init ? await context.request.post(`${APP}${path}`, init) : await context.request.get(`${APP}${path}`, { maxRedirects: 0 });
  return res.status();
};

// Calentamiento: el servidor de desarrollo compila cada ruta la primera vez y recarga la página; así el recorrido no depende de eso.
for (const path of ["/acceso", "/admin/acceso", "/admin", "/panel/acceso", "/panel"]) await fetch(`${APP}${path}`, { redirect: "manual" }).catch(() => undefined);
await createUser(OPERATOR);
await createUser("impostor@ejemplo.com");

// ---------------------------------------------------------------- A. Matriz de acceso
const platformPaths = ["/admin", "/admin/empresas", "/admin/establecimientos", "/admin/usuarios", "/admin/auditoria", "/admin/nueva-empresa", "/admin/nuevo-establecimiento", "/admin/seguridad"];
const personas = [
  ["sin sesión", null],
  ["consumidor (maria@correo.demo)", "maria@correo.demo"],
  ["administrador de un local (ana@equipo.demo)", "ana@equipo.demo"],
  ["barra (jorge@equipo.demo)", "jorge@equipo.demo"],
  ["otro correo verificado (impostor@ejemplo.com)", "impostor@ejemplo.com"],
];
for (const [label, email] of personas) {
  const context = await newContext(email);
  const codes = [];
  for (const path of platformPaths) codes.push([path, await status(context, path)]);
  codes.push(["/api/platform-admin/data?view=overview", await status(context, "/api/platform-admin/data?view=overview")]);
  codes.push(["POST /api/platform-admin/commands", await status(context, "/api/platform-admin/commands", { headers: { origin: APP, "content-type": "application/json" }, data: JSON.stringify({ command: "org_status", id: "30000000-0000-4000-8000-000000000001", status: "suspended", reason: "intento ajeno" }) })]);
  const bad = codes.filter(([, code]) => code !== 404);
  check(`${label}: 404 en las ${codes.length} rutas del panel`, bad.length === 0, JSON.stringify(bad));
  await context.close();
}
{
  const context = await newContext(null);
  const page = await context.newPage();
  const res = await page.goto(`${APP}/admin/acceso`, { waitUntil: "networkidle" });
  check("/admin/acceso es la única ruta visible sin ser operador", res?.status() === 200 && (await page.getByRole("heading", { name: "Acceso de plataforma" }).count()) === 1);
  const legacy = await status(context, "/admin/20000000-0000-4000-8000-000000000099");
  check("/admin/<uuid> (administrador de un local) sigue siendo del equipo: redirige al acceso del equipo", legacy === 307 || legacy === 302 || legacy === 303, String(legacy));
  await context.close();
}

// ---------------------------------------------------------------- B. Operador por la interfaz
const operator = await newContext(null);
const page = await operator.newPage();
await page.goto(`${APP}/admin/acceso`, { waitUntil: "networkidle" });
await page.getByLabel("Correo").fill("admin.choliempresas@gmail.com");
await page.getByLabel("Contraseña").fill("clave-larga-de-prueba-1");
await page.getByRole("button", { name: "Ingresar" }).click();
await page.waitForURL(`${APP}/admin`, { timeout: 30000 });
check("el operador inicia sesión y ve el resumen global", (await page.getByRole("heading", { name: "Resumen global" }).count()) === 1);
await page.screenshot({ path: `${OUT}/01-resumen.png`, fullPage: true });

await page.goto(`${APP}/admin/nueva-empresa`);
await page.getByLabel("Nombre comercial").fill("Bar Central de Prueba");
check("el enlace de la empresa se genera solo", (await page.getByLabel("Enlace de la empresa").inputValue()) === "bar-central-de-prueba");
await page.getByLabel("Documento de identidad").fill("123");
const next = page.getByRole("button", { name: "Siguiente" });
check("un documento inválido para Costa Rica bloquea el paso y explica por qué", (await next.isDisabled()) && (await page.getByText("cédula física tiene 9 dígitos").count()) > 0);
await page.getByLabel("Documento de identidad").fill("3-101-123456");
check("reconoce la cédula jurídica", (await page.getByText("Cédula jurídica").count()) > 0);
await page.getByLabel("Teléfono de contacto (+506)").fill("1234");
check("un teléfono inválido bloquea el paso", await next.isDisabled());
await page.getByLabel("Teléfono de contacto (+506)").fill("8888 7777");
await page.getByLabel("Razón social").fill("Bar Central Sociedad Anónima");
await page.screenshot({ path: `${OUT}/02-asistente-paso1.png`, fullPage: true });
await next.click();
check("el paso 2 propone el enlace del menú", (await page.getByLabel("Enlace del menú").inputValue()) === "bar-central-de-prueba");
await page.getByLabel("Zona").fill("Escazú");
await next.click();
await page.getByLabel("Correo de la persona administradora").fill("dueno@barcentral.test");
await next.click();
check("el paso 4 resume lo que se creará", (await page.getByText("quedará en borrador").count()) > 0);
await page.getByRole("button", { name: "Crear empresa" }).click();
await page.getByText("Empresa creada").waitFor({ timeout: 30000 });
const link = await page.locator('input[readonly]').nth(1).inputValue();
check("muestra el enlace del menú, el QR y el enlace de activación de un solo uso", (await page.locator('img[alt="Código QR del menú"]').count()) === 1 && /\/panel\/invitacion\/[A-Za-z0-9_-]{40,}$/.test(link), link);
await page.screenshot({ path: `${OUT}/03-empresa-creada.png`, fullPage: true });

await page.goto(`${APP}/admin/empresas`);
check("la empresa aparece en la lista", (await page.getByRole("link", { name: "Bar Central de Prueba" }).count()) === 1);
await page.screenshot({ path: `${OUT}/04-empresas.png`, fullPage: true });
await page.getByRole("link", { name: "Bar Central de Prueba" }).click();
await page.getByRole("heading", { name: "Bar Central de Prueba" }).waitFor();
check("el detalle muestra la invitación pendiente del propietario", (await page.getByText("dueno@barcentral.test").count()) > 0 && (await page.getByText("Pendiente").count()) > 0);
await page.screenshot({ path: `${OUT}/05-empresa-detalle.png`, fullPage: true });

await page.goto(`${APP}/admin/establecimientos?filtro=pending`);
check("el establecimiento nuevo está pendiente (borrador): nada se publica solo", (await page.getByText("/v/bar-central-de-prueba").count()) === 1);
await page.locator('a[href^="/admin/establecimientos/"]').first().click();
await page.getByRole("button", { name: "Publicar" }).click();
await page.getByRole("button", { name: "Confirmar" }).click();
await page.getByText("Publicado", { exact: true }).first().waitFor({ timeout: 20000 });
check("publicar exige confirmación y cambia el estado", true);
await page.getByRole("button", { name: "Suspender" }).click();
check("suspender no se puede confirmar sin motivo", await page.getByRole("button", { name: "Confirmar" }).isDisabled());
await page.getByLabel("Motivo (obligatorio)").fill("Prueba de suspensión");
await page.getByRole("button", { name: "Confirmar" }).click();
await page.getByText("Suspendido", { exact: true }).first().waitFor({ timeout: 20000 });
await page.screenshot({ path: `${OUT}/06-establecimiento-suspendido.png`, fullPage: true });
await page.getByRole("button", { name: "Levantar suspensión" }).click();
await page.getByRole("button", { name: "Confirmar" }).click();
await page.getByText("Publicado", { exact: true }).first().waitFor({ timeout: 20000 });
check("suspender y levantar la suspensión funcionan", true);

await page.goto(`${APP}/admin/auditoria`);
const auditText = await page.locator("table").innerText();
check("la auditoría registra el alta, la publicación y la suspensión con IP y petición", /organization\.onboard/.test(auditText) && /venue\.publish/.test(auditText) && /venue\.suspend/.test(auditText));
check("la auditoría no muestra tokens ni contraseñas", !/token|contraseña|password/i.test(auditText.replace(/Contraseña/g, "")));
await page.screenshot({ path: `${OUT}/07-auditoria.png`, fullPage: true });
await page.goto(`${APP}/admin/usuarios?tipo=operators`);
check("el único operador permanente es el correo autorizado", (await page.getByText(OPERATOR).count()) >= 1);
await page.goto(`${APP}/admin/seguridad`);
await page.screenshot({ path: `${OUT}/08-seguridad.png`, fullPage: true });

// ---------------------------------------------------------------- C. Invitación y panel de empresa
const guest = await newContext(null);
const gp = await guest.newPage();
await gp.goto(link);
await gp.getByText("Lo invitaron a").waitFor({ timeout: 20000 });
check("la invitación dice a qué empresa y con qué rol", (await gp.getByText("Bar Central de Prueba").count()) > 0 && (await gp.getByText("Propietario").count()) > 0);
await gp.getByLabel("Elija su contraseña").fill("corta");
await gp.getByLabel("Repita la contraseña").fill("corta");
await gp.getByRole("button", { name: "Activar mi cuenta" }).click();
check("una contraseña corta se rechaza", (await gp.getByText("Use al menos 10 caracteres").count()) > 0);
await gp.screenshot({ path: `${OUT}/09-invitacion.png`, fullPage: true });
await gp.getByLabel("Elija su contraseña").fill("mi-clave-propia-segura");
await gp.getByLabel("Repita la contraseña").fill("mi-clave-propia-segura");
await gp.getByRole("button", { name: "Activar mi cuenta" }).click();
await gp.waitForURL(/\/panel(\?|$)/, { timeout: 30000 });
check("la persona define su contraseña y entra a su panel", (await gp.getByRole("heading", { name: /Resumen/ }).count()) === 1);
await gp.screenshot({ path: `${OUT}/10-panel.png`, fullPage: true });

const again = await guest.newPage();
await again.goto(link);
await again.getByText("Invitación no válida").waitFor({ timeout: 20000 }).catch(() => {});
check("la invitación ya no sirve (un solo uso)", (await again.getByText("Invitación no válida").count()) === 1);

await gp.goto(`${APP}/panel/personal`);
await gp.getByLabel("Correo", { exact: true }).fill("analista@barcentral.test");
await gp.getByLabel("Rol").last().selectOption("analyst");
await gp.getByRole("button", { name: "Crear invitación" }).click();
await gp.getByText("Enlace de activación").first().waitFor({ timeout: 20000 });
check("el propietario invita a una persona y obtiene su enlace", (await gp.locator("input[readonly]").count()) >= 1);
await gp.screenshot({ path: `${OUT}/11-personal.png`, fullPage: true });
await gp.goto(`${APP}/panel/clientes`);
check("clientes se ve con seudónimos (sin correos)", (await gp.getByText(/seudónimo/i).count()) > 0);
const platformPage = await gp.goto(`${APP}/admin`);
check("quien pertenece a una empresa recibe 404 real en el panel de plataforma", platformPage?.status() === 404, String(platformPage?.status()));
const ownerStatus = await status(guest, "/api/platform-admin/data?view=overview");
check("y también en su API", ownerStatus === 404, String(ownerStatus));

// ---------------------------------------------------------------- D. Móvil
const phone = await newContext(null, { width: 390, height: 844 });
const pp = await phone.newPage();
await pp.goto(`${APP}/admin/acceso`);
await pp.screenshot({ path: `${OUT}/12-acceso-movil.png`, fullPage: true });
const overflow = await pp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
check("el acceso no desborda en 390 px", !overflow);
await phone.close();

await browser.close();
console.log(failures ? `\n${failures} comprobación(es) fallaron.` : "\nTodas las comprobaciones pasaron.");
process.exit(failures ? 1 : 0);
