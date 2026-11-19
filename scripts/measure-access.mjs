// Medición de /acceso y /equipo/acceso por dispositivo (solicitudes, bytes y MP4 descargados) y JavaScript inicial
// de rutas, contra un build de producción (`next start`). Uso: ONZA_APP=http://127.0.0.1:3200 node scripts/measure-access.mjs [salida.json]
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const APP = process.env.ONZA_APP ?? "http://127.0.0.1:3200";
const profiles = {
  "iPhone 14": devices["iPhone 14"],
  "iPad vertical": devices["iPad (gen 7)"],
  "iPad horizontal": devices["iPad (gen 7) landscape"],
  "Escritorio 1440": { viewport: { width: 1440, height: 900 } },
};
const browser = await chromium.launch();
const access = [];
for (const route of ["/acceso", "/equipo/acceso"]) {
  for (const [name, options] of Object.entries(profiles)) {
    const ctx = await browser.newContext(options);
    const page = await ctx.newPage();
    const seen = [];
    // `request` (no `requestfinished`): el MP4 puede seguir bajando al terminar la espera; se mide lo recibido.
    const pending = [];
    page.on("request", (request) =>
      pending.push(
        request.response().then(async (response) => {
          const body = response ? await response.body().then((b) => b.length).catch(() => 0) : 0;
          seen.push({ url: new URL(request.url()).pathname, type: request.resourceType(), bytes: body });
        }).catch(() => undefined),
      ),
    );
    await page.goto(APP + route, { waitUntil: "load" });
    await page.waitForTimeout(6000);
    await Promise.allSettled(pending);
    const videos = seen.filter((r) => r.url.endsWith(".mp4"));
    access.push({
      route,
      device: name,
      requests: seen.length,
      total_kb: Math.round(seen.reduce((sum, r) => sum + r.bytes, 0) / 1024),
      mp4_files: [...new Set(videos.map((v) => v.url))],
      mp4_transferred_kb: Math.round(videos.reduce((sum, r) => sum + r.bytes, 0) / 1024),
    });
    await ctx.close();
  }
}
await browser.close();

// JavaScript inicial referenciado por el HTML de rutas públicas (las autenticadas redirigen sin sesión).
const scriptsOf = async (route) => {
  const html = await (await fetch(APP + route)).text();
  const files = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]).filter((p) => p.startsWith("/_next/static/")))];
  let raw = 0, gzip = 0;
  for (const file of files) {
    const bytes = readFileSync(".next/" + decodeURIComponent(file).slice("/_next/".length));
    raw += bytes.length;
    gzip += gzipSync(bytes).length;
  }
  return { route, script_files: files.length, raw_kb: Math.round(raw / 1024), gzip_kb: Math.round(gzip / 1024) };
};
const js = [];
for (const route of ["/acceso", "/equipo/acceso", "/login"]) js.push(await scriptsOf(route));
const report = { environment: "next build + next start local, Chromium emulado, servidor de verificación local; sin red limitada", access, js };
writeFileSync(process.argv[2] ?? "medicion-acceso.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
