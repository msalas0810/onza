// Amigos y mapa de actividad, en navegador y con cuentas ficticias del shim (maria, sofia, tomas; ana = admin del equipo).
// Uso: shim recién iniciado + app apuntando a él (docs/Onza-Guia-tecnica.md):
//   ONZA_APP=http://127.0.0.1:3100 node scripts/verify-amigos-actividad.mjs [carpeta-capturas]
// El vencimiento con el reloj real se prueba en tests/db/social.test.ts (acá no se puede adelantar la hora del shim).
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
const shot = async (page, name) => {
  if (!OUT) return;
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
};
const text = async (page) => (await page.locator("main, body").first().innerText()).replace(/\s+/g, " ");
const social = async (page, body) => {
  const r = await page.request.post(`${APP}/api/social`, {
    headers: { origin: APP, "content-type": "application/json" },
    data: body,
  });
  return { status: r.status(), body: await r.json() };
};
const overview = async (page) => (await page.request.get(`${APP}/api/social`)).json();

try {
  const [maria, sofia, tomas, ana] = await Promise.all([
    open(people.maria.email),
    open(people.sofia.email),
    open(people.tomas.email),
    open(people.ana.email, 1280, 900),
  ]);

  /* 1 · Mapa de actividad sin actividad */
  await maria.goto(`${APP}/actividad`);
  await maria.getByText("Todavía no hay actividad visible").waitFor();
  check("Sin actividad, el mapa muestra un estado útil con la acción «Marcar que estoy acá»", (await maria.getByRole("link", { name: "Marcar que estoy acá" }).count()) === 1);
  await shot(maria, "s0-actividad-vacia-390");
  await maria.goto(`${APP}/actividad?ejemplo=1`);
  check("El ejemplo simulado está rotulado y usa lugares ficticios", (await text(maria)).includes("Simulado") && (await text(maria)).includes("Local simulado A"));
  await shot(maria, "s1-actividad-simulada-390");

  /* 2 · Solicitud por @usuario y aceptación */
  await maria.goto(`${APP}/amigos`);
  await maria.getByText("Todavía no tenés amigos en Onza").waitFor();
  check("Amigos arranca vacío y explica cómo invitar", true);
  await maria.getByLabel("@usuario de Onza").fill("@sofiav");
  await maria.getByRole("button", { name: "Enviar solicitud" }).click();
  await maria.getByText("Solicitud enviada a @sofiav.").waitFor();
  check("María envía una solicitud por @usuario", (await text(maria)).includes("Esperando respuesta: @sofiav"));
  const bad = await social(maria, { action: "friend_request", username: "nadie_existe" });
  check("Un @usuario inexistente da 404 con mensaje claro", bad.status === 404 && bad.body.error === "FRIEND_NOT_FOUND");
  const staff = await social(ana, { action: "checkin", venueId: PICNIC, minutes: 60 });
  check("Una cuenta del equipo no puede usar lo social", staff.status === 403 && staff.body.error === "STAFF_NOT_SOCIAL");

  await sofia.goto(`${APP}/amigos?agregar=mariasolis`);
  check("El enlace de invitación precarga el @usuario", (await sofia.getByLabel("@usuario de Onza").inputValue()) === "mariasolis");
  await sofia.getByRole("button", { name: "Aceptar" }).click();
  await sofia.getByText("@mariasolis ya es tu amigo.").waitFor();
  check("Sofía acepta la solicitud recibida", (await text(sofia)).includes("María"));

  /* 3 · Compartir: apagado por defecto, visible con vencimiento, se apaga al instante */
  await maria.goto(`${APP}/amigos?local=picnic`);
  const shareBox = maria.getByRole("switch", { name: "Que mis amigos vean este local" });
  check("Compartir arranca apagado", !(await shareBox.isChecked()));
  await maria.getByRole("button", { name: "1 h" }).click();
  await maria.getByRole("button", { name: "Estoy acá", exact: true }).click();
  await maria.getByText("Listo, contás para la actividad del local.").waitFor();
  check("María marca que está en Picnic, por 1 h", (await text(maria)).includes("Picnic") && (await text(maria)).includes("Hasta las"));
  let seen = await overview(sofia);
  check("Sin compartir, su amiga no ve el local", seen.friends[0]?.venue === null);
  await maria.getByRole("switch", { name: "Que mis amigos vean este local" }).click();
  await maria.getByText("Tus amigos ya lo ven.").waitFor();
  check("Al compartir, la pantalla dice hasta qué hora", /Tus amigos ven que estás acá hasta las/.test(await text(maria)));
  await shot(maria, "s2-amigos-compartiendo-390");
  await sofia.reload();
  await sofia.getByText(/Picnic, hasta las/).waitFor();
  check("Su amiga ve «Picnic, hasta las …»", true);
  await shot(sofia, "s3-amiga-ve-local-390");
  const outsider = JSON.stringify(await overview(tomas));
  check("Alguien fuera de la relación no ve nada de María", !outsider.includes("Picnic") && !outsider.includes("mariasolis"));
  await maria.getByRole("switch", { name: /Tus amigos ven/ }).click();
  await maria.getByText("Dejaste de compartir. Nadie lo ve desde ahora.").waitFor();
  seen = await overview(sofia);
  check("Dejar de compartir es inmediato", seen.friends[0]?.venue === null);

  /* 4 · Actividad con conteos pequeños y con actividad (coordenadas de prueba para Picnic, ficticio, solo en el shim) */
  const coords = await ana.request.post(`${APP}/api/commands`, {
    headers: { origin: APP, "content-type": "application/json" },
    data: { action: "venue_branding", venueId: PICNIC, latitude: 9.9333, longitude: -84.0833 },
  });
  check("(Preparación) coordenadas de prueba para el local ficticio Picnic", coords.ok(), String(coords.status()));
  await social(sofia, { action: "checkin", venueId: PICNIC, minutes: 60 });
  await maria.goto(`${APP}/actividad`);
  check("Con 2 personas (conteo chico) el local no aparece", (await text(maria)).includes("Todavía no hay actividad visible"));
  await social(tomas, { action: "checkin", venueId: PICNIC, minutes: 60 });
  await social(tomas, { action: "checkin", venueId: PICNIC, minutes: 60 }); // repetir no suma
  await maria.reload();
  const shown = await text(maria);
  check("Con 3 personas aparece Picnic con un nivel, sin números de personas", shown.includes("Picnic") && shown.includes("Algo de movimiento") && !/\b3 personas\b/.test(shown));
  await shot(maria, "s4-actividad-real-390");

  /* 5 · Salir y quitar amistad */
  await social(maria, { action: "checkout" });
  await maria.reload();
  check("Al salir María, vuelve a quedar por debajo del mínimo", (await text(maria)).includes("Todavía no hay actividad visible"));
  const sofiaView = await overview(sofia);
  const removed = await social(sofia, { action: "friend_remove", friendId: sofiaView.friends[0].id });
  check("Quitar la amistad corta la relación para los dos", removed.status === 200 && (await overview(maria)).friends.length === 0);
  check("Sin errores de página", errors.length === 0, errors.join(" | "));
} catch (error) {
  check("El recorrido terminó sin excepciones", false, String(error).split("\n")[0]);
} finally {
  await browser.close();
  if (OUT)
    writeFileSync(
      `${OUT}/verificacion-amigos.json`,
      JSON.stringify({ generado: new Date().toISOString(), total: results.length, fallos: results.filter((r) => !r.ok).length, resultados: results }, null, 2),
    );
  process.exitCode = results.every((r) => r.ok) ? 0 : 1;
}
