// Tabla markdown «antes / después» a partir de dos reportes JSON de scripts/audit/load.mjs.
// Uso: node scripts/audit/compare-load.mjs antes.json despues.json [fase]
import { readFileSync } from "node:fs";
const [a, b, phase = "p2-sostenida"] = process.argv.slice(2);
const A = JSON.parse(readFileSync(a, "utf8"));
const B = JSON.parse(readFileSync(b, "utf8"));
const rows = (r) => Object.fromEntries(r.rows.map((x) => [x.label, x]));
const ra = rows(A), rb = rows(B);
const ops = ["checkout(create)", "accept", "ready", "resolve", "capture", "complete", "catalog.menu", "refetch.order_list(customer)", "refetch.order_list(venue)", "refetch.sweep", "report.summary_range(night)"];
console.log(`| Operación (${phase}) | n antes | p95 antes (ms) | espera de pool p95 antes (ms) | n después | p95 después (ms) | espera de pool p95 después (ms) |\n|---|---|---|---|---|---|---|`);
for (const op of ops) {
  const x = ra[`${phase}:${op}`], y = rb[`${phase}:${op}`];
  if (!x && !y) continue;
  console.log(`| ${op} | ${x?.n ?? "–"} | ${x?.p95 ?? "–"} | ${x?.waitP95 ?? "–"} | ${y?.n ?? "–"} | ${y?.p95 ?? "–"} | ${y?.waitP95 ?? "–"} |`);
}
const f = (r) => `CPU p50/p95/máx ${r.cpu.p50.toFixed(0)}/${r.cpu.p95.toFixed(0)}/${r.cpu.max.toFixed(0)}; pedidos creados ${r.finals.orders}, entregados ${r.finals.delivered}`;
console.log(`\nAntes: ${f(A)}\nDespués: ${f(B)}`);
