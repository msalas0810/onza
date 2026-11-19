// «Tus locales» (T01–T02): fixture con nombres largos y estados distintos, capturas a 320/360/390/1440 y comprobaciones
// de reflow (sin scroll horizontal, acciones que no cruzan el bloque superior, texto sin recortar).
// Uso: ONZA_APP=http://127.0.0.1:3100 node scripts/verify-tus-locales.mjs <carpeta-de-capturas> [prefijo]
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
const KEY = "local-shim-service-role";
const [out = join(tmpdir(), "onza-capturas"), prefix = "tus-locales"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const sql = (text) =>
  fetch(`${SHIM}/__fixture/sql`, { method: "POST", headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" }, body: JSON.stringify({ sql: text }) }).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
  });
// Estados distintos: Apotecario abierto, Wilk Craft Beer pausado, Otro Bar cerrado, Stiefel abierto, Mil948 abierto.
await sql(`
  update public.venues set paused = true where slug = 'wilk';
  insert into public.memberships(user_id, venue_id, role)
    select '${people.ana.id}', id, 'admin' from public.venues where slug in ('apotecario','wilk','otro-bar')
    on conflict do nothing;
  insert into public.memberships(user_id, venue_id, role)
    select '${people.jorge.id}', id, 'bartender' from public.venues where slug in ('apotecario','wilk','otro-bar')
    on conflict do nothing;
`);

const browser = await chromium.launch();
let failed = 0;
let total = 0;
const check = (name, ok, detail = "") => {
  total++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) failed++;
};
for (const [who, label] of [["ana", "admin"], ["jorge", "bartender"]]) {
  const ctx0 = await browser.newContext();
  const cookies = await sessionCookies(SHIM, people[who].email);
  await ctx0.close();
  for (const [width, height] of [[320, 700], [360, 780], [390, 844], [1440, 900]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
    await ctx.addCookies(cookies);
    const page = await ctx.newPage();
    // Con varios locales el selector se muestra; el destino directo `/equipo/locales` evita la redirección por rol.
    await page.goto(`${APP}/equipo/locales`);
    await page.waitForSelector(".venue-pick");
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await page.screenshot({ path: `${out}/${prefix}-${label}-${width}.png`, fullPage: true });
    const report = await page.evaluate(() => {
      const doc = document.documentElement;
      const rect = (el) => el.getBoundingClientRect();
      const cards = [...document.querySelectorAll(".venue-pick")].map((card) => {
        const body = card.querySelector(".venue-pick-body");
        const info = body.querySelector("[data-venue-info]") ?? body.firstElementChild;
        const actions = [...body.querySelectorAll("a")];
        const badges = [...info.querySelectorAll(".badge, [class*=badge]")];
        const overlap = actions.some((a) => badges.concat([info.querySelector("strong")]).some((b) => {
          const x = rect(a), y = rect(b);
          return x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top;
        }));
        const clipped = [...body.querySelectorAll("strong, a, .badge")].some((el) => el.scrollWidth > el.clientWidth + 1);
        const offscreen = actions.some((a) => rect(a).right > doc.clientWidth + 0.5 || rect(a).left < -0.5);
        return { name: card.querySelector("strong")?.textContent, role: card.querySelector(".venue-pick-body")?.innerText ?? "", overlap, clipped, offscreen, actions: actions.map((a) => a.textContent.trim()), below: actions.every((a) => rect(a).top >= rect(info).bottom - 1) };
      });
      return { scrollX: doc.scrollWidth > doc.clientWidth, cards };
    });
    check(`${label} ${width}px: sin scroll horizontal`, !report.scrollX);
    for (const c of report.cards) {
      check(`${label} ${width}px · ${c.name}: acciones sin cruzar nombre ni badges`, !c.overlap);
      check(`${label} ${width}px · ${c.name}: nada recortado ni fuera de pantalla`, !c.clipped && !c.offscreen);
      const expected = /Administrador|Administradora|Admin/.test(c.role) ? ["Administrar", "Abrir barra"] : ["Abrir barra"];
      check(`${label} ${width}px · ${c.name}: acciones por rol (${expected.join(" + ")})`, JSON.stringify(c.actions) === JSON.stringify(expected), c.actions.join(","));
      if (width < 600) check(`${label} ${width}px · ${c.name}: acciones debajo del bloque superior`, c.below);
    }
    await ctx.close();
  }
}
await browser.close();
console.log(`\n${total - failed}/${total} comprobaciones`);
process.exit(failed ? 1 : 0);
