// Busca exposición de secretos SIN imprimirlos: solo cuenta coincidencias y nombra archivos.
// 1) Patrones de claves en archivos versionados. 2) Los valores de secretos de .env.local (si existe) buscados dentro de los
// archivos versionados, el historial de git y el bundle público (.next/static, .next/server/app si existe).
// Uso: node scripts/audit/scan-secrets.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const run = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 28 });
const tracked = run("git", ["ls-files"]).split("\n").filter(Boolean).filter((f) => !/\.(png|jpe?g|webp|mp4|woff2?|ico|zip|gif)$/i.test(f));
let problems = 0;
const report = (name, ok, detail = "") => {
  if (!ok) problems++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${detail}`}`);
};

// 1) Patrones genéricos
const patterns = [
  ["JWT (eyJ…)", /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/],
  ["clave sb_secret_", /sb_secret_[A-Za-z0-9_-]{16,}/],
  ["clave privada PEM", /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["URL con credenciales", /postgres(ql)?:\/\/[^\s:@]+:[^\s@]+@/],
];
for (const [name, re] of patterns) {
  const hits = tracked.filter((f) => {
    try { return re.test(readFileSync(f, "utf8")); } catch { return false; }
  });
  // Los JWT de ejemplo del shim local (role anon/service ficticios) no tienen forma de JWT real; si aparece uno se lista.
  report(`Patrón ${name} en archivos versionados`, hits.length === 0, hits.join(", "));
}

// 2) Valores reales de .env.local
const secrets = [];
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const [, key, raw] = m;
    const value = raw.replace(/^['"]|['"]$/g, "");
    if (/SERVICE_ROLE|PASSWORD|ENCRYPTION_KEY|SECRET|TOKEN/.test(key) && value.length >= 8) secrets.push({ key, value });
  }
}
console.log(`  (${secrets.length} valores secretos de .env.local cargados en memoria para la búsqueda; no se imprimen)`);
const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (st.size < 8 << 20) out.push(p);
  }
  return out;
};
const publicBundle = [...walk(".next/static"), ...walk(".next/server/app")].filter((f) => /\.(js|css|html|json|rsc|txt|map)$/.test(f));
const history = secrets.length ? run("git", ["log", "--all", "-p", "--no-color", "--format="]) : "";
for (const { key, value } of secrets) {
  const inTracked = tracked.filter((f) => { try { return readFileSync(f, "utf8").includes(value); } catch { return false; } });
  const inBundle = publicBundle.filter((f) => { try { return readFileSync(f, "utf8").includes(value); } catch { return false; } });
  const inHistory = history.includes(value);
  report(`${key}: ausente en archivos versionados, historial y bundle público`, !inTracked.length && !inBundle.length && !inHistory, `versionados=${inTracked.length} bundle=${inBundle.length} historial=${inHistory}`);
}
console.log(`  (bundle público revisado: ${publicBundle.length} archivos${publicBundle.length ? "" : " — corré `npm run build` antes para incluirlo"})`);
// 3) Variables NEXT_PUBLIC_
const publicVars = new Set();
for (const f of tracked.filter((x) => /^(src|scripts|next\.config)/.test(x))) {
  try { for (const m of readFileSync(f, "utf8").matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) publicVars.add(m[0]); } catch { /* binario */ }
}
const allowed = new Set(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);
const unexpected = [...publicVars].filter((v) => !allowed.has(v));
report("Solo URL y clave publicable de Supabase son NEXT_PUBLIC_*", unexpected.length === 0, unexpected.join(", "));
const leaked = tracked.filter((f) => /^src\//.test(f)).filter((f) => { try { return /NEXT_PUBLIC_[A-Z_]*(SERVICE|SECRET|PASSWORD|PRIVATE)/.test(readFileSync(f, "utf8")); } catch { return false; } });
report("Ninguna variable NEXT_PUBLIC_ nombra service/secret/password", leaked.length === 0, leaked.join(", "));
const ignored = run("git", ["check-ignore", ".env.local"]).trim();
report(".env.local está ignorado por git", ignored === ".env.local");
process.exit(problems ? 1 : 0);
