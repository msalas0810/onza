// Qué video carga cada acceso según el dispositivo (emulación en Chromium/WebKit de Playwright, no dispositivos físicos).
// Uso: ONZA_APP=http://127.0.0.1:3100 node scripts/verify-access-video.mjs [chromium|webkit]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pw = require("playwright");
const APP = process.env.ONZA_APP ?? "http://127.0.0.1:3100";
const engine = process.argv[2] ?? "chromium";
const browserType = pw[engine];
const launch =
  engine === "chromium" && process.env.PLAYWRIGHT_CHROMIUM
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM }
    : {};
const devices = {
  "iPhone 15": { ...pw.devices["iPhone 15"] },
  "iPad vertical": { ...pw.devices["iPad Pro 11"] },
  "iPad horizontal": { ...pw.devices["iPad Pro 11 landscape"] },
  "iPadOS como Mac": {
    viewport: { width: 1180, height: 820 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
    hasTouch: true,
    isMobile: false,
  },
  Escritorio: { viewport: { width: 1440, height: 900 } },
};
const expected = { "iPhone 15": "access-mobile.mp4" };
const results = [];
const browser = await browserType.launch(launch);
for (const path of ["/acceso", "/equipo/acceso"])
  for (const [name, device] of Object.entries(devices)) {
    if (engine === "webkit" && name !== "iPadOS como Mac") delete device.defaultBrowserType;
    const context = await browser.newContext(device);
    if (name === "iPadOS como Mac")
      await context.addInitScript(() => Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 }));
    const page = await context.newPage();
    const videos = [];
    page.on("request", (r) => r.url().endsWith(".mp4") && videos.push(r.url().split("/").pop()));
    await page.goto(`${APP}${path}`);
    await page.waitForTimeout(2500);
    const state = await page.evaluate(() => {
      const v = document.querySelector("video");
      const root = document.querySelector("[data-access-device]");
      return {
        device: root?.getAttribute("data-access-device"),
        muted: v?.muted,
        loop: v?.loop,
        inline: v?.playsInline,
        rate: v?.playbackRate,
        defaultRate: v?.defaultPlaybackRate,
        playing: v?.hasAttribute("data-playing"),
        logo: !!document.querySelector(".onza-logo-hero .onza-logo-dot"),
      };
    });
    const want = expected[name] ?? "access-horizontal.mp4";
    const unique = [...new Set(videos)];
    const ok = unique.length === 1 && unique[0] === want && state.muted && state.loop && state.inline && state.defaultRate === 0.75 && state.logo;
    results.push(ok);
    console.log(`${ok ? "✓" : "✗"} ${path} · ${name}: ${unique.join(",") || "(ninguno)"} · ${JSON.stringify(state)}`);
    await context.close();
  }
// Movimiento reducido: póster, sin descargar video.
const reduced = await browser.newContext({ ...pw.devices["iPhone 15"], reducedMotion: "reduce" });
const page = await reduced.newPage();
const videos = [];
page.on("request", (r) => r.url().endsWith(".mp4") && videos.push(r.url()));
await page.goto(`${APP}/acceso`);
await page.waitForTimeout(1500);
const reducedOk = videos.length === 0;
results.push(reducedOk);
console.log(`${reducedOk ? "✓" : "✗"} /acceso · movimiento reducido: sin video (${videos.length} solicitudes)`);
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} comprobaciones (${engine}, emulación)`);
process.exit(results.every(Boolean) ? 0 : 1);
