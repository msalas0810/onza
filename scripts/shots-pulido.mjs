// Capturas de revisión visual del plan de pulido contra la app local (shim). Uso:
// ONZA_APP=http://127.0.0.1:3100 node scripts/shots-pulido.mjs <carpeta> [ancho] [esquema] [rutas separadas por coma]
import { createRequire } from "node:module";
import { people } from "./local-shim/index.mjs";
import { sessionCookies } from "./local-shim/session.mjs";
import { stableId } from "./lib/real-venues-seed.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const APP = process.env.ONZA_APP ?? "http://127.0.0.1:3100";
const SHIM = process.env.SHIM_URL ?? "http://127.0.0.1:54321";
const [out, width = "390", scheme = "light", list] = process.argv.slice(2);
const mil = stableId("onza-real-venue", "mil948");
const routes = (list ?? "acceso,equipo,explorar,menu,cart,checkout,orders,cuenta,barra,admin").split(",");
const map = {
  acceso: [null, "/acceso"],
  "acceso-correo": [null, "/acceso"],
  "acceso-alta": [null, "/acceso"],
  equipo: [null, "/equipo/acceso"],
  explorar: ["maria", "/"],
  menu: ["maria", "/v/mil948"],
  cart: ["maria", "/cart"],
  checkout: ["maria", "/checkout"],
  orders: ["maria", "/orders"],
  cuenta: ["maria", "/cuenta"],
  barra: ["jorge", `/staff/${mil}`],
  admin: ["ana", `/admin/${mil}?tab=menu`],
  resumen: ["ana", `/admin/${mil}?tab=resumen`],
  negocio: ["ana", `/admin/${mil}?tab=negocio`],
  pedidos: ["ana", `/admin/${mil}?tab=pedidos`],
  disponibilidad: ["ana", `/admin/${mil}?tab=disponibilidad`],
  equipoadmin: ["ana", `/admin/${mil}?tab=equipo`],
};
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
const contexts = {};
async function page(who) {
  const key = who ?? "anon";
  if (!contexts[key]) {
    const ctx = await browser.newContext({ viewport: { width: Number(width), height: 844 }, colorScheme: scheme, reducedMotion: "reduce" });
    if (who) await ctx.addCookies(await sessionCookies(SHIM, people[who].email));
    contexts[key] = ctx;
    if (who === "maria") {
      const p = await ctx.newPage();
      await p.goto(`${APP}/v/mil948`);
      for (const n of ["Margarita", "Negroni"])
        await p.locator("article.prow", { hasText: n }).getByRole("button", { name: "Agregar", exact: true }).click().catch(() => {});
      await p.close();
    }
  }
  return contexts[key].newPage();
}
for (const name of routes) {
  const [who, path] = map[name];
  const p = await page(who);
  await p.goto(`${APP}${path}`);
  await p.waitForTimeout(1200);
  if (name.startsWith("acceso-")) await p.getByText("Continuar con correo").click();
  if (name === "acceso-alta") await p.getByRole("button", { name: "Creá una" }).click();
  if (name.startsWith("acceso-")) await p.waitForTimeout(400);
  await p.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await p.screenshot({ path: `${out}/${name}-${width}-${scheme}.png`, fullPage: true });
  await p.close();
  console.log("ok", name);
}
await browser.close();
