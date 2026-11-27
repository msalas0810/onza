// Run via npm exec --package=vercel -- node scripts/configure-vercel-env.mjs [https://origin] [preview|production]
// CLI receives secret values only through stdin; output and error details are withheld.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const link = JSON.parse(readFileSync(".vercel/project.json", "utf8"));
if (
  link.projectId !== "prj_ESobIM57nGYOpNXDhqMAo8Y163md" ||
  link.orgId !== "team_0TPT2W9rhCAZ8hlVnEHmo5ve"
)
  throw new Error("Vercel project mismatch");
const local = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
if (
  local.NEXT_PUBLIC_SUPABASE_URL !== "https://ukdjuubekpanizcmppod.supabase.co"
)
  throw new Error("Supabase project mismatch");
const origin = process.argv[2] ?? "https://onza-demo-msalas0810.vercel.app";
if (!/^https:\/\/[a-z0-9.-]+\.vercel\.app$/.test(origin))
  throw new Error("Expected HTTPS Vercel origin");
const target = process.argv[3] ?? "preview";
if (!["preview", "production"].includes(target))
  throw new Error("Expected preview or production");
// Sin SUPABASE_SERVICE_ROLE_KEY a propósito: el demo publicado no la usa (solo /api/team la necesitaría).
const values = {
  NEXT_PUBLIC_SUPABASE_URL: local.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  DEMO_MODE: "true",
  PAYMENT_PROVIDER: "mock",
  REAL_PAYMENTS_ENABLED: "false",
  PICKUP_TOKEN_ENCRYPTION_KEY: local.PICKUP_TOKEN_ENCRYPTION_KEY,
  PICKUP_TOKEN_KEY_VERSION: local.PICKUP_TOKEN_KEY_VERSION ?? "1",
  ENABLE_DESIGN_SYSTEM: "false",
  ACCOUNTS_REQUIRED: "true",
  ENABLE_PAYMENT_SCENARIOS: "false",
  APP_ORIGIN: origin,
};
for (const [key, value] of Object.entries(values)) {
  if (!value) throw new Error(`Missing ${key}`);
  try {
    execFileSync(
      "vercel",
      [
        "env",
        "add",
        key,
        "--environment",
        target,
        ...(target === "preview"
          ? ["--git-branch", "fix/hosted-integration"]
          : []),
        "--yes",
        "--force",
        "--scope",
        "msalas0810s-projects",
      ],
      { input: value, stdio: ["pipe", "pipe", "pipe"] },
    );
    console.log(`Configured ${key} (${target})`);
  } catch {
    throw new Error(
      `Failed configuring ${key}; response withheld to protect credentials`,
    );
  }
}
