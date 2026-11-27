// Build para Cloudflare Workers. Usar SIEMPRE este script (npm run cf:build), nunca `opennextjs-cloudflare build` solo:
// 1) compila con OpenNext; 2) saca del bundle las variables que no son NEXT_PUBLIC_*; 3) falla si queda algún secreto;
// 4) mide el Worker comprimido y falla si pasa el tope del plan Free.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  gzipKib,
  leakedSecretKeys,
  publicOnlyNextEnv,
  secretEntries,
} from "./lib/worker-env.mjs";

const FREE_PLAN_KIB = 3 * 1024;
const OUT = ".open-next";

// Ante cualquier error antes de terminar la revisión, no queda en disco un bundle que alguien pueda desplegar.
let checked = false;
process.on("exit", () => {
  if (!checked) rmSync(OUT, { recursive: true, force: true });
});

execFileSync("npx", ["--no-install", "opennextjs-cloudflare", "build"], {
  stdio: "inherit",
});

const envFile = join(OUT, "cloudflare", "next-env.mjs");
writeFileSync(envFile, publicOnlyNextEnv(readFileSync(envFile, "utf8")));

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : entry.isFile() ? [path] : [];
  });

// De la terminal (CI) solo los secretos de la app: hay tokens ajenos que no viajan en el bundle.
const fromShell = secretEntries(
  Object.entries(process.env)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n"),
).filter(({ key }) => /^(SUPABASE|PICKUP|DEMO|CLOUDFLARE)_/.test(key));
const secrets = [
  ...readdirSync(".")
    .filter(
      (name) => /^(\.env|\.dev\.vars)/.test(name) && name !== ".env.example",
    )
    .flatMap((name) => secretEntries(readFileSync(name, "utf8"))),
  ...fromShell,
];

const leaks = [];
for (const path of walk(OUT)) {
  if (/(^|\/)(\.env|\.dev\.vars)[^/]*$/.test(path)) {
    rmSync(path);
    continue;
  }
  const keys = leakedSecretKeys(readFileSync(path, "utf8"), secrets);
  if (keys.length) leaks.push(`${path}: ${[...new Set(keys)].join(", ")}`);
}
if (leaks.length) {
  console.error(
    `✗ Hay secretos dentro del bundle (se borró ${OUT}; no se imprimen los valores):\n${leaks.join("\n")}`,
  );
  process.exit(1);
}
if (!existsSync(join(OUT, "worker.js")))
  throw new Error("Falta .open-next/worker.js");
checked = true;
console.log(`✓ Bundle sin secretos (${secrets.length} valores buscados)`);

const size = gzipKib(
  execFileSync(
    "npx",
    ["--no-install", "wrangler", "deploy", "--dry-run", "--env", "preview"],
    { encoding: "utf8" },
  ),
);
console.log(
  `Worker comprimido: ${size} KiB de ${FREE_PLAN_KIB} KiB (plan Free)`,
);
if (size > FREE_PLAN_KIB) {
  console.error(
    "✗ El Worker no entra en el plan Free. No subir de plan sin aprobación del dueño.",
  );
  process.exit(1);
}
