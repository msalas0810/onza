// A01/A03: en pantallas estrechas el badge «Próximamente» queda dentro de su botón y los controles principales siguen
// al alcance en pantalla baja. Uso: ONZA_APP=http://127.0.0.1:3100 node scripts/verify-rescate-acceso.mjs [carpeta-capturas]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const APP = process.env.ONZA_APP ?? "http://127.0.0.1:3100";
const out = process.argv[2] ?? join(tmpdir(), "onza-capturas");
mkdirSync(out, { recursive: true });
let failed = 0;
let total = 0;
const check = (name, ok, detail = "") => {
  total++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) failed++;
};
const browser = await chromium.launch();
for (const [width, height] of [[320, 568], [340, 640], [360, 740], [390, 844]]) {
  const ctx = await browser.newContext({ ...devices["iPhone 14"], viewport: { width, height }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(`${APP}/acceso`);
  await page.waitForTimeout(900);
  const report = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll(".auth-provider:disabled")];
    const email = [...document.querySelectorAll("summary, button")].find((e) => /Continuar con correo/.test(e.textContent));
    return {
      inside: buttons.map((b) => b.querySelector(".soon").getBoundingClientRect().right <= b.getBoundingClientRect().right - 8),
      emailTop: email ? email.getBoundingClientRect().top : null,
      emailBottom: email ? email.getBoundingClientRect().bottom : null,
      horizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  check(`${width}×${height}: «Próximamente» dentro de Google y Apple`, report.inside.length === 2 && report.inside.every(Boolean));
  check(`${width}×${height}: «Continuar con correo» visible sin desplazar`, report.emailBottom !== null && report.emailBottom <= height, `${report.emailBottom} > ${height}`);
  check(`${width}×${height}: sin scroll horizontal`, !report.horizontal);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.screenshot({ path: `${out}/acceso-${width}x${height}.png` });
  await ctx.close();
}
await browser.close();
console.log(`\n${total - failed}/${total} comprobaciones`);
process.exit(failed ? 1 : 0);
