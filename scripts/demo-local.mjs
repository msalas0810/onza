// Demo local en un comando, sin Docker ni Supabase: el servidor de verificación (scripts/local-shim: migraciones reales sobre
// PGlite, datos ficticios y pagos simulados) + `next dev` apuntando a él. Datos limpios en cada arranque.
// Uso: npm run demo:local   (opcional: PORT=3200 SHIM_PORT=54322 npm run demo:local)
// NO es Supabase: sin Realtime (la app refresca por consulta), Storage mínimo y cualquier contraseña entra.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";

const APP_PORT = Number(process.env.PORT ?? 3100);
const SHIM_PORT = Number(process.env.SHIM_PORT ?? 54321);
const children = [];
const fail = (message) => {
  console.error(`\n✗ ${message}\n`);
  for (const child of children) child.kill("SIGTERM"); // sin procesos huérfanos
  process.exit(1);
};
if (!existsSync("node_modules/next") || !existsSync("node_modules/@electric-sql/pglite"))
  fail("Faltan dependencias. Corré `npm ci` (Node 24, ver .nvmrc) y volvé a intentar.");
const free = (port) =>
  new Promise((resolve) => {
    const server = net.createServer().once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
for (const [port, what] of [
  [SHIM_PORT, "el servidor de verificación"],
  [APP_PORT, "la app"],
])
  if (!(await free(port)))
    fail(
      `El puerto ${port} (${what}) ya está en uso: ¿otro demo o \`next dev\` abierto? Cerralo, o elegí otros puertos:\n  PORT=3200 SHIM_PORT=54322 npm run demo:local`,
    );

const run = (command, args, env) => {
  const child = spawn(command, args, { stdio: ["ignore", "inherit", "inherit"], env: { ...process.env, ...env } });
  children.push(child);
  child.on("exit", (code) => {
    if (code)
      fail(
        `${args[0]} terminó con código ${code}. Next permite un solo \`next dev\` por carpeta: si hay otro abierto, cerralo.`,
      );
  });
  return child;
};
const stop = () => {
  for (const child of children) child.kill("SIGTERM");
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

run(process.execPath, ["scripts/local-shim/index.mjs"], { SHIM_PORT: String(SHIM_PORT) });
for (let i = 0; i < 60 && (await free(SHIM_PORT)); i++) await new Promise((r) => setTimeout(r, 500));
const APP = `http://127.0.0.1:${APP_PORT}`;
run(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "-p", String(APP_PORT)], {
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${SHIM_PORT}`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-shim-publishable",
  SUPABASE_SERVICE_ROLE_KEY: "local-shim-service-role",
  APP_ORIGIN: APP,
  DEMO_MODE: "true",
  PAYMENT_PROVIDER: "mock",
  REAL_PAYMENTS_ENABLED: "false",
  ACCOUNTS_REQUIRED: "true",
  ENABLE_DESIGN_SYSTEM: "true",
  // Clave fija SOLO para este demo local con datos ficticios; nunca para un entorno compartido.
  PICKUP_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
});
console.log(`
Onza demo local (datos ficticios, pagos simulados). Cualquier contraseña entra.
  Cliente        ${APP}/acceso          maria@correo.demo (también sofia@, tomas@, valeria@correo.demo)
  Picnic por QR  ${APP}/v/picnic?spot=50000000-0000-4000-8000-000000000007   (Mesa 7 · Jardín)
  Barra          ${APP}/equipo/acceso   jorge@equipo.demo  → Picnic o Mil948
  Admin          ${APP}/equipo/acceso   ana@equipo.demo    → Administración de Picnic o Mil948
  Amigos         ${APP}/amigos          · Actividad ${APP}/actividad (ejemplo: ?ejemplo=1)
Ctrl+C para detener.
`);
