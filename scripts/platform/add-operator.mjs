// Agrega un operador permanente de la plataforma. NO existe en la interfaz ni en la API a propósito: es una operación de
// administración de la base, ejecutada por quien la opera, con su propia conexión.
//
// Uso:  DATABASE_URL="postgres://..." node scripts/platform/add-operator.mjs correo@ejemplo.com
// (la URL de conexión se pasa por variable de entorno, nunca como argumento, para que no quede en el historial ni en `ps`).
// Revise el SQL con --dry-run antes de ejecutarlo. Requiere `psql`.
// Efecto: inserta UNA fila en private.platform_operators con el interruptor `onza.allow_operator_change` activo solo dentro de
// esa transacción. Ese correo debe estar verificado en el proveedor de autenticación para poder entrar (la comprobación sigue
// exigiendo correo verificado, igual al del token, y segundo factor en acciones sensibles).
import { spawn } from "node:child_process";

const email = (process.argv[2] ?? "").trim().toLowerCase();
const dry = process.argv.includes("--dry-run");
if (!/^[^@\s'";]+@[^@\s'";]+\.[^@\s'";]+$/.test(email)) {
  console.error("Uso: node scripts/platform/add-operator.mjs correo@ejemplo.com [--dry-run]");
  process.exit(1);
}
const sql = `begin;
select set_config('onza.allow_operator_change','on',true);
insert into private.platform_operators(email,role) values('${email}','super_admin');
commit;
`;
if (dry || !process.env.DATABASE_URL) {
  console.log(sql);
  if (!dry) console.error("Falta DATABASE_URL: se mostró el SQL y no se ejecutó nada.");
  process.exit(dry ? 0 : 1);
}
const psql = spawn("psql", [process.env.DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-q"], { stdio: ["pipe", "inherit", "inherit"] });
psql.stdin.end(sql);
psql.on("exit", (code) => {
  console.log(code === 0 ? `Operador agregado: ${email}` : "No se agregó el operador (revise el error de arriba).");
  process.exit(code ?? 1);
});
