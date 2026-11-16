import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
const origin = "http://127.0.0.1:3000";
const results = [];
for (const route of ["/", "/checkout", "/login"]) {
  const response = await fetch(origin + route);
  const html = await response.text();
  const scripts = [
    ...new Set(
      [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
        .map((match) => match[1])
        .filter((path) => path.startsWith("/_next/static/")),
    ),
  ];
  let raw = 0,
    gzip = 0;
  for (const script of scripts) {
    const path =
      ".next/" + new URL(script, origin).pathname.slice("/_next/".length);
    const bytes = readFileSync(path);
    raw += bytes.length;
    gzip += gzipSync(bytes).length;
  }
  results.push({
    route,
    status: response.status,
    initial_script_files: scripts.length,
    raw_bytes: raw,
    gzip_bytes: gzip,
  });
}
const report = {
  mode: "production build; no Supabase configured; HTML-referenced initial JS only",
  limitations:
    "No connected catalog/staff/admin measurement, LCP/INP/CLS, network/device performance or image budget assertion.",
  routes: results,
};
writeFileSync(
  "docs/evidence/bundle-measurement.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
for (const [route, expected] of [
  ["/design-system", 404],
  ["/api/health", 200],
]) {
  const response = await fetch(origin + route);
  if (response.status !== expected)
    throw new Error(`${route}: expected ${expected}, got ${response.status}`);
  console.log(`${route}: ${response.status}`);
}
