// Reads ONLY the local Supabase CLI. Never prints keys or passwords.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
if (existsSync(".env.local"))
  throw new Error(
    ".env.local ya existe. No se sobreescribe; configurá manualmente.",
  );
const status = JSON.parse(
  execFileSync("supabase", ["status", "--output", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }),
);
const values = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    status.PUBLISHABLE_KEY ?? status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  APP_ORIGIN: "http://127.0.0.1:3000",
  DEMO_MODE: "true",
  PAYMENT_PROVIDER: "mock",
  REAL_PAYMENTS_ENABLED: "false",
  PICKUP_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  PICKUP_TOKEN_KEY_VERSION: "1",
  DEMO_BARTENDER_EMAIL: "bartender@onza.test",
  DEMO_BARTENDER_PASSWORD: randomBytes(24).toString("base64url"),
  DEMO_BARTENDER_2_EMAIL: "bartender2@onza.test",
  DEMO_BARTENDER_2_PASSWORD: randomBytes(24).toString("base64url"),
  DEMO_ADMIN_EMAIL: "admin@onza.test",
  DEMO_ADMIN_PASSWORD: randomBytes(24).toString("base64url"),
  DEMO_ONZA_EMAIL: "onza@onza.test",
  DEMO_ONZA_PASSWORD: randomBytes(24).toString("base64url"),
  E2E_LIVE: "true",
};
if (
  !values.NEXT_PUBLIC_SUPABASE_URL ||
  !values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  !values.SUPABASE_SERVICE_ROLE_KEY
)
  throw new Error("Faltan las claves del Supabase LOCAL.");
writeFileSync(
  ".env.local",
  Object.entries(values)
    .map(([name, value]) => `${name}=${value}`)
    .join("\n") + "\n",
  { flag: "wx", mode: 0o600 },
);
console.log(
  "Se creó .env.local con credenciales demo aleatorias. No lo compartás ni lo agregués a Git.",
);
