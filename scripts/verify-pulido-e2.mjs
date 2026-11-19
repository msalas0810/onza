// Plan de pulido · Entrega 2. Accesos, Explorar, cabecera, pedidos y cuenta contra la app local (shim). No es Supabase:
// cualquier contraseña entra; no prueba correo real ni OAuth.
// Uso: ONZA_APP=http://127.0.0.1:3100 node scripts/verify-pulido-e2.mjs
import { createRequire } from "node:module";
import { people } from "./local-shim/index.mjs";
import { sessionCookies } from "./local-shim/session.mjs";
import { stableId } from "./lib/real-venues-seed.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const APP = process.env.ONZA_APP ?? "http://127.0.0.1:3100";
const SHIM = process.env.SHIM_URL ?? "http://127.0.0.1:54321";
const results = [];
const errors = [];
const check = (name, ok, detail = "") => {
  results.push(!!ok);
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
async function open(email, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: "reduce" });
  if (email) await context.addCookies(await sessionCookies(SHIM, email));
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return page;
}
try {
  const anon = await open(null);
  await anon.goto(`${APP}/acceso?next=${encodeURIComponent("/v/mil948")}`);
  const google = anon.getByRole("button", { name: /Continuar con Google/ });
  const apple = anon.getByRole("button", { name: /Continuar con Apple/ });
  check("Google y Apple siguen deshabilitados con «Próximamente»",
    (await google.isDisabled()) && (await apple.isDisabled()) && (await anon.getByText("Próximamente").count()) === 2);
  check("El lockup del acceso tiene vasito y punto rojo", (await anon.locator(".onza-logo-hero .onza-logo-dot").count()) === 1);
  await anon.getByText("Continuar con correo").click();
  check("Correo abre el formulario sin tabs Ingresar/Crear cuenta",
    (await anon.getByRole("group", { name: "Modo de acceso" }).count()) === 0 &&
      (await anon.getByLabel("Correo").isVisible()) && (await anon.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).isVisible()));
  await anon.getByRole("button", { name: "Creá una" }).click();
  check("«¿No tenés cuenta? Creá una» pasa al alta con confirmación de contraseña",
    (await anon.getByLabel("Confirmá la contraseña").isVisible()) && (await anon.getByRole("button", { name: "Crear cuenta" }).isVisible()));
  await anon.getByRole("button", { name: "Ingresá" }).click();
  check("«¿Ya tenés cuenta? Ingresá» vuelve al ingreso", (await anon.getByLabel("Confirmá la contraseña").count()) === 0);
  const fill = await anon.getByLabel("Correo").evaluate((el) => getComputedStyle(el).backdropFilter);
  check("Campos de vidrio con desenfoque", /blur/.test(fill), fill);
  await anon.getByLabel("Correo").fill(people.maria.email);
  await anon.getByLabel("Contraseña").fill("cualquiera-largo-1");
  await anon.getByRole("button", { name: "Ingresar" }).click();
  await anon.waitForURL(/\/v\/mil948/, { timeout: 15000 });
  check("Ingreso por correo conserva el destino (next)", anon.url().endsWith("/v/mil948"));
  check("En el menú del local no hay icono de carrito duplicado en la cabecera ni chip de demo",
    (await anon.locator(".hdr .icon-btn").count()) === 0 && (await anon.getByText("Demo · sin dinero real").count()) === 0);
  check("Cabecera con el lockup compacto (vasito + punto)", (await anon.locator(".hdr .onza-logo-header .onza-logo-dot").count()) === 1);

  const anon2 = await open(null);
  await anon2.goto(`${APP}/acceso`);
  await anon2.getByRole("link", { name: /¿Sos personal\?/ }).click();
  await anon2.waitForURL(/\/equipo\/acceso/);
  check("«¿Sos personal?» lleva al acceso del equipo", anon2.url().includes("/equipo/acceso"));
  await anon2.locator(".onza-logo-hero .onza-logo-dot").waitFor();
  check("El acceso del equipo usa el mismo lockup con vasito y punto", (await anon2.locator(".onza-logo-hero .onza-logo-dot").count()) === 1);
  await anon2.getByLabel("Correo del trabajo").fill(people.jorge.email);
  await anon2.getByLabel("Contraseña").fill("cualquiera-largo-1");
  await anon2.getByRole("button", { name: "Ingresar" }).click();
  await anon2.waitForURL(/\/staff\//, { timeout: 15000 });
  check("Ingreso laboral entra directo a la barra de su único local", anon2.url().endsWith(stableId("onza-real-venue", "mil948")));
  const anon3 = await open(null);
  await anon3.goto(`${APP}/acceso`);
  check("Enlaces legales presentes", (await anon3.getByRole("link", { name: "condiciones" }).getAttribute("href")) === "/policies");

  // Explorar: sugerencias sin cambiar la cuadrícula hasta elegir.
  const maria = await open(people.maria.email);
  await maria.goto(`${APP}/`);
  const cards = () => maria.locator(".explore-grid .vcard").count();
  const before = await cards();
  const box = maria.getByRole("combobox", { name: /Buscar local/ });
  await box.fill("otoya");
  await maria.getByRole("listbox").waitFor();
  const options = await maria.getByRole("option").allInnerTexts();
  check("Sugerencias debajo del buscador al escribir", options.some((o) => o.includes("Barrio Otoya")), options.join(" | "));
  check("La cuadrícula no cambia mientras se escribe", (await cards()) === before, `${before}`);
  await box.press("ArrowDown");
  await box.press("Enter");
  await maria.waitForTimeout(300);
  check("Elegir la sugerencia con teclado filtra la cuadrícula", (await cards()) === 1);
  await box.press("Escape");
  check("Escape con la lista cerrada limpia la búsqueda", (await box.inputValue()) === "" && (await cards()) === before);
  await box.fill("zzzz");
  check("Estado sin coincidencias", (await maria.getByText(/Sin coincidencias/).count()) === 1);
  await maria.getByRole("button", { name: "Limpiar búsqueda" }).click();
  check("Limpiar vacía el buscador", (await box.inputValue()) === "");
  check("Horario sin espacios internos en a.m./p.m.", !/[ap]\. m\./.test(await maria.locator(".explore-grid").innerText()));
  check("Cerrados al final, atenuados, sin badge duplicado y sin enlace",
    (await maria.locator(".vrow.closed .badge").count()) === 0 && (await maria.locator("a.vrow, .vrow a").count()) === 0);
  check("Sin banner repetido «Sin ubicación»; línea contextual", (await maria.getByText("Sin ubicación").count()) === 0 && (await maria.getByText("Podés buscar por barrio o local.").count()) === 1);
  check("Sin pie de demo en Explorar", (await maria.getByText(/son de demostración/).count()) === 0);

  await maria.goto(`${APP}/cuenta`);
  await maria.locator(".identity .avatar").waitFor();
  console.log("  identidad:", JSON.stringify(await maria.locator(".identity").innerText()));
  check("Cuenta: avatar con iniciales, editar y correo fuera de la identidad",
    (await maria.locator(".identity .avatar").innerText()).trim() === "MS" &&
      (await maria.getByRole("button", { name: "Editar foto de perfil" }).count()) === 1 &&
      !(await maria.locator(".identity").innerText()).includes("@correo.demo"));
  await maria.getByRole("button", { name: "Oscuro" }).click();
  check("Tema oscuro se aplica desde Cuenta", (await maria.evaluate(() => document.documentElement.dataset.theme)) === "dark");
  await maria.getByRole("button", { name: "Sistema" }).click();
  await maria.getByRole("button", { name: "Editar foto de perfil" }).click();
  check("Ajustes de avatar con vista previa y selector de archivo", (await maria.getByRole("button", { name: /Elegir foto/ }).count()) === 1);
} catch (e) {
  check("Recorrido sin excepciones", false, e.message.split("\n")[0]);
} finally {
  check("Sin errores de página", errors.length === 0, errors.join(" | "));
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} comprobaciones`);
  process.exit(results.every(Boolean) ? 0 : 1);
}
