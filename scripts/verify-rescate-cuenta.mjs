// C09: editar nombre y @usuario desde Cuenta (sesión de María contra el servidor de verificación local).
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { people } from "./local-shim/index.mjs";
import { sessionCookies } from "./local-shim/session.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const APP = process.env.ONZA_APP ?? "http://127.0.0.1:3100";
const SHIM = process.env.SHIM_URL ?? "http://127.0.0.1:54321";
const out = process.argv[2] ?? join(tmpdir(), "onza-capturas");
mkdirSync(out, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${detail}`}`);
};
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await ctx.addCookies(await sessionCookies(SHIM, people.maria.email));
  const page = await ctx.newPage();
  await page.goto(`${APP}/cuenta`);
  await page.getByRole("button", { name: "Editar perfil" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  check("Correo visible y de solo lectura en la hoja", await dialog.getByLabel("Correo").isDisabled().catch(() => false) || (await dialog.getByLabel("Correo").getAttribute("readonly")) !== null);
  await page.screenshot({ path: `${out}/cuenta-editar-390.png` });
  await dialog.getByLabel("Usuario").fill("sofiav");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await dialog.getByText("Ese @usuario ya existe").waitFor();
  check("@usuario de otra cuenta: rechazo visible en el campo", true);
  await dialog.getByLabel("Usuario").fill("ab");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await dialog.getByText(/3 a 20|letras/).first().waitFor();
  check("@usuario inválido: rechazo visible", true);
  await dialog.getByLabel("Nombre").fill("María José Solís");
  await dialog.getByLabel("Usuario").fill("@MariaJ");
  await dialog.getByLabel("Tu trago favorito (opcional)").fill("Negroni");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.reload();
  check("Nombre y @usuario guardados y visibles tras recargar", (await page.locator(".identity").innerText()).includes("María José Solís") && (await page.locator(".identity").innerText()).includes("@mariaj"));
  await page.getByRole("button", { name: "Editar perfil" }).click();
  check("Trago favorito (opcional) guardado y precargado al reabrir", (await page.getByRole("dialog").getByLabel("Tu trago favorito (opcional)").inputValue()) === "Negroni");
  await page.getByRole("dialog").getByLabel("Tu trago favorito (opcional)").fill("");
  await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.reload();
  await page.getByRole("button", { name: "Editar perfil" }).click();
  check("Vaciar el trago favorito lo quita (salteable)", (await page.getByRole("dialog").getByLabel("Tu trago favorito (opcional)").inputValue()) === "");
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${out}/cuenta-editada-390.png` });
} catch (e) {
  check("Recorrido sin excepciones", false, e.message.split("\n")[0]);
} finally {
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} comprobaciones`);
  process.exit(results.every(Boolean) ? 0 : 1);
}
