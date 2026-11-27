// Sube .open-next/assets a Workers KV por la API de Cloudflare (sin imprimir credenciales).
// Uso: CLOUDFLARE_ACCOUNT_ID=… CF_KV_NAMESPACE_ID=… node scripts/cloudflare-upload-assets.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const ns = process.env.CF_KV_NAMESPACE_ID;
if (!account || !ns) throw new Error("Faltan CLOUDFLARE_ACCOUNT_ID o CF_KV_NAMESPACE_ID");
const root = ".open-next/assets";
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    statSync(p).isDirectory() ? walk(p) : files.push(p);
  }
})(root);
const entries = files.map((p) => ({ key: "/" + relative(root, p).split("\\").join("/"), value: readFileSync(p).toString("base64"), base64: true }));
const headers = { "Content-Type": "application/json" };
if (process.env.CLOUDFLARE_API_TOKEN) headers.Authorization = `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`;
for (let i = 0; i < entries.length; i += 50) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${ns}/bulk`, {
    method: "PUT", headers, body: JSON.stringify(entries.slice(i, i + 50)),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`KV bulk ${res.status}: ${JSON.stringify(json.errors)}`);
}
console.log(`Subidos ${entries.length} archivos a KV`);
