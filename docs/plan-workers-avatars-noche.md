# Plan: Workers + limpieza + personaje con puntos + noche social

> **Atención (2026-11-27, D-2026-11-27-10):** este plan se escribió sin conocer la rama `claude/eloquent-hamilton-rw4w0y`, que ya ocupa las migraciones **028–032** (según su diario, aplicadas en `onza-dev`) y trae puntos, monedas, XP, avatares, tienda y funciones sociales. La numeración y el diseño de las **Fases 3 y 4 no son ejecutables tal como están**: hay que replantearlos sobre ese código. La próxima migración es la 033.

Aprobado por Manu el 2026-11-27, con los ajustes ya incorporados. Cada fase termina y espera su aviso antes de seguir con la siguiente.

Repo `onza-starter` (origin `msalas0810/onza`), `main` limpio en `3c2e982`. Este documento es el entregable de la Fase 0.

## Contexto

Manu quiere cuatro cosas, en este orden:

1. Sacar Onza de Vercel y pasarlo a Cloudflare Workers, sin cortar Vercel todavía.
2. Limpiar el código sin cambiar el comportamiento.
3. Un personaje con puntos, tienda de accesorios y un estado de «tragos» que baja solo con la inactividad.
4. Extender la capa social de la migración 027: tarjetas, reacciones, seasons con niebla, mapa de provincias, top 50 y heatmap.

Decisiones que ya tomó Manu en esta sesión:

- **Cloudflare:** primero el plan Free y medir. Si el Worker comprimido pasa de 3 MiB, o si los 10 ms de CPU no alcanzan, me detengo y le pregunto antes de pasar a Paid.
- **Check-in:** se revierte la decisión de `docs/Onza-Noche-decisiones.md` §4 («pedir no crea check-in»). Un pedido entregado crea un **borrador privado** que nadie ve hasta que la persona lo confirma. Se deja constancia en DIARIO.
- **PostGIS:** se prueba solo en la CI con Supabase real (pgTAP). PGlite se queda en 0.5.16. `pglite-postgis` exige 0.6.1.

Hechos del repo que condicionan el plan:

- `src/proxy.ts` corre en Node. Next 16 no deja cambiarle el runtime. Usa `@supabase/ssr` y hace `auth.getUser()` más `rpc("current_account")` en cada petición.
- `@opennextjs/cloudflare` 1.20.19 acepta `next >=16.4.5` (el repo tiene 16.4.6). Soporta el middleware de Node (`proxy.ts`) como **experimental** desde 1.20.3.
- Lo que depende de Node:
  - el ticket de retiro: `src/features/pickup/server/tokens.ts`, AES-256-GCM con `node:crypto` y `Buffer`;
  - `qrcode.toDataURL` en el servidor, que usa pngjs y zlib (`order-service.ts:170`, `admin/[venueId]/qr/page.tsx:32`).
- Lo que depende de Vercel:
  - `next.config.ts:22` (`VERCEL_ENV`);
  - `src/lib/request-origin.ts:14-19` (`VERCEL_URL` y `VERCEL_BRANCH_URL`);
  - `src/lib/audit-log.ts:23` (`x-vercel-id`);
  - `vercel.json` (solo tiene el schema);
  - los scripts `configure-vercel-env.mjs`, `verify-vercel-demo.mjs`, `verify-dominio-picnic.mjs:9`, `verify-accounts-demo.mjs:5` y `verify-hosted-ux-preview.mjs:6`.
- Las imágenes ya van todas con `unoptimized`, así que no hace falta el binding de Images.
- Lo que ya existe y conviene aprovechar:
  - **«Avatar» ya existe** y es la foto de perfil (`avatar-editor.tsx`, bucket privado `avatars`, migraciones 014–015). Para no chocar, al muñeco nuevo le digo **personaje** en la UI y `character` en el código.
  - **027:** las tablas `friendships` y `venue_checkins` no tienen permisos directos; todo pasa por RPC. `private.social_user()` exige una cuenta de cliente con perfil y sin staff. `venue_activity()` usa un umbral de 5. No hay helper `are_friends`.
  - **`products`** no tiene `is_alcoholic`. El seed marca las bebidas sin alcohol solo con la categoría «Sin alcohol». «Entregado» es `orders.status='delivered'` con `delivered_at`.
  - **Pruebas de base:** `tests/db/helpers.ts` carga las migraciones con la lista `LATER_MIGRATIONS`, escrita a mano. `scripts/generate-db-types.mjs` tiene otra lista y una sección `Functions` también escrita a mano. No hay stub de `realtime` ni de PostGIS.
  - **Pruebas de componentes:** no hay ninguna. Vitest corre en `node` y solo incluye `tests/**/*.test.ts`.
  - **18+:** `complete_onboarding` rechaza `UNDERAGE` y `guard_order_customer` exige perfil. Nada de esto se toca.

## Nivel de diseño y de copy (todas las fases)

La app tiene que sentirse cuidada y con gusto, no una idea pegada ni de bajo esfuerzo.

- Nada de chistes forzados, emojis de relleno, textos tipo «¡Salud, campeón!», insignias genéricas ni mensajes infantiles. Copy breve, seguro y con humor seco, en voseo.
- Cada pantalla nueva: jerarquía clara, tokens de espaciado y tipografía, estados vacíos, de carga y de error diseñados, y microinteracciones cortas con propósito (respetando reduced motion).
- El personaje, los accesorios y la niebla del mapa se ven como producto terminado: formas limpias, paleta contenida de los tokens `avatar.*`, nada de clip-art.
- Si una idea del plan se ve cursi o de bajo esfuerzo al implementarla, se propone una versión mejor **antes** de construirla.
- Siguen las reglas del repo: sin gradientes decorativos ni brillo excesivo, controles de 44 px y foco visible.

## Ramas y cierre de cada fase

- Hay una rama por fase y cada una sale de la anterior: `feat/workers` → `feat/limpieza` → `feat/personaje` → `feat/noche-social`.
- Cada fase cierra con:
  - commits atómicos;
  - `npm run check` en verde;
  - una entrada en DIARIO con la plantilla, más «Estado actual» actualizado;
  - el PR hacia `main`.
- Nunca se hace push a `main`. Mergear lo decide Manu.
- Todas las migraciones son aditivas (regla R4) y van detrás de un indicador de servidor:
  - `CHARACTER_ENABLED` y `NIGHT_SOCIAL_ENABLED`, apagados en Production;
  - en DIARIO se anota con qué commit desplegado es compatible cada migración.

---

## FASE 1 · Cloudflare Workers (`feat/workers`)

### Arquitectura

- **Dependencias de desarrollo:** `@opennextjs/cloudflare@1.20.19` y `wrangler@^4.169`.
- **Scripts nuevos:**
  - `cf:build`: `opennextjs-cloudflare build`
  - `cf:preview`: build y luego `opennextjs-cloudflare preview` (workerd en local)
  - `cf:deploy:preview`: `opennextjs-cloudflare deploy --env preview`
  - `cf:deploy:production`
  - `cf-typegen`
- `npm run build` sigue siendo `next build`. OpenNext lo llama por dentro.
- **`wrangler.jsonc`:**
  - `main: .open-next/worker.js`, `assets` en `.open-next/assets` y el binding `WORKER_SELF_REFERENCE`;
  - `compatibility_date` actual;
  - flags `nodejs_compat` y `global_fetch_strictly_public`;
  - dos entornos, `env.preview` (worker `onza-preview`) y `env.production` (worker `onza`);
  - `vars` sin secretos: `APP_ORIGIN`, `ACCOUNTS_REQUIRED=true`, `PAYMENT_PROVIDER=mock`, `REAL_PAYMENTS_ENABLED=false`, `DEMO_MODE`, `ONZA_ENV=preview|production`.
- **`open-next.config.ts`:** `defineCloudflareConfig({})`. Va sin caché en R2 porque las páginas son `force-dynamic`. Si hace falta ISR, se agrega R2 después.
- **Variables públicas** (`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`): las inyecta el build. En la CI salen de GitHub `vars` por entorno.
- **Secrets del Worker:** `SUPABASE_SERVICE_ROLE_KEY`, `PICKUP_TOKEN_ENCRYPTION_KEY` y `PICKUP_TOKEN_KEY_VERSION`, cargados con `wrangler secret put --env …`. Hay que comprobar que llegan a `process.env` en runtime: OpenNext los copia y `nodejs_compat` con la fecha actual también.

### Cambios de código

| Archivo | Cambio |
| --- | --- |
| `next.config.ts` | Quitar la rama `VERCEL_ENV`, que solo servía para la barra de Vercel en Preview. La CSP parcial y los headers quedan iguales |
| `public/_headers` | **Nuevo.** En Workers, los archivos estáticos se sirven por `ASSETS` sin pasar por Next, así que `headers()` no los cubre. Ahí se repiten `nosniff`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy` para `/*` |
| `src/lib/request-origin.ts` | Quitar la excepción de `*.vercel.app`. El Preview queda cubierto por su `APP_ORIGIN` propio (la URL `workers.dev` del worker de preview). Se actualiza `tests/lib/request-origin.test.ts` |
| `src/lib/audit-log.ts` | Cambiar `x-vercel-id` por `cf-ray` y después `x-request-id`. Se actualiza `tests/lib/audit-log.test.ts` |
| `vercel.json` | Borrar. Vercel sigue desplegando por su integración con Git: no se corta nada |
| `tokens.ts` (retiro) | Se queda igual si `createCipheriv('aes-256-gcm')` funciona en workerd. Si no, se pasa a WebCrypto `crypto.subtle` con el mismo formato `v.iv.tag.ct`: los tickets existentes se siguen abriendo, y una prueba descifra un vector cifrado con la versión actual |
| QR del servidor | Se queda igual si zlib funciona en workerd. Si no, se usa `QRCode.toString({type:'svg'})` como data URI SVG. Más chico: no hace falta pngjs |
| `src/proxy.ts` | Se queda como `proxy.ts` (Node) con el soporte experimental. **Alternativa** si falla en `cf:preview` o en el deploy: `src/middleware.ts` en el runtime edge, que está deprecado pero sigue soportado en 16. `@supabase/ssr` corre en edge y la lógica es la misma. Va justificado en el doc antes de aplicarlo |
| Realtime en el cliente | Sin cambios: es un WebSocket directo del navegador a Supabase |

### CI y despliegue

- **`ci.yml`:** se agrega el job `workers-build`, que corre `cf:build` y falla si el tamaño comprimido pasa de 3 MiB (parsea la salida de `wrangler deploy --dry-run`).
- **Workflow nuevo `deploy-workers.yml`:**
  - Un push a `main` despliega al entorno **preview**.
  - Production se despliega solo a mano (`workflow_dispatch`) hasta el cambio de DNS.
  - Usa los secrets de GitHub `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.
- **Scripts:**
  - `configure-workers-secrets.mjs` reemplaza a `configure-vercel-env.mjs`. Pasa las claves de `.env.local` a `wrangler secret put` por stdin y nunca las imprime.
  - Los `verify-*` toman la URL de `ONZA_APP` en vez de tenerla fija.
  - Se borran `configure-vercel-env.mjs` y `verify-vercel-demo.mjs`.
- **Documentación:** README (despliegue y variables), `.env.example` (vars y secrets del Worker), `docs/02-arquitectura.md` (sección de hosting) y `.supabase/deploy-auth/supabase/config.toml`. Este último se documenta, no se aplica.

### Riesgos de la Fase 1

- **Plan Free:** el tope es 3 MiB comprimidos y 10 ms de CPU. Se mide el tamaño después de `cf:build` y el CPU con `wrangler tail` en el preview. Si no alcanza, **me detengo y pregunto**.
- **Proxy experimental:** sigue la alternativa de edge de arriba.
- **La clave del ticket tiene que ser la misma de Vercel.** Si no, los tickets activos no se pueden abrir.
- **El registro sigue roto (PEN-015).** El recorrido de prueba usa las cuentas `DEMO_*`, que ya existen.

### Aceptación de la Fase 1

- `cf:build` y el deploy del preview funcionan, con el tamaño reportado.
- En el Worker de preview funciona el recorrido login → pedido → barra → retiro (`verify-dominio-picnic.mjs` con `ONZA_APP`).
- `verify:hosted:security` y `verify:hosted:realtime` en verde.
- `npm run check` en verde.

---

## FASE 2 · Limpieza (`feat/limpieza`), sin cambios de comportamiento

- **Un patrón visual, un componente:**
  - Las iniciales del avatar se unifican (`avatar-editor.tsx:12` y `team-panel.tsx:34`).
  - `className="notice error"` pasa a `<Notice tone="danger">` en 5 archivos.
  - Los 13 `className="btn …"` sueltos pasan a `buttonClass()`.
  - `ConnectionBanner` y `ReconnectingBanner` quedan en un solo componente con variante.
  - Hay dos tonos de audio (`ready-sound.tsx` y `queue.tsx:134`); quedan en un helper.
  - La fila de amigo está dos veces (`actividad/page.tsx:68` y `friends-panel.tsx:189`); queda en un componente.
  - `.block-card` pasa a una primitiva `Card`.
- **Una sola lista de migraciones:** en `scripts/lib/migrations.mjs`, compartida por `tests/db/helpers.ts` y `generate-db-types.mjs`. Hoy hay dos listas a mano, y cada migración nueva se puede olvidar en una.
- **Docs y archivos obsoletos:**
  - A borrar (quedan en el historial de git): `docs/vercel-demo.md`, `docs/github-vercel.md`, `docs/local-execution-plan.md`, `docs/review-notes.md`, `PROMPT-CODEX*.md`. Los scripts `verify-pulido-e*`, `verify-maquetas` y `shots-*` también, solo si no los referencia ningún workflow ni doc vigente (se comprueba con grep).
  - **No se borran:** `MANIFEST.sha256`, `VALIDACION.md` y `check-kit.py`, que sellan el kit original.
  - Se corrige el doc que nombra `/actividad?ejemplo=1` y `activity-fixtures.ts`, que no existen en el código.
- **Formato:** `npm run format` con prettier e imports normalizados.
- **No se toca:** `is_anonymous` y lo de invitado en la base.
- **Aceptación:** `npm run check` en verde, sin editar ninguna prueba existente, y el recorrido local (`verify-local-flow.mjs`) igual que antes.

---

## FASE 3 · Personaje, puntos y tienda (`feat/personaje`)

### Migración `202611270028_product_alcohol.sql`

- `products.is_alcoholic boolean not null default true`, con un backfill a `false` donde la categoría sea «Sin alcohol» (`ilike 'sin alcohol%'`).
- `order_items.is_alcoholic` como snapshot, llenado por un trigger `BEFORE INSERT` que lo lee del producto. Así no cambia la firma de `create_order`.
- RPC nueva `set_product_alcoholic(product_id, bool)`, solo para el admin del local. En el editor de producto se agrega un toggle.

### Migración `202611270029_character_points.sql`

- **`character_config`** (fila única):
  - umbrales `{0,6,16,40,100}` de tragos lifetime para los niveles 0 a 4: sobrio, alegre, mareado, tambaleante y «hecho picha»;
  - `decay_days=7` (N);
  - `daily_order_cap=3`.
- **`point_rules`** (`kind` → puntos):

  | `kind` | Puntos | Notas |
  | --- | --- | --- |
  | `order_delivered` | 10 | Por **pedido**, no por trago, para no premiar el volumen. Tope de 3 pedidos con puntos por día |
  | `venue_first_visit` | 30 | Primer pedido entregado en un local, en toda la vida |
  | `season_discovery` | 50 | Fase 4 |
  | `province_first` | 100 | Fase 4 |

- **`avatar_items`:**
  - columnas `id`, `slot` (`hat|glasses|outfit|background`), `art_key`, `name`, `price_points`, `active`;
  - catálogo semilla de unos 12 artículos;
  - lectura para `authenticated`.
- **`user_items`:**
  - columnas `user_id`, `item_id`, `equipped`, `acquired_at`;
  - `unique(user_id,item_id)`;
  - índice único parcial `(user_id, slot) where equipped`.
- **`user_points_ledger`** (inmutable):
  - columnas `id`, `user_id`, `kind`, `delta`, `source_id`, `season_id` (nullable, se usa en la Fase 4), `request_key`, `created_at`;
  - `unique(user_id,kind,source_id)` para los créditos y `unique(user_id,request_key)` para las compras;
  - un trigger rechaza todo `UPDATE` y `DELETE`.
- **`character_profiles`:**
  - columnas `user_id`, `points_balance` con `check (>=0)`, `lifetime_drinks`, `last_activity_at` y `effects_enabled default true`;
  - el check del saldo vuelve imposible el doble gasto, aunque haya concurrencia.
- **RLS:** cada persona hace `select` solo de lo suyo. No hay `insert`, `update` ni `delete` directos (`revoke`, como en 022 y 027). Todo pasa por funciones `security definer set search_path=''`.
- **Trigger `AFTER UPDATE` en `orders`** (cuando el estado pasa a `delivered`):
  - suma los ítems alcohólicos a `lifetime_drinks`;
  - pone `last_activity_at=delivered_at`;
  - acredita los puntos que correspondan, sin duplicar gracias al `unique` por `source_id`.
- **`character_level(drinks, last_activity, at default now())`** (`stable`):
  - el nivel base sale de los umbrales;
  - se le resta `floor(días_inactivo / N)`, con piso 0;
  - al volver a pedir, `last_activity_at` se reinicia y el personaje vuelve a su nivel base.
  - No hace falta cron.
- **RPC:**
  - `character_me()` devuelve saldo, nivel, artículos, `effects_enabled` y el mensaje de cuidado.
  - `character_buy(item_id, request_key)`:
    - verifica la cuenta con `social_user()`, lo que deja fuera al staff;
    - aplica `limit_action`;
    - el precio **sale de la tabla**;
    - descuenta con `update … set points_balance = points_balance - price where points_balance >= price`, que bloquea la fila;
    - escribe en el ledger e inserta en `user_items`.
    - Si la misma `request_key` vuelve, devuelve el mismo resultado. Si el artículo ya es suyo, `ALREADY_OWNED`. Si no le alcanza, `INSUFFICIENT_POINTS`.
  - `character_equip(item_id, bool)` y `character_set_effects(bool)`.
  - `character_public(user_ids uuid[])`:
    - solo para la persona y sus amistades **aceptadas**;
    - devuelve los `art_key` equipados y el nivel visual (0 si apagó el efecto);
    - **nunca** devuelve el conteo de tragos ni los puntos.
  - El predicado de amistad de 027 se extrae a `private.are_friends(a,b)` en esta migración, sin tocar las funciones de 027.

### Arte (`src/features/character/`)

- `CharacterAvatar({ level, items, size })` dibuja un SVG con `viewBox 0 0 120 120` y estas capas, en orden:
  1. `background`
  2. `body`
  3. `outfit`
  4. `face[level]`
  5. `glasses`
  6. `hat`
- **Anclas fijas** en `anchors.ts`: `head {x,y,w}`, `eyes` y `torso`. Un accesorio es un `<g>` dibujado relativo a su ancla. Para agregar uno basta sumarlo al registro `art/items.tsx` y a una fila del seed. Una prueba falla si algún `art_key` de la base no tiene arte.
- **Colores:** tokens nuevos `avatar.*` en `design/tokens.json`, regenerados con `scripts/generate-tokens.py`.
- **Animación:** un balanceo CSS cuya amplitud crece con el nivel (200 a 1200 ms, usando los tokens de motion). Con `prefers-reduced-motion` queda estático.
- **Personaje propio:** un vasito redondeado, derivado del vasito de la marca, que es nuestro.
- **Cuidado en los niveles 3 y 4:** una tarjeta con «Tomá agua» y «Pedí un taxi o una app de transporte», sin nombrar marcas, más el toggle «Apagar efecto». Con el efecto apagado, el personaje se ve sobrio y la tienda sigue igual.

### UI de la Fase 3

- `/cuenta/personaje`: el personaje, el saldo, la tienda por slot, comprar y equipar. Se entra desde una fila nueva en `/cuenta`.
- El personaje se muestra en la fila de amigo (el componente unificado en la Fase 2) y en `/actividad`.
- No hay ranking de tragos en ninguna parte.

### Pruebas de la Fase 3

- **`tests/db/character.test.ts`:**
  - compra idempotente con la misma clave;
  - `INSUFFICIENT_POINTS`;
  - doble gasto: dos claves para dos artículos con saldo para uno solo, y el `check` de saldo;
  - RLS entre dos usuarios, staff rechazado y un amigo que ve `character_public` pero no los puntos;
  - créditos del trigger: solo tragos alcohólicos, solo `delivered`, sin duplicar;
  - nivel con decaimiento en 0, 6, 7, 14 y 30 días, y de vuelta tras pedir.
- **Componente:** se agregan `.tsx` al `include` de vitest. `renderToStaticMarkup`, que ya viene con `react-dom` (sin dependencias nuevas), verifica la expresión por nivel, el efecto apagado y la clase de reduced motion.
- **Límite:** PGlite usa una sola conexión, así que la concurrencia real no se puede probar ahí. La protege el `check` más el bloqueo de fila. Se agrega un pgTAP opcional en la CI.

### Aceptación de la Fase 3

Comprar, equipar y ver funcionan, los niveles y el decaimiento están probados, y `check` está en verde.

---

## FASE 4 · Noche social (`feat/noche-social`), extendiendo 027 sin reescribirlo

### Migración `202611270030_activity_cards.sql`

- **`activity_cards`:**
  - columnas `id`, `user_id`, `order_id unique`, `venue_id`, `occurred_at`, `drinks_count`, `show_count default false`, `photo_path`, `status draft|published|discarded`, `expires_at` (borrador de 24 h);
  - lo crea el trigger de pedido entregado.
- **RPC:**
  - `card_publish(id, show_count, photo_path)` y `card_discard(id)`;
  - `feed()`: tarjetas publicadas de amistades aceptadas, paginadas;
  - `card_react(id, emoji)`;
  - `user_block(id)` y `card_report(id, reason)`.
- **`card_reactions`:** una por persona y tarjeta, con el emoji en `check (emoji in ('🍻','❤️','😂','🔥','👏'))`. El ❤️ hace de «like». No hay comentarios.
- **`user_blocks`:** bloquear borra la amistad y oculta en las dos direcciones. `are_friends` tiene en cuenta los bloqueos.
- **`content_reports`:** privada. Solo la lee `is_onza`.
- **Bucket privado `card-photos`:** rutas `<uid>/<card>.webp`, 1 MB. El dueño escribe. Las amistades aceptadas pueden hacer `select` de las tarjetas publicadas, así que el cliente pide `createSignedUrl` con su propia sesión, sin `service_role`.
- **Realtime Broadcast privado:**
  - al publicar, un trigger llama a `realtime.send({card_id}, 'card', 'feed:'||friend_id, true)` para cada amistad;
  - una política en `realtime.messages` permite `select` solo a quien tenga `realtime.topic() = 'feed:'||auth.uid()`;
  - el cliente se suscribe con `private: true` y vuelve a pedir `feed()`;
  - no se usa Postgres Changes.
- **`ghost_mode`** en `character_profiles`: deja a la persona fuera del heatmap, del ranking nacional y de la ubicación compartida.

### Migración `202611270031_seasons.sql`

- **`provinces`** (sin geometría):
  - columnas `id 1–7`, `code` y `name`;
  - además `venues.province_id`, nullable.
- **`seasons`:** columnas `id`, `slug`, `name`, `starts_at`, `ends_at` y `status active|archived`. Un índice único garantiza una sola activa.
- **`discoveries`:**
  - columnas `user_id`, `venue_id`, `season_id`, `discovered_at` y `source`;
  - `unique(user_id,venue_id,season_id)`.
  - Las crea el trigger de pedido entregado. El check-in de hoy es autodeclarado, así que **no cuenta** hasta que exista un check-in verificado.
- **`landmark_bars`** (top 50):
  - columnas `rank`, `name`, `province_id`, `canton`, `latitude`/`longitude` nullable, `verified=false`, `source_url`, `placeholder=true`, `venue_id` nullable;
  - se llena por seed con fuentes;
  - las coordenadas quedan `null` hasta verificarlas;
  - al terminar entrego la lista de pendientes.
- **`leaderboard(scope 'friends'|'national', season)`:**
  - ordena por **puntos de exploración** (`season_discovery` más `province_first`) y muestra bares y provincias descubiertos;
  - el nacional exige `leaderboard_opt_in` y un `leaderboard_alias` único, y nunca muestra el nombre;
  - los tragos van como dato secundario neutro **solo en el de amigos**. No se rankea por tragos.
- **`venue_heat()`:**
  - agrega por local y por hora, juntando check-ins activos y pedidos entregados;
  - aplica un retraso de 20 minutos y deja fuera a quien esté en `ghost_mode`;
  - toma el umbral de `private.configuration`: **10 al lanzar**, y 5 mientras haya poco volumen (el valor inicial es 5; subirlo a 10 es un paso del lanzamiento);
  - devuelve solo niveles;
  - `venue_activity()` sigue intacta, como pide R4.

### Migración `202611270032_provinces_geo.sql` (solo Supabase real; PGlite la salta)

- `create extension if not exists postgis with schema extensions`.
- `provinces.geom geometry(MultiPolygon,4326)`.
- **Datos:** COD-AB de OCHA para Costa Rica, ADM1, desde HDX. Se simplifica con `npx mapshaper` en tiempo de desarrollo, sin quedar como dependencia, y se inserta como WKT. La licencia se verifica y va a `THIRD_PARTY_NOTICES`.
- **`province_at(lat,lng)`:** el servidor redondea a 2 decimales (unos 1,1 km), hace `ST_Contains` y devuelve solo el `id`. No guarda nada.
- **Cliente:** también redondea antes de enviar. Sin permiso de ubicación, aparece un selector manual.
- **Pruebas y tipos:** pgTAP en `supabase/tests/`, que corre el job `supabase-integration`. `province_at` se agrega a mano en la sección `Functions` del generador de tipos.

### UI de la Fase 4

- **`/actividad`:** feed de tarjetas con el personaje, borradores pendientes («Confirmá tu noche en Picnic»), reacciones, y reportar o bloquear en un sheet.
- **`/temporada`:**
  - un SVG de Costa Rica con las 7 provincias, generado del mismo GeoJSON simplificado, cubierto de niebla con una `mask`;
  - un bar sin descubrir se ve **solo** como «???»: silueta del pin, sin nombre ni logo;
  - al tocarlo se abre un sheet corto con «Ir ahí para descubrir» y, como única pista, la provincia o la zona. Nunca el nombre;
  - al descubrirlo (pedido entregado) se revela el nombre con la animación de DISCOVER;
  - no hay textos de «no disponible» ni de «todavía no está en Onza»;
  - cuentan solo los bares con `venue_id`;
  - progreso «X/50» y por provincia;
  - las seasons archivadas se pueden ver.
- **Animación DISCOVER:** el radio de la máscara se agranda con una transición CSS, el pin hace un pop y vibra con `navigator.vibrate` (el patrón de `ready-sound.tsx`). Con reduced motion, la niebla se va sin animación.
- **Rankings:** pestañas Amigos y Nacional (opt-in y alias en `/cuenta`).
- **Legal:** en el doc queda un TODO sobre el Decreto 37739-S (destacar bares pagados o marcas). No se implementa.

### Pruebas de la Fase 4

`tests/db` cubre:

- borrador, publicación y descarte;
- que solo las amistades ven el feed y la foto;
- que el bloqueo oculta en las dos direcciones;
- el set de emojis;
- discoveries únicas por season;
- el ranking nacional solo con opt-in, y que no expone nombres;
- el heatmap con umbral, retraso y modo fantasma;
- el fan-out del Broadcast, con un stub de `realtime.send` que registra los topics: solo amistades.

### Aceptación de la Fase 4

- La tarjeta llega a la amistad en vivo en el preview, probado con dos cuentas.
- El discover se dispara tras una entrega.
- El pgTAP de `province_at` pasa en la CI.
- `check` en verde.

---

## Pasos manuales para Manu (van también en el doc y en el README)

1. **Cuenta de Cloudflare (Free):**
   - un token con «Workers Scripts: Edit»;
   - en GitHub, los secrets `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`, más las `vars` `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. **Secrets de cada Worker** (`node scripts/configure-workers-secrets.mjs --env preview|production`):
   - `PICKUP_TOKEN_ENCRYPTION_KEY`: **la misma que usa Vercel**;
   - `PICKUP_TOKEN_KEY_VERSION`;
   - `SUPABASE_SERVICE_ROLE_KEY`: es la decisión pendiente de PEN-014, porque sin ella `/api/team` no funciona.
3. **Supabase Auth:** sumar las URLs `workers.dev` del preview y de Production a Site URL y a Redirect URLs, sin quitar todavía las de Vercel.
4. **PEN-015:** apagar «Confirm email» o configurar un SMTP propio.
5. **Migraciones 028–032 en `onza-dev`:** cuando Manu lo apruebe, con respaldo y dry-run como en D-2026-11-27-05.
6. **Después, cuando estés listo:**
   - dominio propio en Cloudflare y DNS;
   - quitar las URLs de Vercel de Auth;
   - desconectar la integración de Git de Vercel.

## Preguntas abiertas (no bloquean la Fase 1)

1. **Cómo descubrir los bares del top 50 que no están en Onza** (por ejemplo, con un check-in verificado por ubicación). Queda para después. Hoy cuentan solo los bares con `venue_id`.

Resueltas por Manu al aprobar:

- Las amistades ven el nivel del personaje **como imagen**, nunca como número, y se apaga con «Apagar efecto».
- Umbral del heatmap: 10 al lanzar, 5 mientras haya poco volumen.
- `MANIFEST.sha256`, `VALIDACION.md` y `check-kit.py` **no se borran**.

## Verificación de punta a punta

- Al cerrar cada fase:
  - `npm run check`;
  - en la Fase 1, además `cf:build` con el tamaño reportado y `cf:preview` en local con workerd;
  - deploy del preview y `ONZA_APP=<preview> node scripts/verify-dominio-picnic.mjs`;
  - `verify:hosted:security` y `verify:hosted:realtime`.
- En las Fases 3 y 4, además:
  - `npm run db:types:offline` y `tests/db`;
  - `supabase test db` en la CI;
  - recorridos con dos cuentas en el preview.
- En DIARIO va solo lo que se ejecutó. Lo que no se pudo probar (teléfonos físicos y hápticos) queda en «No verificado».

**Lo que no hice:** no investigué todavía los 50 bares ni la licencia de COD-AB (va con la Fase 4) y no medí el tamaño real del Worker. El riesgo principal es que el plan Free no alcance (3 MiB o 10 ms de CPU) y frene la Fase 1 hasta que decidas.
