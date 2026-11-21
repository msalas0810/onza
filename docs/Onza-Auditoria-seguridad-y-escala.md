# Onza · Auditoría defensiva de seguridad y escala

21 de noviembre de 2026 · rama `audit/seguridad-escala` (local, sin push) creada desde `1090b4e`, el commit del rescate publicado en Preview.

**Alcance.** Revisión de código, configuración y pruebas defensivas de regresión, con cuentas y datos ficticios, pagos **mock** y solo entornos aislados: servidor local `scripts/local-shim` (PGlite), PGlite en memoria y un Postgres 17 real y efímero (`embedded-postgres`, fuera del repo). **No se tocó `onza-dev`, ningún despliegue público, ninguna cuenta real ni pago real.** `.env.local` se usó solo para buscar secretos en memoria; la app de prueba se levantó con variables explícitas que apuntan al servidor local.

**Cómo leer los estados.** *Verificado* = lo ejecuté y pasó (con el entorno indicado). *Parcial* = probado en un sustituto del entorno real. *Bloqueado* = hace falta algo que no está aquí, con el paso exacto para retomarlo.

## 1 · Resumen por bloque

| Bloque | Estado | Qué se hizo | Evidencia | Siguiente paso |
|---|---|---|---|---|
| 1 · Sesiones y roles | **parcial** | 4 correcciones (cierre por dispositivo, sincronía entre pestañas, fallas transitorias, limpieza al revocar). Recorrido de navegador de 44 comprobaciones | `scripts/verify-audit-sesiones.mjs`, commit `2b7d769` | Repetir contra Supabase Auth real (cookies, refresh, expiración real): ver §10 |
| 2 · Permisos | **verificado** en base (PGlite y Postgres real); **parcial** en Auth/Storage/Realtime | 7 hallazgos corregidos (migraciones 021–022, CSP, URL de imágenes, registro). Matriz de 30 pruebas | `tests/db/audit-permissions.test.ts`, commits `9d240ab`, `08062f2` | Storage y Realtime reales; MFA para admin/Onza (propuesta) |
| 3 · Pedidos y concurrencia | **verificado** (Postgres real) | 12 escenarios concurrentes con bloqueos reales; sin defectos de duplicación; invariantes tras cada uno y bajo carga | `scripts/audit/concurrency.mjs` | Programador del barrido (PEN-005): configuración lista, **bloqueada** por ser un cambio remoto |
| 4 · Migraciones 013–024 | **verificado** (Postgres real, stubs de `auth`/`storage`/`realtime`) | Base vacía y salto desde 012 con 100 000 pedidos: mismo esquema final, datos intactos, 30–112 ms en total | `scripts/audit/migrations.mjs` | `db push --dry-run` en un proyecto aislado (el CLI de Supabase local necesita Docker, no disponible) |
| 5 · Escala | **parcial** | Carga sintética del nivel de base de datos; primer cuello medido y corregido (migración 023): `order_list(venue)` p95 de ~29 s a ~0,2 s | `docs/evidence/audit/` | Medir Next + PostgREST + Realtime en un staging comparable (§8) |

**Pruebas del repositorio al cierre:** `npm run check` → tipos y lint sin errores, **44 archivos / 195 pruebas** (antes de la rama: 41 / 157), `next build` correcto; `verify-pulido-all` (E1–E6, acceso, cuenta, Tus locales) sin regresiones; `verify-audit-sesiones` 44/44; `concurrency.mjs` 31/31; `migrations.mjs` 14/14; `scan-secrets` sin hallazgos; `npm audit` 0 vulnerabilidades.

**Recomendación de piloto.** Con las migraciones 021–024 y los cambios de esta rama, **no quedó abierto ningún problema crítico conocido**. Sin ellos, la versión del rescate **no se recomienda para un piloto**: un cliente o empleado podía crear pedidos llamando a la RPC directo (P1) y la lectura de la cola de la barra se degradaba con el historial del local hasta bloquear el pool (E1). Siguen siendo requisitos previos al piloto las pruebas contra Supabase real (§10) y la decisión sobre el programador del barrido.

## 2 · Ajustes al plan (según el código real)

El plan (`docs/Onza-Plan-seguridad-y-escala.md`, que sigue sin versionar y no se modificó) parte de supuestos que el código contradice o que el entorno no permite. Ajustes y motivo:

1. **«Volver a Cliente no pide otra contraseña para la misma identidad» → no aplica.** La decisión vigente (blueprint §0, `AGENTS.md`) es que la cuenta laboral **nunca compra**; el servidor (`STAFF_CANNOT_ORDER`) y ahora también la base lo hacen cumplir. «Cliente» y «Equipo» son cuentas distintas; para pasar de una a otra se **elige** la cuenta (`/sesion-activa`). Lo que sí funciona con una sola identidad es **Barra ↔ Administración** de un administrador.
2. **«Cliente en una pestaña y Barra en otra» solo es posible con perfiles de navegador distintos.** Las cookies de sesión son una por navegador y origen. Se resolvió la parte alcanzable: una pestaña se entera de que otra cerró sesión o cambió de cuenta (`AuthSync`).
3. **«Cerrar sesión: navegador actual o todas»** se decidió: **solo este dispositivo** (antes cerraba todas por el valor por defecto de supabase-js). «En todos mis dispositivos» es una acción aparte.
4. **El entorno de Supabase completo no está disponible** (no hay Docker; `supabase start` no corre). Sustituto usado y sus límites: Postgres 17 real con *stubs* de `auth`, `storage` y `realtime`, más el servidor local simulado para la interfaz. No cubre: GoTrue (cookies/refresh/expiración reales), PostgREST, Realtime, Storage real, correo.
5. **Las metas de carga se escalaron:** se corrió 100 sesiones y 30 checkouts/min sostenidos y 60/min en ráfaga (ver §9 para las duraciones realmente ejecutadas).
6. **CI:** la rama no disparaba CI (los filtros eran `main`, `feat/**`, `fix/**`); se agregaron `review/**` y `audit/**` y un job `security` (`npm audit` + búsqueda de secretos).

## 3 · Mapa del código (qué ya existía, qué faltaba)

| Tema | Archivos | Estado |
|---|---|---|
| Auth/SSR y rutas | `src/proxy.ts` (refresh de sesión + política de acceso), `src/lib/supabase/{server,browser,guards,admin}.ts`, `src/lib/access-policy.ts`, `src/lib/account.ts`, `src/app/auth/callback/route.ts` | Existía. Faltaba: manejo de fallas transitorias, cierre por dispositivo, sincronía entre pestañas |
| Membresías / RLS / funciones | `supabase/migrations/001…020`; `private.is_staff`, `public.has_venue_access`, `public.current_account` | Existía y es sólido (matriz §5). Faltaba: reglas de compra en la base, permisos por defecto, privacidad de eventos |
| Operaciones de pedido | `public.onza_command` (+ `private.create_order`, `private.accept_order`, `private.expire_order`), `src/features/orders/server/order-service.ts` | Sólido bajo concurrencia (§6) |
| Workers | `public.sweep_orders` (corre con tráfico), `public.auto_accept_tick` (sin programador) | Faltaba el programador → `supabase/ops/pg_cron_auto_accept.sql` (no aplicado) |
| Pruebas | `tests/db/*` (PGlite), `tests/orders`, `tests/pickup`, `scripts/verify-*.mjs` (navegador + shim) | Existía. Se agregó la matriz, el arnés con permisos por defecto de Supabase, Postgres real y el recorrido de sesiones |
| Métricas / registro | Ninguno (no había `console.*` en `src/`) | Se agregó registro estructurado con ID de correlación (`src/lib/audit-log.ts`) |

## 4 · Flujo de sesión y causa del síntoma

```
Cliente  /acceso ──signIn──► /  (Explorar) ─► /v/<local> ─► /checkout ─► /orders/<id>
   │ cuenta personal (profiles)                               ▲ proxy: getUser + current_account → decideAccess
   │  ¿abre /equipo/…?  ──► /sesion-activa?want=equipo  (elige: continuar o usar otra cuenta)
Equipo   /equipo/acceso ─signIn─► staffHome ─► 1 local: /staff|/admin/<id> · varios/ninguno: /equipo/locales
   │ cuenta laboral (staff_accounts + memberships)  ── nunca compra
   │  ¿abre /?  ──► /sesion-activa?want=cliente
Admin    /admin/<id> ◄──► /staff/<id>   (misma identidad; «Abrir barra» / «Administrar»)
Salir    «Salir de este dispositivo» (scope=local) · «…en todos mis dispositivos» (scope=global)
```

**Clasificación del síntoma «cambio de sesión»** (no reproducido contra Supabase real; hipótesis con evidencia de código):

- **Fallo de redirección por interpretar un error como estado** (probable): `proxy.ts` y `currentAccount()` trataban un fallo transitorio de Auth o de la base como «sin sesión» o, peor, como `kind = customer` por defecto. A un empleado le aparecía «Esta cuenta es personal y no tiene acceso al equipo»; a un cliente lo devolvían al acceso. Reproducido en el navegador con fallas inyectadas: antes `200 /` con destino perdido, ahora `503` con reintento y misma sesión.
- **Cierre global** (confirmado): cerrar sesión en un dispositivo cerraba la cuenta en todos (`scope: global` por defecto). Medido: `[{"scope":"global"}]` antes, `local` ahora.
- **Estado entre pestañas** (confirmado por código): ninguna pestaña escuchaba cambios de cuenta.
- **No encontrado:** identidad equivocada del servidor (la cuenta y el local se resuelven en cada petición desde la base), caché compartida de respuestas con cookies (todas las rutas son `force-dynamic`/`no-store`).

## 5 · Hallazgos, por prioridad

Prioridad = impacto × evidencia. «Prueba» es la regresión que falla sin la corrección.

### Prioridad 1 · Sesiones

| ID | Sev. | Hallazgo (localización) | Corrección | Prueba | Estado |
|---|---|---|---|---|---|
| S1 | Alta | Cerrar sesión cerraba **todas** las sesiones de la cuenta (`account-actions.tsx`, `login.tsx`: `signOut()` global) | `signOutDevice()` con `scope: local`; acción explícita para todos (`sign-out.ts`) | `verify-audit-sesiones` §4 y §6 | Corregido `2b7d769` |
| S2 | Alta | Falla transitoria de Auth/base ⇒ «sin sesión» o `kind=customer` (`proxy.ts:52-66`, `account.ts`) | 503 con reintento sin tocar la sesión; nunca se adivina la cuenta | `verify-audit-sesiones` §9 (antes: `200 /`) | Corregido `2b7d769` |
| S3 | Media | Otra pestaña no se entera de cierre/cambio de cuenta | `AuthSync` compara identidad y refresca | `verify-audit-sesiones` §10 | Corregido `2b7d769` |
| S4 | Media | Revocación o vencimiento dejaban pedidos en el estado de React y el canal abierto (`use-live-orders.ts`) | Se vacía la vista y se cierra la suscripción | `verify-audit-sesiones` §7 | Corregido `2b7d769` |
| S5 | Info | Cliente en el formulario del equipo: se cerraba su sesión **global** | `scope: local` + mensaje | `verify-audit-sesiones` §6 | Corregido `2b7d769` |

### Prioridad 2 · Permisos

| ID | Sev. | Hallazgo | Corrección | Prueba | Estado |
|---|---|---|---|---|---|
| P1 | **Alta** | Las reglas «el equipo no compra / sesión invitada o perfil incompleto no compran» vivían solo en Next (`assertCanOrder`); la RPC `onza_command(create)` aceptaba a cualquiera con JWT (empleado, invitado, sin perfil) | Migración **021**: trigger `orders_guard_customer` + espejo `private.configuration.accounts_required` | `audit-permissions` «quién puede comprar» (3 pruebas; 8 fallan sin 021) | Corregido `9d240ab` |
| P2 | Media-alta | Resultados de pago simulados (rechazo, timeout, captura fallida) elegibles por RPC directa; `ENABLE_PAYMENT_SCENARIOS` solo se aplicaba en Next | 021: triggers `payments_guard_scenario` y `payment_operations_guard_scenario`; `allow_scenarios=false` por defecto | `audit-permissions` «pagos simulados cerrados» | Corregido `9d240ab` |
| P3 | Media | Un proyecto Supabase concede por defecto TODOS los privilegios a `anon`/`authenticated` en tablas nuevas de `public`; las de 001 solo agregaban `grant select`. La escritura la frenaba solo RLS (que no cubre `TRUNCATE`) | Migración **022**: revoca escritura, `TRUNCATE`, `REFERENCES`, `TRIGGER` | `audit-permissions` «catálogo de permisos» (4 fallan sin 022); el arnés ahora simula esos permisos | Corregido `08062f2` |
| P4 | Media | Un cliente leía `actor_id` (ids de empleados) y `metadata` (motivos, `previous_owner`) de los eventos de su pedido (tabla y RPC) | 021: `order_view` redacta para no-equipo; se cierra el `select` directo de `order_events` | `audit-permissions` «privacidad de eventos» | Corregido `9d240ab` |
| P5 | Media | La base valida la ruta de la imagen pero **no el host** (`update_venue_branding`, `update_product_image`): un admin podía apuntar a un host externo | `isOwnStorageUrl` en servidor + CSP `img-src` | `tests/lib/storage-url.test.ts` | Corregido `9d240ab`; la SQL sigue sin conocer el host (limitación) |
| P6 | Media | Sin `X-Frame-Options`/CSP: clickjacking posible | `frame-ancestors 'none'`, `base-uri`, `form-action`, `object-src 'none'`, `img-src`; `X-Frame-Options: DENY` | 0 violaciones CSP en `/`, `/v/…`, `/cuenta`, `/orders` | Corregido `9d240ab`. CSP de scripts completa: pendiente (necesita nonces) |
| P7 | Baja | Límite de cuerpo por `content-length` (omitible) | Lectura real del cuerpo (`readJson`) | `tests/lib/audit-log.test.ts` | Corregido |
| P8 | Baja/config | Auth: contraseña mínima de la API (6) menor que la de la UI (8); confirmación de correo no declarada | `supabase/hosted-auth-hardening.toml` (propuesta) | — | **Sin aplicar** (remoto) |
| P9 | Info | `service_role`: solo en `team-service.ts` (alta de equipo, cierre de clave temporal) y scripts de siembra; bundle público sin secretos | — | `scripts/audit/scan-secrets.mjs` | Verificado |
| P10 | Info | Registro: no había ninguno | `logEvent` + `x-onza-request-id`; Auth/Storage quedan en los logs de Supabase | `tests/lib/audit-log.test.ts` | Corregido |
| P11 | Baja | `platform_command(membership_save)` no comprueba que el destino sea cuenta laboral (solo lo usa Onza) | — | — | Abierto, riesgo bajo |
| P12 | Baja | `waitlist_command` mira `memberships` pero no `staff_accounts` (un ex-empleado sin locales puede unirse a una lista; no puede comprar: 021) | — | — | Abierto, riesgo bajo |
| P13 | Info | MFA para admin/Onza: no implementado | Propuesta | — | Abierto (decisión de producto) |

### Prioridad 3 · Pedidos

Sin hallazgos de duplicación: ver §6. Hallazgo operativo **O1** (PEN-005): el vencimiento y la auto-aceptación «retenida» dependen de que haya tráfico; configuración lista en `supabase/ops/pg_cron_auto_accept.sql`, **no aplicada**.

### Prioridad 4 · Migraciones

Sin hallazgos: ver §7.

### Prioridad 5 · Escala

| ID | Sev. | Hallazgo | Medición | Corrección | Estado |
|---|---|---|---|---|---|
| E1 | **Crítica para piloto** | `order_list(venue)` evaluaba `private.is_staff()` por cada pedido histórico del local (en cada refetch de cada dispositivo de barra) | 20 000 pedidos del local: **3 300 ms** por llamada; bajo carga el pool entero quedó ocupado (p95 29 s; espera de conexión p95 > 100 s; CPU de la base hasta ~900 = 9 de 10 núcleos) | Migración **023** | Corregido: **~105 ms** (explain) y p95 0,2 s bajo carga |
| E2 | Media | `sweep_orders()` sin índice para `deadline` (corre en cada comando y listado) | 8–11 ms → 0,3–0,4 ms con 20 000 pedidos | 023: índice parcial `orders_deadline_open` | Corregido |
| E3 | Media | `venue_summary_range` convertía a `integer` (desborda con ~4 800 pedidos de ₡4 500 en un rango: un mes de ~160 pedidos/noche) | Error `integer out of range` en cada informe del administrador de la carga | 023: `bigint` | Corregido |
| E5 | Media | Límite de `resolve` (validar retiros) de 10/min por cuenta: a 30 pedidos/min entre 3 empleados (10 c/u) ya se alcanza; 48 `RATE_LIMITED` legítimos en 15 min y retiros frenados | Corrida sostenida de 15 min | Migración **024**: 60/min (**decisión de seguridad a confirmar**; el código manual es de 48 bits y los intentos inválidos siguen contando) | Corregido; confirmado sin errores en `load-despues-024` |
| E4 | Abierto | Próximo cuello: `order_list(venue)` sigue siendo la consulta más cara (p95 0,2–0,4 s con ~50 pedidos activos) y se llama completa en cada evento de cada dispositivo | Ver §8 | Recomendado (no implementado): listar solo activos + últimos 20 cerrados, o refetch incremental del pedido que cambió | Abierto |

## 6 · Matriz de roles (verificada por `audit-permissions`)

✓ permitido · ✗ rechazado · (a) solo si cuentas no son obligatorias · «otro local» = empleado/admin de un local distinto.

| Acción | Sin sesión | Invitado | Cliente | Empleado | Admin | Otro local | Onza |
|---|---|---|---|---|---|---|---|
| Ver catálogo y locales | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Crear pedido | ✗ | (a) | ✓ (con perfil) | ✗ | ✗ | ✗ | ✗ |
| Ver / cancelar un pedido propio (cancelar solo en cola) | ✗ | ✓ | ✓ | – | – | – | – |
| Ver pedidos de otra persona | ✗ | ✗ | ✗ | ✓ (de su local) | ✓ (de su local) | ✗ | ✓ |
| Aceptar, marcar listo, validar retiro, cobrar y entregar | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ |
| Pausar el local; apagar auto-aceptación | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ |
| Encender auto-aceptación; capacidad, nombre, horario, abierto/cerrado | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ |
| Menú (guardar, agotar, archivar), portada, logo, imágenes | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ |
| Reembolsar, conciliar autorización, transferir retiro | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ |
| Resumen, tiempos e informes | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ |
| Equipo: listar, cambiar rol, quitar (no a sí mismo ni al último admin) | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ |
| Alta de equipo (service_role, tras comprobar admin del local) | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ |
| Crear locales y asignar membresías | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Funciones de alta/consulta de equipo, `auto_accept_tick` | solo `service_role` | | | | | | |
| Tablas: escribir directo | ✗ para todos los roles (solo funciones `SECURITY DEFINER`) | | | | | | |
| Leer perfiles, cuentas del equipo, `order_events`, esquema `private` | solo el dueño (perfil y cuenta); `order_events` y `private` ✗ | | | | | | |
| Storage `venue-images`/`menu-photos` | lectura pública; escritura: admin del local dueño de la carpeta `<local>/` | | | | | | |
| Storage `avatars` | solo la propia persona, carpeta `<usuario>/` | | | | | | |

Una **clave temporal pendiente** deja a la cuenta sin acceso aunque conserve su membresía, y una **sesión invitada** no cuenta como equipo aunque tuviera membresía.

## 7 · Concurrencia de pedidos (Postgres 17 real, pagos mock)

Cada operación en su conexión y transacción con JWT simulado (como PostgREST); los bloqueos son reales. `scripts/audit/concurrency.mjs`, 12 escenarios + invariantes tras cada uno:

| # | Escenario | Resultado |
|---|---|---|
| C1 | Dos operadores aceptan el mismo pedido a la vez | Exactamente 1 aceptación; el otro recibe `VERSION_CONFLICT` limpio |
| C2 | Doble clic: misma clave, 5 envíos simultáneos | Todas bien; un solo `accept` |
| C3 | Aceptar vs cancelar ×40 rondas | Nunca ganan los dos; estado final siempre coherente (preparando+autorizado, o cancelado+anulado una vez) |
| C4 | Aceptar un pedido vencido mientras corre el barrido ×20 | Vencido, una anulación, ninguna aceptación, **sin deadlocks** |
| C5 | Último cupo, 10 clientes | Exactamente 1 pedido; el resto `VENUE_CAPACITY`; activos == capacidad |
| C6 | Doble envío del checkout ×8 | Un pedido, un cobro mock; las 8 respuestas devuelven ese pedido |
| C7–C9 | Retiro: dos operadores validan a la vez; capturar ×4; entregar ×4; reembolsar ×2 | Un solo dueño del retiro; una captura; un `delivered`; un reembolso; el otro operador recibe `CLAIM_OWNED_ELSEWHERE` |
| C10 | Aceptación manual + aceptación automática + dos ticks, ×15 | Una aceptación por pedido, sin deadlocks |
| C11 | Agotar un producto mientras alguien pide | El pedido se rechaza `OUT_OF_STOCK` (se serializa por fila) |
| C12 | Un cupo liberado, dos en lista de espera | Solo el ofertado crea pedido |

Invariantes comprobadas (también al final de la carga): sin eventos `accept`/`delivered`/`created`/`ready` duplicados; sin operaciones de pago duplicadas; sin entregas sin cobro; sin capacidad superada.

**Qué se probó y qué no.** Probado: transiciones, idempotencia, cupo, stock, retiro, cobro/entrega/reembolso mock, auto-aceptación, vencimiento. No probado: reapertura de la app tras una interrupción real del navegador, reconexión de Realtime de la barra, y nada en Safari/iPhone/iPad físicos.

## 8 · Migraciones 013–024

`scripts/audit/migrations.mjs` (Postgres real con *stubs* de `auth`, `storage` y `realtime`, y los permisos por defecto de Supabase):

- **A. Base vacía → 024**: sin errores.
- **B. Salto desde 012 con datos en todos los estados + 100 000 pedidos históricos → 024**: sin errores; **30–30–112 ms en total según la corrida** (la más lenta, 018, 10–45 ms); pedidos, pagos y eventos intactos; un pedido en cola creado antes de 013 se acepta después (la lógica usa `coalesce(queued_at, created_at)`).
- **A ≡ B**: columnas, restricciones, índices, funciones (hash del cuerpo), políticas, triggers, permisos, RLS y publicaciones **idénticos** por ambos caminos.
- Notas: 015 (storage de avatares) y 006/002 se aplicaron sobre un *stub* de `storage`, no sobre Storage real. 021–024 son nuevas y **no están aplicadas en ningún proyecto remoto**. El SQL 001–020 no se modificó.

## 9 · Escala

**Qué se midió.** La capa de base de datos tal como la usa la app, sobre Postgres 17 real **en una máquina de desarrollo** (no un proyecto Supabase), con un pool acotado de 20 conexiones, pagos mock y datos ficticios: 25 000 pedidos históricos (5 000 «de esta noche»), 100 sesiones que exploran el catálogo cada 20–40 s, checkouts de Poisson con ciclo completo (aceptar → listo → validar → cobrar → entregar), tras cada cambio el refetch que haría la app (barrido + listado) en el cliente y en 3 dispositivos de barra, y un informe del administrador cada 30 s. Vida de cada pedido ≈ 2 min (≈ 60 pedidos activos a 30/min).

**Qué NO se midió.** Next.js (SSR, rutas), Supabase Auth, PostgREST, Realtime (conexiones, latencia de evento), Storage, la red, el hardware real de un proyecto Supabase, ni usuarios con teléfonos. Estos números sirven para comparar versiones y hallar el primer cuello; **no son una capacidad desplegada**.

### 9.1 Antes y después de la migración 023 (mismo commit de referencia, mismos datos, mismo pool de 20)

Corridas ejecutadas: fase corta de 1 min con 20 sesiones, fase **sostenida de 3 min** con 100 sesiones a 30 checkouts/min y **ráfaga de 1 min** a 60 checkouts/min (una pasada por versión; `docs/evidence/audit/load-antes-023.*` y `load-despues-023.*`). «Antes» = la cadena sin 023 (`--skip=202611210023`).

**Fase sostenida**

| Operación (p2-sostenida) | n antes | p95 antes (ms) | espera de pool p95 antes (ms) | n después | p95 después (ms) | espera de pool p95 después (ms) |
|---|---|---|---|---|---|---|
| checkout(create) | 82 | 55.6 | 26219.3 | 98 | 13 | 0.1 |
| accept | 83 | 73.4 | 165884.9 | 97 | 8.3 | 0.1 |
| ready | 91 | 111.8 | 173699.4 | 89 | 9.8 | 0.1 |
| resolve | 53 | 82.4 | 123972.6 | 86 | 8 | 0 |
| capture | 50 | 83.4 | 160583.7 | 79 | 7.2 | 0 |
| complete | 42 | 63.9 | 161270.8 | 79 | 6.9 | 0 |
| catalog.menu | 458 | 19.4 | 25896.8 | 620 | 2.3 | 0 |
| refetch.order_list(customer) | 240 | 52.2 | 147241.2 | 363 | 5.5 | 0 |
| refetch.order_list(venue) | 709 | 29276.3 | 136108.2 | 1089 | 199.5 | 0 |
| refetch.sweep | 992 | 52.5 | 28273 | 1452 | 2.3 | 0.3 |
| report.summary_range(night) | 4 | 413.7 | 7989.8 | 6 | 189.3 | 0.1 |

Antes: CPU p50/p95/máx 459/838/900; pedidos creados 159, entregados 93
Después: CPU p50/p95/máx 22/192/422; pedidos creados 191, entregados 124

**Ráfaga (60 checkouts/min)**

| Operación (p3-rafaga) | n antes | p95 antes (ms) | espera de pool p95 antes (ms) | n después | p95 después (ms) | espera de pool p95 después (ms) |
|---|---|---|---|---|---|---|
| checkout(create) | 60 | 71.2 | 87519.6 | 62 | 40.3 | 0.1 |
| accept | 22 | 32.2 | 70423.8 | 65 | 30.6 | 0.1 |
| ready | 16 | 106.7 | 89347.7 | 62 | 23.2 | 0.1 |
| resolve | 44 | 53.2 | 61653.9 | 45 | 22.3 | 0 |
| capture | 42 | 99.4 | 76534 | 44 | 13.8 | 0 |
| complete | 32 | 133.7 | 89125.2 | 44 | 17.9 | 0 |
| catalog.menu | 100 | 8.4 | 89989.3 | 215 | 9.6 | 0 |
| refetch.order_list(customer) | 142 | 43 | 85826.7 | 234 | 23.6 | 0 |
| refetch.order_list(venue) | 421 | 19578 | 89558.2 | 702 | 404.1 | 0 |
| refetch.sweep | 620 | 51.1 | 89516.2 | 936 | 15.8 | 0.6 |
| report.summary_range(night) | 1 | 298.1 | 85674.4 | 2 | 224.2 | 0 |

Antes: CPU p50/p95/máx 459/838/900; pedidos creados 159, entregados 93
Después: CPU p50/p95/máx 22/192/422; pedidos creados 191, entregados 124

La espera de pool de «antes» (decenas de segundos a minutos) es el efecto de una cola sin tiempo de espera del cliente: en la app real esas peticiones habrían vencido. El resumen del administrador del «antes» falló con `integer out of range` en cada llamada (E3).

### 9.2 Corrida con las duraciones del plan (después de 023)

Fase corta de 1 min (20 sesiones), **15 min sostenidos a 30 checkouts/min con 100 sesiones**, **3 min de ráfaga a 60/min** (`docs/evidence/audit/load-plan-completo.*`). Sin errores inesperados; el tope de 100 pedidos activos del local caliente produjo los rechazos funcionales esperados.

**Sostenida (15 min)**

| Operación | n | p50 (ms) | p95 (ms) | p99 (ms) | máx (ms) | espera de pool p95 (ms) |
|---|---|---|---|---|---|---|
| checkout(create) | 468 | 6.4 | 14.5 | 18.1 | 38.1 | 0.1 |
| accept | 451 | 4.9 | 8.1 | 10.3 | 32.6 | 0.1 |
| ready | 455 | 5.1 | 9.3 | 14.8 | 31.5 | 0.1 |
| resolve | 451 | 4.4 | 7.4 | 20.8 | 53.7 | 0 |
| capture | 403 | 3.9 | 6 | 9.7 | 31.2 | 0 |
| complete | 403 | 3.6 | 5.4 | 7.1 | 27.6 | 0 |
| catalog.menu | 3004 | 1.5 | 2.6 | 4.7 | 31.1 | 0 |
| refetch.order_list(customer) | 1760 | 3.1 | 6.2 | 11.1 | 48.9 | 0 |
| refetch.order_list(venue) | 5280 | 64.3 | 157.8 | 228.7 | 338.6 | 0 |
| refetch.sweep | 7040 | 1.1 | 2.6 | 6.2 | 33.6 | 0.3 |
| report.summary_range(night) | 30 | 79.8 | 94.4 | 182.3 | 182.3 | 0.1 |

**Ráfaga (3 min)**

| Operación | n | p50 (ms) | p95 (ms) | p99 (ms) | máx (ms) | espera de pool p95 (ms) |
|---|---|---|---|---|---|---|
| checkout(create) | 174 | 5.6 | 19.1 | 45.3 | 59.7 | 0.1 |
| accept | 94 | 5.7 | 11.9 | 46 | 46 | 0.1 |
| ready | 100 | 6.4 | 12.4 | 17.4 | 17.4 | 0.1 |
| resolve | 94 | 5.9 | 10.5 | 59 | 59 | 0 |
| capture | 89 | 5.2 | 9 | 14.3 | 14.3 | 0 |
| complete | 89 | 5.4 | 8.5 | 15 | 15 | 0 |
| catalog.menu | 621 | 1.7 | 3.6 | 9 | 15.8 | 0 |
| refetch.order_list(customer) | 376 | 4.2 | 10.9 | 19.1 | 55 | 0 |
| refetch.order_list(venue) | 1128 | 169.3 | 241.2 | 273 | 333 | 0 |
| refetch.sweep | 1504 | 1.4 | 4.3 | 10.8 | 53.2 | 0.4 |
| report.summary_range(night) | 6 | 235.1 | 320 | 320 | 320 | 0.1 |

- **Carga ofrecida:** 468 checkouts en la sostenida y 174 en la ráfaga; 577 pedidos creados en total y 492 entregados con su ciclo completo.
- **Rechazos funcionales (no son fallos):** resolve:RATE_LIMITED × 48; checkout(create):VENUE_CAPACITY × 17; resolve:RATE_LIMITED × 5; checkout(create):VENUE_CAPACITY × 81. Los `RATE_LIMITED` de `resolve` fueron el hallazgo **E5** (límite de 10 retiros por minuto y cuenta, alcanzado a la carga objetivo) → migración **024** (60/min, **decisión de seguridad a confirmar**): corrida de confirmación `load-despues-024.*` (4 min sostenidos + 1 min de ráfaga): **cero errores de cualquier tipo**.
- **Errores inesperados:** ninguno. **Duplicados, sobreventas o cobros inconsistentes:** ninguno (verificado al final de cada corrida).
- **CPU del servidor Postgres** (suma de procesos, 100 = 1 núcleo de 10): p50 28, p95 145, máx 439. **Esperas de Postgres**: casi todo CPU; sin esperas de bloqueo medibles (el bloqueo de fila del local caliente no apareció como cuello a esta carga).
- **Latencia de Realtime, conexiones WebSocket, tasa de recuperación tras caída:** **no medidas** (no hay Realtime en el entorno).
- **Metas del plan** (p95 lectura ≤ 500 ms, mutación ≤ 900 ms, < 1 % fallos inesperados, cero duplicados): cumplidas **en la capa de base de datos de esta máquina**; no se extrapolan a una instancia Supabase ni al recorrido completo con Next y PostgREST.

### 9.3 Primer cuello de botella observado y siguiente

1. **Observado primero (E1):** `order_list(venue)` por `private.is_staff()` en cada pedido histórico. Con 5 000–20 000 pedidos del local ocupaba el pool completo. Corregido (023).
2. **Siguiente (E4):** `order_list(venue)` sigue siendo la consulta más cara (≈ 60 ms de mediana, p95 0,15–0,25 s) porque cada refetch devuelve hasta 100 pedidos con su detalle completo, y se dispara en cada evento de cada dispositivo. A 30 checkouts/min (≈ 180 eventos/min × 4 dispositivos) consume ~1 núcleo de la base. Cambio recomendado, no implementado: devolver solo los pedidos activos y los últimos 20 cerrados (es lo que la cola muestra) o refetchear solo el pedido que cambió.
3. **Capacidad probada:** 100 sesiones + 30 checkouts/min sostenidos 15 min y 60/min por 3 min contra un local con tope de 100 activos, con 25 000 pedidos de historia, en la capa de base de datos. **Sigue sin medirse:** más de un local caliente a la vez, 1 000+ sesiones, crecimiento del historial por encima de 25 000 pedidos del mismo local, Realtime, Next/PostgREST y el hardware real de Supabase.

## 10 · Pendientes y bloqueos (con el paso exacto)

| # | Pendiente | Por qué | Para retomarlo |
|---|---|---|---|
| 1 | Cookies, refresh y expiración reales de Supabase Auth; revocación de sesión; Realtime | Sin Docker no corre Supabase local; no se usó `onza-dev` | Instalar Docker Desktop (o Colima), `npm run db:start && npm run demo:configure && npm run demo:seed-users`, y correr `npm run test:e2e:live` + adaptar `scripts/verify-audit-sesiones.mjs` para usar cuentas reales de ese entorno |
| 2 | Aplicar 021–024 | Migración remota: decisión aparte | En un **proyecto aislado**: `npx supabase db push --dry-run` (debe listar 013–024) → revisar → `db push`. Luego `update private.configuration set accounts_required=true` si la app usa `ACCOUNTS_REQUIRED=true` |
| 3 | Programador del barrido (PEN-005) | Activar `pg_cron` es un cambio remoto | `supabase/ops/pg_cron_auto_accept.sql` en staging; verificar `cron.job_run_details` |
| 4 | Endurecimiento de Auth | Cambio remoto | `supabase/hosted-auth-hardening.toml`, tras `config diff` |
| 5 | Safari/iPhone/iPad/Android físicos (cámara, audio, safe area) | No hay dispositivos | PEN-002 |
| 6 | Latencia de revocación en Realtime | Sin Realtime real | Con dos sesiones en staging: quitar la membresía de una y medir cuánto tarda en dejar de recibir eventos |
| 7 | CSP de scripts completa | Hay un script de tema en línea; necesita nonces | Evaluar `script-src` con nonce en `proxy.ts` |
| 8 | MFA para admin/Onza | Decisión de producto | Supabase Auth MFA (TOTP) con `aal2` exigido en `has_venue_access(admin_only=true)` |
| 9 | `scripts/verify-local-flow.mjs` está desactualizado respecto de la interfaz del rescate (el formulario de correo vive en un `<details>` y el panel de retiro cambió); su cobertura la dan `verify-pulido-e3` (cliente → barra → retiro) y los demás `verify-pulido-*` | No se comprobó contra la base si ya fallaba antes de esta rama | Actualizar sus selectores |
| 10 | Límite de `resolve` (10/min por cuenta) puede quedarse corto en una ráfaga de retiros de un solo empleado | Observado en la carga (7 `RATE_LIMITED` esperados) | Decidir el valor con el negocio; protege el código manual de 48 bits |

## 11 · Comandos para repetir

```bash
# Pruebas y calidad
npm run check                                   # tsc + eslint + vitest (incluye la matriz de permisos) + build
node scripts/audit/scan-secrets.mjs             # secretos y NEXT_PUBLIC_* (no imprime valores)
# Postgres real aislado (instalar una vez fuera del repo; ver scripts/audit/pg.mjs)
node scripts/audit/concurrency.mjs              # 12 escenarios concurrentes
node scripts/audit/migrations.mjs               # base vacía vs salto desde 012, con 100 000 pedidos
node scripts/audit/explain.mjs --history=20000  # tiempos de las consultas calientes
node scripts/audit/load.mjs --sessions=100 --checkouts=30 --minutes=15 --burst=60 --burst-minutes=3 --json=ruta.json
node scripts/audit/load.mjs … --skip=202611210023 # línea base «antes» de 023
node scripts/audit/compare-load.mjs antes.json despues.json p2-sostenida
# Navegador contra el servidor local simulado (README «Plan de pulido»: shim en :54321 y next dev en :3100)
ONZA_APP=http://127.0.0.1:3100 node scripts/verify-audit-sesiones.mjs
ONZA_APP=http://127.0.0.1:3100 node scripts/verify-pulido-all.mjs
```
