# Arquitectura propuesta

## Una aplicación, tres experiencias

Next.js App Router + React + TypeScript, Supabase Postgres/Auth/Storage/Realtime, CSS tokens + Tailwind para composición y primitivas accesibles. Zod valida entradas; tipos de Postgres generados. Vitest para dominio y Playwright para recorridos. Versiones estables compatibles al iniciar y lockfile; no fijar una versión imaginada en este kit. No hay código de aplicación preexistente que preservar.

Alternativas consideradas: SPA React con backend separado aumenta servicios sin aportar al demo; app nativa ahora duplica trabajo de interfaces; monolito modular web mantiene una sola operación y APIs reutilizables después. Se recomienda la tercera. La futura app iPhone podrá compartir contratos y backend, no necesariamente sus componentes de UI.

Las páginas de catálogo se renderizan en servidor con caché pública acotada; checkout, estado y paneles son privados, sin caché compartida. Carrito, escáner, Realtime, sonido y selectores son islas cliente. No marcar el layout completo como use client. [S15]

## Estructura del repositorio al construir

| Carpeta | Responsabilidad |
| --- | --- |
| `src/app/(customer)/` | Descubrimiento, menú, carrito, checkout, seguimiento |
| `src/app/(staff)/staff/` | Cola y retiro, con guard de sesión/local |
| `src/app/(admin)/admin/` | Menú, ventas, configuración |
| `src/app/api/` | Entradas HTTP finas; validar, autorizar y llamar servicios |
| `src/components/ui/` | Primitivas visuales y variantes compartidas |
| `src/features/catalog/` | Datos y componentes de catálogo |
| `src/features/orders/` | Reglas, queries, mutations y UI de pedidos |
| `src/features/pickup/` | QR, escáner y entrega |
| `src/features/payments/` | Contrato y adaptadores, solo servidor |
| `src/features/notifications/` | Avisos y preferencia de sonido |
| `src/features/analytics/` | Agregaciones con definiciones explícitas |
| `src/lib/supabase/` | Clientes server/browser y utilidades de sesión |
| `supabase/migrations/` | Esquema, RLS, índices y funciones versionadas |
| `supabase/seed.sql` | Semillas demo reproducibles, sin secretos reales |
| `tests/` | Dominio, permisos, integración y recorridos |

El dominio no importa React ni el SDK bancario. No duplicar una misma regla en componente, handler y webhook. Un handler no se convierte en un archivo de 1000 líneas. Evitar barrel exports amplios que arrastren librerías o secretos al cliente.

## Identidad y roles

Cliente normal: Supabase `signInAnonymously()` al necesitar una sesión para crear/consultar pedido, sin pedir email ni contraseña. Un invitado es un usuario autenticado con UID único; no confundirlo con acceso público de la anon key. Si borra datos o cambia de dispositivo, pierde ese acceso; convertir a cuenta permanente es fase posterior. No prometer recuperación con el código de retiro. [S16]

Staff y admin: Supabase Auth con usuario permanente y memberships por local. UID -> memberships -> rol y venue. No usar el role del navegador, user_metadata editable o un query param como permiso. RLS diferencia sesión anónima de personal autorizado.

Demo aislado: accesos alias `cliente`, `bartender`, `admin`; contraseña sugerida cliente/cliente y bartender/bartender solo en proyecto demo, si las políticas del proveedor lo permiten. Cliente puede entrar como invitado por defecto. No guardar credenciales en el repo: seed admin con variables de entorno; selector demo solo facilita una sesión verdadera. Añadir cliente-2 y bartender-2 para probar aislamiento. Admin demo no es administrador de producción. Un mismo navegador comparte sesión: usar perfiles/dispositivos distintos para distintos roles.

`DEMO_MODE` se valida en servidor. Nunca conceder acceso real por activar un switch de UI. Los roles de prueba y reset de datos no existen en producción. Para demo públicamente accesible, elegir enlace privado o credenciales fuertes; no basta con ocultar `/demo`.

Limitar creación de sesiones anónimas, pedidos y búsquedas de códigos por usuario/IP/local en servidor. Antes de publicar acceso abierto, habilitar las protecciones antiabuso/CAPTCHA de Auth que correspondan y limpiar sesiones demo abandonadas con una tarea documentada. No crear un usuario nuevo en cada carga; reutilizar la sesión existente. Una pausa o límite de capacidad se verifica de forma atómica al crear pedido; la UI deshabilitada no basta. Valores iniciales de demo: máximo 20 unidades por pedido y 30 pedidos activos por local, configurables.

## Modelo de datos mínimo

UUID como IDs, timestamps UTC, timezone del local `America/Costa_Rica`, moneda CRC inicial. Montos enteros en unidad menor (`amount_minor`); ₡5.000 se representa como 500000 si la unidad menor del contrato es centésimos. Conversión se hace solo en un Money helper/adapter. Nunca floats para dinero. La exigencia exacta de unidades del gateway se define en su manual.

| Entidad | Campos principales / invariantes |
| --- | --- |
| venues | id, slug único, name, timezone, currency, open_state, paused, pickup_label, eta_minutes, capacity, support_contact |
| memberships | user_id, venue_id, role; clave única de esa relación |
| categories | id, venue_id, label, position |
| products | id, venue_id, category_id, name, description, price_minor, photo_path, available, size, allergens, version |
| orders | id, venue_id, customer_id, public_code, status, total_minor, currency, version, created/preparing/ready/delivered_at, business_date, deadline |
| order_items | order_id, product_id, name_snapshot, unit_price_minor_snapshot, quantity, line_total_minor |
| payments | id, order_id, provider, merchant_config_ref, status, authorized/captured/refunded_minor, provider_reference, expires_at |
| payment_operations | id, payment_id, type, idempotency_key, status, provider_reference, timestamps; unicidad de comando |
| order_events | id, order_id, venue_id, actor_id, type, from/to_status, timestamp, metadata limitada |
| pickup_tokens | order_id, token_hash, encrypted_token, expires_at, consumed_at; tabla sin acceso directo al cliente |
| pickup_claims | order_id único, owner_user_id, owner_staff_session_id, claim_hash, status, claimed_at; un solo responsable de entrega |
| notifications | order_id, event_id, channel, status, attempted_at; clave única por evento/canal/destino |
| policy_acceptances | order_id, customer_id, terms_version, privacy_version, timestamp |

`products.category_id` y `order_items.product_id` deben pertenecer al mismo venue que el pedido/categoría: garantizar con claves compuestas/constraints o función transaccional, no solo en frontend. El precio snapshot permite editar menú sin reescribir historia. Productos con pedidos históricos se archivan, no borran en cascada.

No guardar datos de tarjeta ni cuerpos completos de respuestas bancarias. `provider_reference` es opaco. Últimos cuatro dígitos y marca solo si el acuerdo permite guardar esa metadata y hay necesidad real. `merchant_config_ref` señala a un secreto del servidor; no contiene una llave bancaria.

Índices iniciales: orders(venue_id,status,created_at), orders(customer_id,created_at), products(venue_id,category_id,available), order_events(order_id,created_at), payments(order_id), payment_operations(idempotency_key único). Paginación por cursor o límite explícito. Eventos append-only para staff/cliente.

## Lecturas y escrituras

Catálogo publicado: lectura pública de campos seguros mediante vista/proyección. Pedidos: cliente solo los propios; staff/admin solo venues asignados. Onza superadmin mediante permiso server-side explícito y auditado. No exponer un SELECT global de usuarios, pagos, tokens o membresías.

Todas las escrituras operativas pasan por servicio de backend y función transaccional cuando corresponda. Clientes no actualizan directamente `total`, `status`, `captured_minor` o membership. RLS habilitada en cada tabla expuesta y Storage; probar tanto SELECT como INSERT/UPDATE/DELETE. La service_role, si es necesaria, solo en servidor con verificación de actor/local antes de cada operación. [S17]

### API propuesta de Onza, no API de BAC

| Operación | Contrato mínimo |
| --- | --- |
| POST `/api/orders` | product IDs, quantities, venue, expected menu versions, policy versions, idempotency key; backend calcula total |
| GET `/api/orders/:id` | Resumen autorizado, pago resumido, timestamps, versión y próximo paso |
| POST `/api/orders/:id/accept` | Staff del venue + expected_version; queued -> preparing |
| POST `/api/orders/:id/ready` | Staff + expected_version; preparing -> ready; evento y outbox |
| POST `/api/orders/:id/cancel` | Actor autorizado, motivo, expected_version; no captura competidora |
| POST `/api/pickups/resolve` | Staff + token/código; devuelve resumen limitado del pedido correcto |
| POST `/api/pickups/:orderId/capture` | Staff, pedido listo, token válido, idempotency key; orquesta captura |
| POST `/api/pickups/:orderId/complete` | Staff, cobro confirmado; confirma entrega sin volver a cobrar |
| POST `/api/payments/provider-events` | Solo al integrar proveedor; validación exacta definida por gateway |

Errores tipados: PRICE_CHANGED, VENUE_PAUSED, OUT_OF_STOCK, NOT_AUTHORIZED, INVALID_TRANSITION, PAYMENT_UNCONFIRMED, ALREADY_DELIVERED, EXPIRED, RATE_LIMITED. HTTP 409 para conflicto de estado/precio; 403 para permiso; 422 para entrada inválida. La UI traduce, no muestra stack traces ni referencias bancarias completas.

## Máquina de estados

Pedido persistido `pending_authorization` -> `queued` -> `preparing` -> `ready` -> `delivered`. Terminales alternativas `canceled`, `expired`, `uncollected`. Si no se autoriza, queda canceled/payment_failed con evento; no entra a cola. Registrar aceptación/preparación juntas en v1.

Pago: `authorizing`, `authorized`, `capture_pending`, `captured`, `void_pending`, `voided`, `failed`, `unknown`, `refund_pending`, `refunded`. Un fallo de intento no invalida un cobro confirmado anterior. La expiración de autorización no borra un cobro capturado.

Reglas críticas: preparing requiere authorized; ready no captura; delivered requiere captured y registro físico de entrega; cancelar o expirar requiere que no haya captura confirmada ni competidora sin resolver. El estado de pedido y el de pago se consultan por separado; canceled + void_pending es posible y se muestra como liberación solicitada.

## Idempotencia y QR

1. Crear pedido y snapshots en transacción; clave idempotente vinculada a actor y hash de contenido. Repetir misma clave/mismo contenido devuelve mismo resultado; mismo key/diferente carrito se rechaza.
2. Autorización asíncrona mediante adapter. Confirmar resultado de servidor/proveedor, nunca solo redirect del navegador. Registrar operation_id y key antes de llamar. Si se pierde respuesta antes de conocer referencia, consultar por identificador/idempotencia si el gateway lo admite; si no lo admite, queda unknown y revisión/conciliación manual. No repetir automáticamente para conseguir una referencia.
3. Para retirar, token aleatorio de al menos 128 bits. Guardar digest para búsqueda y una copia cifrada, accesible solo al backend, para reconstruir ticket tras refrescar. No almacenar plaintext en logs ni enviarlo a analítica. Una clave de cifrado se administra en secretos; se versiona y puede rotar. El código corto es alternativa rate-limited, no secreto suficiente por sí solo.
4. Resolve/capture comprueban usuario staff, venue, estado, expiración y token. Un claim atómico crea/reutiliza una sola operación capture_pending y asigna un responsable de entrega a una sesión staff de dispositivo, no solo al usuario compartido. La prueba del claim se mantiene en cookie/estado seguro de esa sesión. No mantener una transacción de DB abierta mientras responde el banco.
5. Capturar usando la misma referencia/idempotencia admitida por el gateway. Si no hay idempotencia nativa, el adapter usa registro durable y consulta del estado; no reintenta la operación financiera a ciegas.
6. Captura confirmada -> “Podés entregar” solo al propietario del claim. Los demás ven “Otra persona está atendiendo este retiro”, sin permiso de entrega. Complete exige actor, sesión y prueba del claim, consume token y deja evento. Repetir complete devuelve el resultado previo. Una sola escritura delivered no basta para impedir doble entrega física: también se necesita ese único responsable.
7. Si se corta después de capturar, reconciliar y retomar el claim original. No recobrar ni anular como no-show. Un supervisor puede transferir el claim solo tras verificar si ya se entregó físicamente; registrar motivo/actores. No liberar automáticamente un claim luego de captura o resultado unknown. Antes de cualquier operación financiera, un claim abandonado puede expirar de forma segura con plazo propuesto 2 minutos. Si ya hubo entrega física pero faltó complete, resolver manualmente: ningún sistema puede deducir ese hecho solo del estado del pago.

## Realtime y avisos

Postgres Changes con RLS y filtros de order/venue; el filtro no sustituye el permiso. Un cliente escucha sus pedidos, un staff las órdenes activas de su local. No canal global con todos los pedidos. Un solo canal consolidado por vista, suscripciones limpias al desmontar y refetch al reconectar/volver al foreground. [S18]

DB es la fuente de verdad. Realtime es señal de refresco, no garantía de entrega. Si se desconecta, mostrar “Reconectando” y usar refetch espaciado solo con la página visible. No polling cada segundo para todo el catálogo. En celular bloqueado no prometer polling.

Evento ready y fila de notification outbox se crean en la misma transacción. En demo, la pantalla reconoce event_id y reproduce un aviso una sola vez por dispositivo; las filas de servidor no afirman reproducción. En push/SMS futuro, un worker lee outbox con retries idempotentes, registra enviado/fallido/entregado cuando exista evidencia y permite recuperación tras reinicio.

## Analítica y fecha de negocio

`business_date` se calcula en servidor según timezone y corte propuesto 06:00 local; no agrupar toda la noche por medianoche UTC. Siempre mostrar rango/huso usado. Ingresos netos de cobro = captured - refunded, separados de reservas. Unidades entregadas provienen de pedidos delivered y sus snapshots. Mediana preparación = ready_at - preparing_at; informar N y excluir faltantes, no tratarlos como cero. Venta de producto y cobro neto general pueden diferir por incidencias/devoluciones; mostrar conciliación, no forzar igualdad.

## Cloud, performance y PWA

Supabase Free sirve para desarrollo/demo pequeño: 500 MB DB, 1 GB Storage y pausa por inactividad publicados; Realtime tiene cuotas propias. No es un compromiso de capacidad ni SLA para una noche de operación. Medir concurrencia y mensajes antes de piloto, y exportar/migrar datos con respaldo. [S19-S20]

### Hosting: Cloudflare Workers

Next 16 corre en Workers con `@opennextjs/cloudflare` (flags `nodejs_compat` y `global_fetch_strictly_public`). Vercel sigue publicado hasta el cambio de dominio. No crear servicios pagados sin instrucción.

| Pieza | Cómo corre en Workers |
| --- | --- |
| `src/proxy.ts` | Middleware de Node: soporte **experimental** del adaptador. Hace `auth.getUser()` y, según el caso, `rpc("current_account")`. Plan B: `src/middleware.ts` en edge |
| Ticket de retiro y QR | Sin cambios: `node:crypto` (AES-256-GCM) y `qrcode.toDataURL` funcionan con `nodejs_compat` |
| `next/image` | Todas las imágenes son `unoptimized`: no se usa el binding de Images. `src/lib/storage-url.ts` y la CSP no cambian |
| Headers | Páginas y APIs: `headers()` de `next.config.ts`. Estáticos: `public/_headers` |
| Realtime | El navegador se conecta directo a Supabase; el Worker no participa |
| Origen (CSRF) | Solo `APP_ORIGIN`, uno por entorno |
| ID de correlación | `cf-ray` |
| Caché | Sin caché incremental: las páginas son dinámicas |
| Variables | `scripts/cf-build.mjs` evita que los `.env*` viajen dentro del bundle |

Sin medir: el tiempo de CPU por petición en Cloudflare (el plan Free admite 10 ms).

Presupuestos propuestos, a verificar con build y móvil: JS inicial cliente propio y dependencias <200 KB gzip por ruta de catálogo; cada foto de lista <100 KB; LCP <2,5 s, INP <200 ms y CLS <0,1 en medición representativa. Son objetivos, no resultados obtenidos. Cámara, gráficos y animación se cargan por ruta/acción. Una fuente WOFF2 local; imágenes dimensionadas, hero prioritario y resto lazy. Convertir variantes antes de subir: las transformaciones de imagen de Supabase no se asumen incluidas en Free.

PWA: manifest, iconos y acceso desde pantalla de inicio; service worker solo tras asegurar invalidación. Cachear assets públicos versionados y shell offline; no cachear respuestas privadas, pagos, carrito confirmado ni estados de pedido. Offline: permitir ver shell y explicar desconexión; no aceptar pedidos ni generar una falsa entrega. La cola de pedidos offline y background sync quedan fuera de v1.

## Observabilidad y operación

Logs estructurados con correlation_id, order_id y tipo de operación; redactar secretos, token QR y PII. Guardar error codes y tiempos, no payloads de tarjeta. Métricas: latencia de confirmación, fallos de autorización/captura, pedidos atascados, desconexiones, ready sin recogida y diferencias de conciliación. /health solo devuelve estado técnico mínimo.

Entornos separados demo/staging/producción. Migraciones reproducibles, CI con typecheck/lint/tests/build, backups y prueba de recuperación antes de operar dinero. La recuperación de pago desconocido y la caducidad de pedidos requieren tarea durable programada; nunca un setTimeout de una pestaña. En demo sin scheduler, correr un barrido idempotente al consultar/mutar y mostrar ese límite; para piloto programar tarea backend y probarla con navegador cerrado.
