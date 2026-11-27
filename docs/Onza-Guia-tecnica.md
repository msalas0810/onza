# Onza · Guía técnica (README histórico)

> Guía extensa conservada del README anterior. Para clonar, correr y abrir un PR, empezá por el [README](../README.md). Algunas rutas y enlaces de Preview pueden estar vencidos; el estado vigente está en `DIARIO.md`.

**Demo actualizado (Preview, pagos mock):** [abrir Onza](https://onza-demo-ml94rxfry-msalas0810s-projects.vercel.app). Código `e1e8987`, rama `fix/hosted-integration`; [verificación y límites](hosted-ux-verification.md). En teléfono, cliente; en computadora, otro perfil → Ajustes → Personal → cuenta existente de barra. Retiro con QR o **código privado de 12 caracteres**; el número público no autoriza entrega.


**Demo HTTPS:** https://onza-demo-msalas0810.vercel.app · Preview protegido por login de Vercel. Instrucciones y límites: [docs/vercel-demo.md](vercel-demo.md).

Web móvil Next.js/TypeScript con Supabase y dinero exclusivamente simulado. Cliente invitado, barra autenticada, retiro con claim por sesión y administración del local. La especificación original permanece en `docs/01` a `docs/05`.

**Estado real actualizado:** conectado a Supabase alojado `onza-dev` (organización Onza, ref `ukdjuubekpanizcmppod`). Flujo E2E real verificado en sesiones independientes, más 19 controles alojados de permisos/administración y 28 vistas claro/oscuro en móvil y escritorio. El historial de ejecución anterior se conserva en [docs/implementation-status.md](implementation-status.md).

## Arranque

Raíz de la aplicación y de Git: `onza-starter`.

```sh
cd onza-starter
nvm use
npm ci
npm run dev
```

Abrí [http://127.0.0.1:3000](http://127.0.0.1:3000). Sin Supabase podés revisar `/design-system`, los temas y el estado de configuración. Node 24 está fijado en `.nvmrc`; se incluye también Node 24 local como devDependency para que `npm run` use LTS sin cambiar el Node global. Para Vercel, seleccioná Node 24 en el proyecto. No hay que instalar herramientas globales con npm.

## Proyecto alojado actual (sin Docker)

El repositorio privado está en GitHub: https://github.com/msalas0810/onza. `main` conserva la base publicada; las correcciones están en `fix/hosted-integration` y no se fusionan automáticamente.

En esta computadora `.env.local` ya está preparado, ignorado por Git y con permisos 0600. Para iniciar: `npm run dev` y abrir http://127.0.0.1:3000. Las credenciales demo están únicamente en ese archivo; no copiarlas al chat ni a commits. Usá perfiles separados para cliente, barra y admin. `.env.example` define nombres, nunca secretos.

Para otro desarrollador autorizado: `npm ci`, autenticar Supabase CLI con permisos administrativos, verificar nombre/organización/ref y ejecutar `npm run demo:configure:hosted`. El script confirma la identidad remota, recupera las API keys en memoria y guarda `.env.local` sin imprimirlas. No sobrescribe archivos existentes. Los nuevos passwords generados no reemplazan contraseñas de usuarios remotos existentes: coordiná un juego de cuentas demo separado o gestioná sus credenciales por un canal seguro.

Migraciones pendientes: `npm exec supabase -- db push --remote=ukdjuubekpanizcmppod --dry-run --skip-vault`, luego aplicar sin `--dry-run` y con `--yes` solo tras revisar el listado. Nunca `db reset` remoto. El seed SQL es idempotente y se ejecuta con `db query --file supabase/seed.sql --remote=ukdjuubekpanizcmppod --yes`; `npm run demo:seed-users` conserva usuarios existentes.

Imágenes de los locales (portada y logo): las migraciones `202611160005_venue_images.sql` (columnas `cover_url`/`logo_url`, función `update_venue_branding`) y `202611160006_venue_images_storage.sql` (bucket público `venue-images`, 2 MB, jpg/png/webp, escritura solo para admins del local dueño de la carpeta) son aditivas y no destructivas. Para onza-dev, desde la computadora con la CLI autenticada: `npm exec supabase -- db push --remote=ukdjuubekpanizcmppod --dry-run --skip-vault` (debe listar solo esas dos), luego el mismo comando sin `--dry-run` y con `--yes`, y por último `npm run demo:seed-venue-images` (idempotente; usa la service_role de `.env.local` solo en ese script y no pisa imágenes subidas por un admin). El admin las edita en Administración → Perfil. Las imágenes demo son arte original generado con `npm run demo:generate-venue-art` (`public/demo-venues`), sin fotos ni marcas reales.

Imágenes de los tragos: la migración `202611160007_product_images.sql` (columna `products.image_url` y función `update_product_image`) es aditiva y reutiliza el bucket `venue-images` y sus políticas, así que no hay migración de Storage nueva. Se aplica con el mismo `db push` de arriba (el `--dry-run` debe listar `0005`, `0006` y `0007` si aún no se aplicaron las anteriores), y después `npm run demo:seed-product-images` (idempotente, una ilustración por tipo de trago en la carpeta de cada local, sin pisar imágenes que haya elegido un admin). El admin sube o cambia la imagen en Administración → Menú → Editar. Las ilustraciones demo son arte original (`public/demo-products`, `npm run demo:generate-drink-art`): cóctel en copa, vaso largo, shot, cerveza, vino y sin alcohol.

`supabase/hosted-auth.toml` declara únicamente los cambios de Auth necesarios. Para revisarlos, copiarlo a `.supabase/hosted-config/supabase/config.toml` y usar `config diff --remote=ukdjuubekpanizcmppod --workdir .supabase/hosted-config`. No aplicar el config local completo sobre el proyecto alojado. No habilitar exposición automática ni ampliar esquemas API.

Verificación real: `npm run test:e2e:live -- tests/e2e/full-demo.spec.ts tests/e2e/pickup.spec.ts`, `npm run verify:hosted:security` y `npm run verify:hosted:ui`. Esos comandos escriben datos ficticios; los controles de disponibilidad/pausa restauran los valores probados. La autenticación de pruebas evita volcar passwords en trazas de formularios. No generar traces/HAR con tokens.

## Demo persistente con Supabase local

Requisito externo: instalar y abrir Docker Desktop o un runtime compatible; `docker info` debe funcionar. La CLI Supabase está fijada en devDependencies. No hace falta cuenta de nube, contratación ni proyecto remoto.

```sh
npm run db:start
npm run demo:configure
npm run demo:seed-users
npm run dev
```

`db:start` aplica las migraciones y el seed en el proyecto local `onza-local`. `demo:configure` lee únicamente las claves de esa instancia local y crea `.env.local` (permisos 0600) con clave de cifrado y contraseñas aleatorias. Se niega a sobrescribir un archivo existente. Abrí ese archivo en tu editor para usar las credenciales demo; no lo compartás ni agregués a Git. El script de usuarios es idempotente y conserva contraseñas de cuentas existentes.

Si necesitás reconstruir **esa base local descartable**, `npm run db:reset` elimina sus pedidos y usuarios. Luego repetí `npm run demo:seed-users`. No hay reset público desde la web. Antes de cualquier reset con datos útiles, hacé respaldo de DB, Storage y clave de cifrado. No se ejecutó reset aquí.

Para un proyecto Supabase demo ya existente: copiá `.env.example` a `.env.local`, llená URL y publishable key, generá una clave AES de 32 bytes en base64 y aplicá las tres migraciones en orden. El seed habilita explícitamente el ledger mock; **no aplicarlo a producción**. Activá Anonymous Sign-ins y provisioná usuarios permanentes/roles con el script desde tu equipo. La service_role se usa solo en el seed, nunca en el runtime web. Realtime y Storage se configuran en la segunda migración. URLs de Auth y Vercel: [docs/github-vercel.md](github-vercel.md).

## Recorrido

1. Cliente en perfil A: `/` → Sala Norte → productos → carrito → checkout. Sin formulario de login ni tarjeta. Reserva ficticia aprobada/rechazada/con acción/unknown. Confirmá mayoría de edad y políticas demo-v1.
2. Barra en perfil B: `/login`, usá DEMO_BARTENDER_EMAIL/PASSWORD de `.env.local`; abrí su barra. Aceptá, prepará y marcá Listo. El cliente recibe actualizaciones con Realtime y refetch al volver/reconectar.
3. Validá QR con cámara compatible o ingresá el código privado de retiro de 12 caracteres. Solo la sesión que obtuvo el claim puede capturar/entregar. Marcá la entrega física y confirmá. Una captura con respuesta perdida requiere consultar su estado; no se vuelve a cobrar.
4. Admin en perfil C: DEMO_ADMIN_EMAIL/PASSWORD → administración. Editá menú, fotos propias, disponibilidad, ajustes; consultá ventas y devoluciones de la fecha operativa (06:00 Costa Rica).
5. Otro local: DEMO_BARTENDER_2 pertenece a Patio Central. No puede consultar ni operar pedidos de Sala Norte. Onza global: cuenta DEMO_ONZA, enlace de configuración global luego del login; crea locales y asigna personal existente con auditoría.

Un mismo perfil comparte cookies de Auth. Usá perfiles, incógnito o dispositivos separados para los roles. Borrar cookies o cambiar de dispositivo pierde el acceso invitado; el código de retiro no recupera identidad.

## Verificación

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
# Una vez disponible Supabase local:
npm run test:e2e:live
npm exec supabase -- test db
```

`npm test` ejecuta PostgreSQL real en WASM (PGlite) con roles `anon`/`authenticated` y claims Auth simulados. Aplica las migraciones de dominio y plataforma y el seed; comprueba transacciones, RLS, snapshots, idempotencia, pagos, dueño del retiro y métricas. **No prueba GoTrue/Auth, Realtime, Storage ni concurrencia entre conexiones PostgreSQL reales.** La migración específica de esos servicios y los tests pgTAP necesitan Supabase real.

Playwright prueba componentes, tamaños/temas y UI disponible sin DB. El guion `full-demo.spec.ts` usa Supabase real, cuatro contextos de navegador y retiros HTTP en paralelo; se omite explícitamente sin `E2E_LIVE=true`. No toma un mock de API como evidencia multiusuario. No se probó iPhone físico ni Android físico. Cámara/audio no se garantizan en iPhone ni con la web en segundo plano; no hay push/SMS.

CI está en `.github/workflows/ci.yml`: checks sin secretos productivos y job Supabase local con Docker y credenciales efímeras. No se ejecutó GitHub Actions en esta sesión porque no hay remoto/push.

## Datos y módulos

- `src/features/catalog`: queries RLS y menú editorial con fallback de fotos.
- `src/features/orders`: carrito borrador, validación, servicios, seguimiento y cola.
- `src/features/payments/server`: gate mock y BAC que falla explícitamente. El adaptador mock durable se ejecuta dentro de `public.onza_command` y `private.payment_operations`: autorización/captura/anulación/devolución atómicas sin red bancaria ni ledger en memoria.
- `src/features/pickup`: token aleatorio de 256 bits, SHA-256 de búsqueda, copia AES-256-GCM, QR, cámara lazy y claim por `session_id` verificado de Supabase Auth.
- `src/features/analytics`: cobros netos, reservas separadas, unidades entregadas y mediana con N. Corte 06:00 en America/Costa_Rica.
- `supabase/migrations`: tablas, RLS, constraints, funciones, Realtime/Storage y permiso Onza global.
- `src/lib/supabase/database.generated.ts`: tipos generados desde SQL. `npm run db:types` regenera desde Supabase local; `npm run db:types:offline` desde las migraciones con PGlite.

Las escrituras pasan por comandos backend y RPC autorizados. Los RPC también validan permisos y entradas: no dependen del frontend. La API compacta `/api/commands` recibe acciones tipadas; no es una API bancaria. GET `/api/orders`, `/api/catalog`, `/api/summary` y `/api/health` complementan las lecturas. Las respuestas privadas no tienen caché compartida. No hay service worker que cachee pedidos offline.

El barrido demo se ejecuta al consultar/mutar y no necesita que el navegador que creó el pedido siga abierto. **Sin tráfico, no hay scheduler:** expiraciones se aplican en la siguiente consulta autorizada. Para piloto hace falta tarea durable backend, con reconciliación y pruebas con navegadores cerrados. Un pago unknown o un claim con captura nunca se libera por vencimiento automático. Transferir un retiro exige supervisor y confirmación física auditada.

## Colaboración y entrega posterior

Ver [CONTRIBUTING.md](../CONTRIBUTING.md) y [docs/github-vercel.md](github-vercel.md). Git local y commits por hitos, sin remoto/push/despliegue. No usa el filesystem de Vercel como base de datos. Los flags de entorno no habilitan un banco: BAC permanece sin configurar. Faltan acuerdo/manual y condiciones del documento 03 antes de cualquier cobro real.

No se incluyeron fotografías licenciadas; las fixtures conservan `photo_path=null`. SVG e Inter originales con licencias en `brand` y THIRD_PARTY_NOTICES.md. No se inventaron comercios afiliados, métricas ni logos bancarios.

## Verificación local del flujo completo (sin Supabase remoto)

`node scripts/verify-local-flow.mjs [--shots]` levanta un servidor de verificación (`scripts/local-shim/`: las migraciones reales sobre PGlite detrás de la parte de la API de Supabase que usa la app) y recorre con Chromium: cliente pide → barra recibe y acepta → marca listo → cliente muestra el ticket → barra valida y entrega, más cancelación, rechazo, permisos entre locales, clave temporal, quitar acceso, stock que cambia, sesión vencida y desconexión. Guarda `docs/evidence/v1/flow-verification.json` y capturas. **No es Supabase**: no prueba Realtime, Storage, correo, Google ni límites de tasa; no sustituye la verificación contra `onza-dev`.

### Plan de pulido (noviembre 2026)

Estado, evidencia, decisiones y bloqueos por entrega: `docs/plan-pulido-registro.md`. Migraciones nuevas (aditivas, sin aplicar en remoto): `202611190013` a `202611190019`. Para probar contra el shim:

```bash
node scripts/local-shim/index.mjs &   # :54321, datos limpios en cada arranque
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-shim-publishable \
SUPABASE_SERVICE_ROLE_KEY=local-shim-service-role APP_ORIGIN=http://127.0.0.1:3100 DEMO_MODE=true \
PAYMENT_PROVIDER=mock REAL_PAYMENTS_ENABLED=false ACCOUNTS_REQUIRED=true ENABLE_DESIGN_SYSTEM=true \
PICKUP_TOKEN_ENCRYPTION_KEY=$(node -e 'process.stdout.write(Buffer.alloc(32,7).toString("base64"))') \
npx next dev --hostname 127.0.0.1 -p 3100
ONZA_APP=http://127.0.0.1:3100 node scripts/verify-pulido-all.mjs   # reinicia el shim entre grupos (detené el anterior)
```

Personas del shim (cualquier contraseña): `maria@correo.demo` y `sofia@correo.demo` (clientes), `jorge@equipo.demo` (empleado de Mil948), `ana@equipo.demo` (admin de Mil948 y empleada de Stiefel), `luis@equipo.demo` (clave temporal).

### Entrega en el lugar y administración (noviembre de 2026)

Migración `202611260025` (aditiva, **sin aplicar en remoto**). Diseño, decisiones y pasos para probar Picnic: `docs/Onza-Entrega-en-el-lugar.md`. Recorrido en navegador con el shim y `next dev` (como arriba): `ONZA_APP=http://127.0.0.1:3100 node scripts/verify-entrega-lugar.mjs [carpeta-capturas]` (reiniciá el shim antes de repetirlo: crea pedidos).

### Mapa de Picnic, administración por momentos, actividad y amigos (noviembre de 2026)

Migraciones `202611270026` (mapa del local con pin) y `202611270027` (check-ins, amigos y mapa de actividad), aditivas y **sin aplicar en remoto**. Decisiones, referencias y pendientes: `docs/Onza-Noche-decisiones.md`. Con el shim recién iniciado y la app apuntando a él (`npm run demo:local`, o el bloque de arriba), en este orden y reiniciando el shim entre uno y otro porque crean datos:

```bash
ONZA_APP=http://127.0.0.1:3100 node scripts/verify-entrega-mapa.mjs [carpeta]       # QR → login → pin → pedido → mismo pin en barra → entrega (50)
ONZA_APP=http://127.0.0.1:3100 node scripts/verify-entrega-lugar.mjs [carpeta]       # lugares nombrados, cola, «Ahora», CSV, QR (43)
ONZA_APP=http://127.0.0.1:3100 node scripts/verify-amigos-actividad.mjs [carpeta]    # solicitud, aceptar, compartir, cortar, conteos chicos (23)
ONZA_APP=http://127.0.0.1:3100 node scripts/shots-noche.mjs <carpeta>                # capturas comparables antes/después
```

Con otro puerto del shim, agregá `SHIM_URL=http://127.0.0.1:<puerto>`. Clientes extra del shim para amigos: `tomas@correo.demo` y `valeria@correo.demo`.

### Auditoría de seguridad y escala (noviembre de 2026)

Informe, matriz de roles, hallazgos con su prueba y pendientes: `docs/Onza-Auditoria-seguridad-y-escala.md`; operación: `docs/Onza-Runbook-operacion.md`. Migraciones nuevas (aditivas, **sin aplicar en remoto**): `202611210021` a `202611210023`. Las pruebas de concurrencia, migraciones y carga usan un Postgres 17 real y efímero que se instala **una vez fuera del repo** (instrucciones en `scripts/audit/pg.mjs`); no tocan ningún proyecto remoto:

```bash
node scripts/audit/concurrency.mjs   # 12 escenarios concurrentes de pedidos
node scripts/audit/migrations.mjs    # base vacía vs actualización desde 012
node scripts/audit/scan-secrets.mjs  # secretos y NEXT_PUBLIC_* (no imprime valores)
ONZA_APP=http://127.0.0.1:3100 node scripts/verify-audit-sesiones.mjs   # sesiones en el navegador (shim + next dev, ver arriba)
```
