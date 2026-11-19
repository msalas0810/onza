// Corre todas las verificaciones del plan de pulido contra la app local, reiniciando el servidor de verificación (shim)
// entre grupos para empezar desde datos limpios. Requiere `next dev` apuntando al shim en ONZA_APP (por defecto :3100).
// Uso: ONZA_APP=http://127.0.0.1:3100 node scripts/verify-pulido-all.mjs
import { spawn } from "node:child_process";
import { startShim } from "./local-shim/index.mjs";
const groups = [
  ["verify-pulido-e1.mjs", "verify-pulido-e2.mjs", "verify-pulido-e3.mjs", "verify-pulido-e4.mjs", "verify-access-video.mjs"],
  ["verify-pulido-e5.mjs"],
  ["verify-pulido-e6.mjs"],
];
let failed = 0;
for (const group of groups) {
  const shim = await startShim({ port: 54321 });
  for (const script of group) {
    // Asíncrono: el shim vive en este proceso y tiene que seguir respondiendo mientras corre cada verificación.
    const run = await new Promise((resolve) => {
      const child = spawn(process.execPath, [new URL(script, import.meta.url).pathname], { env: process.env });
      let stdout = "";
      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stdout += `[stderr] ${chunk}`));
      child.on("close", (status) => resolve({ status, stdout }));
    });
    const summary = (run.stdout.match(/\d+\/\d+ comprobaciones.*/g) ?? ["sin resumen"]).at(-1);
    const bad = run.stdout.split("\n").filter((line) => line.startsWith("✗"));
    console.log(`${run.status === 0 ? "✓" : "✗"} ${script}: ${summary}`);
    for (const line of bad) console.log(`    ${line}`);
    if (!summary || summary === "sin resumen") console.log(run.stdout.slice(0, 600));
    if (run.status !== 0) failed++;
  }
  await shim.close();
}
process.exit(failed ? 1 : 0);
