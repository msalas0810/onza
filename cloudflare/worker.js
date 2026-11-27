// Envoltorio del worker de OpenNext: sirve los archivos estáticos (.open-next/assets) desde Workers KV.
// Existe porque la subida nativa de assets de `wrangler deploy` no funciona detrás del proxy de la sesión de CI/Claude.
// Con una cuenta normal se puede volver al binding `assets` estándar de wrangler y borrar este archivo.
import handler from "../.open-next/worker.js";
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "../.open-next/worker.js";

const TYPES = {
  js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8",
  json: "application/json", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  webp: "image/webp", gif: "image/gif", ico: "image/x-icon", woff2: "font/woff2", woff: "font/woff",
  txt: "text/plain; charset=utf-8", webmanifest: "application/manifest+json", mp3: "audio/mpeg", map: "application/json",
};

async function fromKV(env, request) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  let key;
  try { key = decodeURIComponent(new URL(request.url).pathname); } catch { return null; }
  if (key === "/" || key.endsWith("/")) return null;
  const body = await env.ASSETS_KV.get(key, "arrayBuffer");
  if (!body) return null;
  const ext = key.split(".").pop().toLowerCase();
  const immutable = key.startsWith("/_next/static/");
  return new Response(request.method === "HEAD" ? null : body, {
    headers: {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      "cache-control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const asset = await fromKV(env, request);
    if (asset) return asset;
    const shimmed = { ...env, ASSETS: { fetch: async (req) => (await fromKV(env, req)) ?? new Response("Not found", { status: 404 }) } };
    return handler.fetch(request, shimmed, ctx);
  },
};
