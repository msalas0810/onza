// Hosted setup: captures CLI API keys privately; never prints them.
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const ref = "ukdjuubekpanizcmppod";
if (existsSync(".env.local"))
  throw new Error(".env.local exists; refusing to overwrite secrets.");
const raw = execFileSync(
  "supabase",
  ["projects", "list", "--output-format", "json"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);
const projects = JSON.parse(raw).projects;
if (
  !projects?.some(
    (p) =>
      p.ref === ref &&
      p.name === "onza-dev" &&
      p.organization_id === "uczkkbsouopgwhqpvzyw",
  )
)
  throw new Error("Project identity mismatch.");
let keys;
try {
  const data = JSON.parse(
    execFileSync(
      "supabase",
      [
        "projects",
        "api-keys",
        `--remote=${ref}`,
        "--reveal",
        "--output",
        "json",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ),
  );
  keys = Array.isArray(data)
    ? data
    : (data.api_keys ?? data.keys ?? data.result);
} catch {
  throw new Error(
    "Cannot retrieve API keys; use the dashboard to fill .env.local privately.",
  );
}
if (!Array.isArray(keys))
  throw new Error("Unexpected key response; no secrets printed or saved.");
const publishable =
  keys.find((k) => k.type === "publishable") ??
  keys.find((k) => k.name === "anon");
const privileged =
  keys.find((k) => k.name === "service_role") ??
  keys.find((k) => k.type === "secret");
const value = (k) => k?.api_key ?? k?.key;
if (!value(publishable) || !value(privileged))
  throw new Error("Required API keys not available; no secrets printed.");
const env = {
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: value(publishable),
  SUPABASE_SERVICE_ROLE_KEY: value(privileged),
  APP_ORIGIN: "http://127.0.0.1:3000",
  DEMO_MODE: "true",
  PAYMENT_PROVIDER: "mock",
  REAL_PAYMENTS_ENABLED: "false",
  PICKUP_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  PICKUP_TOKEN_KEY_VERSION: "1",
  E2E_LIVE: "true",
  ENABLE_DESIGN_SYSTEM: "false",
};
for (const role of ["BARTENDER", "BARTENDER_2", "ADMIN", "ONZA"]) {
  env[`DEMO_${role}_EMAIL`] =
    `${role.toLowerCase().replaceAll("_", "")}@onza.test`;
  env[`DEMO_${role}_PASSWORD`] = randomBytes(24).toString("base64url");
}
writeFileSync(
  ".env.local",
  Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n",
  { flag: "wx", mode: 0o600 },
);
console.log("Hosted environment saved securely; no credentials printed.");
