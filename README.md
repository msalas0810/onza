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

Hay dos destinos mientras dura la mudanza. Los dos usan el proyecto Supabase `onza-dev`, con datos de demo y pagos `mock`.

- **Vercel (el publicado hoy):** https://onza-demo.vercel.app. Sigue desplegando por su integración con Git: **cada push a `main` despliega a Production**. Sus variables se cambian en el panel de Vercel. No se corta hasta el cambio de dominio.
- **Cloudflare Workers (nuevo):** Next 16 con [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). Dos entornos en `wrangler.jsonc`: `preview` (worker `onza-preview`) y `production` (worker `onza`).

**Antes de integrar a `main` un cambio con migración:** probala en un entorno aislado (la CI levanta un Supabase completo en cada push a `feat/**`), hacé un respaldo, revisá `npx supabase db push --linked --dry-run` y recién ahí aplicala. `main` no debe adelantarse a la base. Aplicar migraciones remotas y cambiar variables lo decide una persona autorizada.

### Workers: comandos

```sh
npm run cf:build              # empaqueta, revisa secretos y mide el tamaño
npm run cf:preview            # lo anterior + el Worker en workerd local, en http://127.0.0.1:3000
npm run cf:deploy:preview     # lo anterior + despliegue a onza-preview (requiere sesión de Cloudflare)
npm run cf:deploy:production  # idem, worker onza
```

- **Usá siempre `npm run cf:*`.** `opennextjs-cloudflare build` copia **todos** los valores de `.env*` dentro del Worker, incluida la `service_role`. `scripts/cf-build.mjs` deja solo las `NEXT_PUBLIC_*`, busca los secretos en todo el bundle y, si encuentra uno, borra `.open-next/` y falla.
- **Tamaño:** el build falla si el Worker comprimido pasa de 3072 KiB, el tope del plan Free. El otro tope de Free (10 ms de CPU por petición) no se puede medir en local: mirá `npx wrangler tail --env preview` en el Worker desplegado. Pasar a un plan pago lo decide el dueño.
- **Variables:** las `NEXT_PUBLIC_*` se fijan al compilar (salen de `.env.local` o del entorno). Las de servidor no secretas están en `vars` de `wrangler.jsonc`. `APP_ORIGIN` y los secretos se cargan una vez por entorno (abajo).
- **Vista local:** `cf:preview` **no** lee `.env.local` en el Worker. Creá `.dev.vars.preview` (ignorado por git) con `APP_ORIGIN=http://127.0.0.1:3000`, `PICKUP_TOKEN_ENCRYPTION_KEY`, `PICKUP_TOKEN_KEY_VERSION` y, si usás `/api/team`, `SUPABASE_SERVICE_ROLE_KEY`. Sin `APP_ORIGIN` todos los POST responden 403. Para correr los recorridos sin Supabase real, ver [`docs/Onza-Guia-tecnica.md`](docs/Onza-Guia-tecnica.md#el-mismo-recorrido-sobre-workers).
- **Proxy:** `src/proxy.ts` corre como middleware de Node, que el adaptador marca como **experimental**. Si una versión lo rompe, la alternativa es renombrarlo a `src/middleware.ts` (runtime edge, en desuso pero soportado en Next 16).
- **Estáticos:** Cloudflare los sirve sin pasar por Next; sus headers están en `public/_headers`.

### Workers: pasos manuales del dueño

En este orden, una sola vez.

1. **Cuenta de Cloudflare (plan Free)** y `npx wrangler login`.
2. **Primer despliegue del preview:** `npm run cf:deploy:preview`, con `.env.local` apuntando a `onza-dev`. Anotá la URL `https://onza-preview.<cuenta>.workers.dev`. Hasta el paso 3, entrar funciona pero todos los POST se rechazan (falta `APP_ORIGIN`).
3. **Secretos del preview:** `node scripts/configure-workers-secrets.mjs --env preview --origin https://onza-preview.<cuenta>.workers.dev`.
   - `PICKUP_TOKEN_ENCRYPTION_KEY` tiene que ser **la misma que usa Vercel**. Con otra, los tickets abiertos no se pueden leer. Comparala antes de cargarla.
   - `--service-role` carga además `SUPABASE_SERVICE_ROLE_KEY`. Sin ella no funciona el alta del equipo (`/api/team`). Es la decisión pendiente PEN-014.
4. **Supabase → Authentication → URL Configuration:** sumá `https://onza-preview.<cuenta>.workers.dev/**` a *Redirect URLs*. No quites las de Vercel. *Site URL* cambia recién con el dominio definitivo.
5. **PEN-015:** el registro de cuentas nuevas falla hasta apagar «Confirm email» o configurar un SMTP propio.
6. **Verificar el preview:** `ONZA_APP=https://onza-preview.<cuenta>.workers.dev node scripts/verify-dominio-picnic.mjs` (usa las cuentas demo y deja un pedido entregado en Picnic), `npm run verify:hosted:security` y `node --env-file=.env.local scripts/verify-hosted-realtime.mjs`. Los dos últimos prueban Supabase directamente y escriben datos de prueba en `onza-dev`.
7. **GitHub (opcional, para desplegar desde Actions):** secrets `CLOUDFLARE_API_TOKEN` (permiso *Workers Scripts: Edit*) y `CLOUDFLARE_ACCOUNT_ID`; variables de repositorio `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `CLOUDFLARE_DEPLOY_ENABLED=true`. Con eso, cada push a `main` despliega el preview, y production se lanza a mano desde `main` (*Deploy Workers → Run workflow*).
8. **Production y dominio (más adelante):** repetí 2 a 4 con `production`; sumá el dominio propio al Worker y el DNS; en Supabase cambiá *Site URL* y *Redirect URLs*; cargá de nuevo `APP_ORIGIN` con el dominio; recién ahí desconectá la integración de Git de Vercel.

- **Probar el demo de Vercel:** `node scripts/verify-dominio-picnic.mjs` (sin `ONZA_APP`). Pasos a mano en `DIARIO.md`, D-2026-11-27-05.
- **Picnic:** es el bloque «Picnic (demo ficticio)» de `supabase/seed.sql`, con su plano ilustrativo. No son datos reales del local.
