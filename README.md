# Onza

Web móvil para pedir en la barra y retirar con QR. Cliente, barra y administración del local sobre Next.js 16, React 19, TypeScript y Supabase. **Todo el dinero es simulado** (pagos mock); no hay cobros reales.

`main` es la única fuente de trabajo. El estado vigente y las decisiones están en [`DIARIO.md`](DIARIO.md); la guía técnica extensa, en [`docs/Onza-Guia-tecnica.md`](docs/Onza-Guia-tecnica.md).

## Clonar y correr

Requisitos: Node 24 (`.nvmrc`) y Git. Docker solo si querés Supabase local completo.

```sh
git clone https://github.com/msalas0810/onza.git
cd onza
nvm use
npm ci
cp .env.example .env.local   # nunca se versiona; ver abajo
npm run dev                  # http://127.0.0.1:3000
```

## Probar en cinco minutos (sin Docker ni cuentas)

```sh
npm ci
npm run demo:local          # servidor de verificación + app en http://127.0.0.1:3100, datos limpios en cada arranque
```

Cualquier contraseña entra. Todo es ficticio y los pagos son simulados.

| Rol | Entrar en | Cuenta |
| --- | --- | --- |
| Cliente | `/acceso` | `maria@correo.demo` (también `sofia@`, `tomas@`, `valeria@`, `diego@correo.demo`) |
| Picnic por QR de mesa | `/v/picnic?spot=50000000-0000-4000-8000-000000000007` | cliente |
| Barra | `/equipo/acceso` | `jorge@equipo.demo` (Picnic y Mil948) |
| Administración | `/equipo/acceso` | `ana@equipo.demo` (admin de Picnic y Mil948) |

Recorrido principal: tocá dónde estás en el plano de Picnic, pedí, entrá como barra y vas a ver el mismo pin en la tarjeta; aceptá, marcá listo y entregá con el código privado del ticket. Después abrí la administración: la entrada es «Ahora». Amigos y actividad: `/amigos` y `/actividad` (ejemplo simulado en `/actividad?ejemplo=1`).

Si el comando dice que un puerto está en uso o que ya hay un `next dev` abierto, cerralo (Next permite uno por carpeta) o usá `PORT=3200 SHIM_PORT=54322 npm run demo:local`. El servidor de verificación **no es Supabase**: sin Realtime (la app refresca por consulta), Storage mínimo y sin correo.

## Otros entornos

Sin Supabase podés revisar `/design-system` y los temas (con `ENABLE_DESIGN_SYSTEM=true` en `.env.local`). Para el flujo completo contra una base real hay tres caminos:

- **Supabase local (recomendado):** con Docker abierto, `npm run db:start && npm run demo:configure && npm run demo:seed-users`. `demo:configure` crea `.env.local` con las claves de esa instancia local; nunca sobrescribe uno existente.
- **Servidor de verificación sin Docker:** el de `npm run demo:local` (`scripts/local-shim`, migraciones reales sobre PGlite). Recorridos automáticos con Playwright: [`docs/Onza-Guia-tecnica.md`](docs/Onza-Guia-tecnica.md#verificación-local-del-flujo-completo-sin-supabase-remoto).
- **Un proyecto Supabase propio y aislado:** copiá `.env.example`, completá URL y clave publicable, y aplicá las migraciones de `supabase/migrations` con `npx supabase db push --dry-run` primero. No apuntes pruebas ni resets a una base compartida sin acordarlo con el equipo.

Qué variable va en qué entorno y si es de navegador o de servidor: comentarios de [`.env.example`](.env.example). `.env.local` contiene secretos de servidor (`SUPABASE_SERVICE_ROLE_KEY`, `PICKUP_TOKEN_ENCRYPTION_KEY`, contraseñas demo): está en `.gitignore`, no lo compartas ni lo pegues en issues o chats. `service_role` nunca va como `NEXT_PUBLIC_*`.

## Verificar antes de un PR

```sh
npm run check                         # tipos, lint, pruebas y build
node scripts/audit/scan-secrets.mjs   # que no se cuelen secretos ni NEXT_PUBLIC_* peligrosos
```

`npm test` corre PostgreSQL real en WASM (PGlite) con roles y RLS. No prueba Auth, Realtime ni Storage reales; para eso hace falta Supabase local o un proyecto aislado. Las pruebas de concurrencia, migraciones y carga están en [`docs/Onza-Auditoria-seguridad-y-escala.md`](docs/Onza-Auditoria-seguridad-y-escala.md).

## Abrir un PR

1. Partí de `main` actualizado: `git switch main && git pull`.
2. Creá una rama `feat/<tarea>` o `fix/<problema>`. No se trabaja directo en `main`.
3. Commits pequeños y coherentes. Cambios de datos o RLS = **migración nueva** (no se editan las ya aplicadas) y tipos regenerados con `npm run db:types:offline`.
4. `npm run check` en verde, y una entrada en `DIARIO.md` (ver la plantilla del PR).
5. `git push -u origin <rama> && gh pr create` y pedí revisión a la otra persona del equipo. Más detalle en [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Despliegue

El demo es https://onza-demo.vercel.app. **Cada push a `main` despliega a Production** en Vercel; las demás ramas generan un Preview. Usa el proyecto Supabase `onza-dev`, con datos de demo y pagos `mock`.

- **Antes de integrar a `main` un cambio con migración:** probala en un entorno aislado (la CI levanta un Supabase completo en cada push a `feat/**`), hacé un respaldo, revisá `npx supabase db push --linked --dry-run` y recién ahí aplicala. `main` no debe adelantarse a la base. Aplicar migraciones remotas y cambiar variables lo decide una persona autorizada.
- **Variables:** `node scripts/configure-vercel-env.mjs` (por `npx --package=vercel`; los valores salen de `.env.local` por stdin y no se imprimen). Production no tiene `SUPABASE_SERVICE_ROLE_KEY`, así que el alta de cuentas del equipo (`/api/team`) no funciona en el demo publicado.
- **Probar el demo publicado:** `node scripts/verify-dominio-picnic.mjs` (usa las cuentas demo de `.env.local`; deja un pedido de prueba entregado en Picnic). Pasos a mano en `DIARIO.md`, D-2026-11-27-05.
- **Picnic:** es el bloque «Picnic (demo ficticio)» de `supabase/seed.sql`, con su plano ilustrativo. No son datos reales del local.
