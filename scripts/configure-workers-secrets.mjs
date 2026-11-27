// Carga los secretos de un Worker desde .env.local. Los valores van a wrangler por stdin y nunca se imprimen.
// Requiere `npx wrangler login` (o CLOUDFLARE_API_TOKEN). Lo corre el dueño, no un agente.
// Uso: node scripts/configure-workers-secrets.mjs --env preview|production --origin https://… [--service-role]
// PICKUP_TOKEN_ENCRYPTION_KEY tiene que ser la MISMA que usa el despliegue actual: con otra, los tickets abiertos no se leen.
// --service-role habilita /api/team (PEN-014): es una decisión del dueño.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseEnv, parseArgs } from "node:util";
import { workerSecrets } from "./lib/worker-env.mjs";

const { values } = parseArgs({
  options: {
    env: { type: "string" },
    origin: { type: "string" },
    "service-role": { type: "boolean" },
  },
});
if (!["preview", "production"].includes(values.env))
  throw new Error("--env debe ser preview o production");
const local = parseEnv(readFileSync(".env.local", "utf8"));
if (
  local.NEXT_PUBLIC_SUPABASE_URL !== "https://ukdjuubekpanizcmppod.supabase.co"
)
  throw new Error(".env.local no apunta a onza-dev");
const secrets = workerSecrets(local, {
  origin: values.origin,
  serviceRole: values["service-role"],
});
for (const [key, value] of Object.entries(secrets)) {
  try {
    execFileSync(
      "npx",
      ["--no-install", "wrangler", "secret", "put", key, "--env", values.env],
      {
        input: value,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    console.log(`✓ ${key} (${values.env})`);
  } catch {
    throw new Error(
      `No se pudo cargar ${key}; no se muestra la respuesta para no exponer el valor`,
    );
  }
}
