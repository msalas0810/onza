# Estado de implementación · Onza local

Fecha de trabajo: 16 de noviembre de 2026 (America/Costa_Rica).

**Hito actual:** carrito/contexto, retiro seguro, Realtime y composición compartida implementados y probados contra `onza-dev`. Migraciones 005–007 ya estaban aplicadas; únicamente 008/009 se aplicaron en esta sesión. El registro de pendientes de imágenes inferior es histórico. Ver [verificación del hito](hosted-ux-verification.md) y D-2026-11-16-04 del diario. Publicación y Preview se registran al cierre.

**ACTUALIZACIÓN ALOJADA: conexión y flujo real ya verificados; ver sección final de esta continuación. Los bloqueos de Supabase/Docker descritos debajo son el registro histórico de la ejecución local anterior.**

**Estado general anterior: implementación de las seis áreas escrita; aceptación multiusuario pendiente por bloqueo externo.** La etapa 1 está verificada. Las etapas 2–6 no se declaran terminadas por tener interfaz: requieren ejecutar Supabase real, sus servicios y el guion entre sesiones. No se reemplazó esa persistencia por navegador.

## Etapa 1 — verificada localmente

- Funciona: Next/React/TypeScript strict, marca SVG original, Inter local, tokens claro/oscuro, tema antes del render y componentes compartidos. `/design-system` disponible en desarrollo, 404 en producción salvo habilitación explícita.
- Archivos: `src/app/layout.tsx`, `src/app/design-system`, `src/components/ui`, `src/styles`, `public`, configuraciones y lockfile.
- Pruebas: typecheck/lint/build exit 0; 11 pruebas Playwright de temas, 360/390/430/768/1280 px, reduced motion, targets, foco y preferencia persistente. Inspeccionadas visualmente capturas móvil oscuro y checkout de escritorio.
- Pendiente: VoiceOver y teléfonos físicos. Fotos licenciadas no incluidas; fallback exigido por el kit.
- Siguiente tarea exacta: volver a inspeccionar catálogo y operación renderizados después de conectar Supabase.

## Etapa 2 — implementada; integración externa pendiente

- Funciona en pruebas SQL: esquema multi-tenant, constraints, RLS, índices, seed reproducible y tipos generados desde las migraciones. Catálogo servidor, búsqueda/detalle, Auth invitada al checkout y login permanente con memberships por local. Onza global se concede únicamente mediante provisioning explícito y deja auditoría.
- Archivos: `supabase/migrations/202611150001_core.sql`, `202611150002_realtime_storage.sql`, `202611150003_platform.sql`, `supabase/seed.sql`, `src/lib/supabase`, `src/proxy.ts`, `src/features/catalog`, `src/app/v`, `scripts/seed-users.mjs` y `configure-local.mjs`.
- Pruebas ejecutadas: PostgreSQL WASM/PGlite con roles anon/authenticated y claims simulados. Cliente A no lee B; invitado no es staff; staff A no lee/muta B; escritura directa de montos/memberships denegada. Typecheck/lint/build pasan.
- Pendiente: migración 002 de Realtime/Storage, GoTrue/Auth y pgTAP sobre Supabase real. Los tests PGlite no sustituyen esos servicios.
- Siguiente tarea exacta: instalar/abrir Docker o Podman, comprobar `docker info`, luego `npm run db:start`, `npm run demo:configure`, `npm run demo:seed-users`.

## Etapa 3 — implementada; recorrido persistente real pendiente

- Funciona en pruebas SQL: pedido único por actor/key/payload, cantidades y total recalculados, precios/versiones/disponibilidad/capacidad verificados en DB, snapshots y aceptación versionada de políticas. Reserva approved/declined/requires_action/unknown sin tarjeta. El intento de checkout conserva key tras pérdida de red. Historial, detalle por ID y ticket se reconstruyen desde servidor.
- Archivos: `src/features/orders`, `src/features/payments/server`, `src/app/cart`, `checkout`, `orders`, `api/commands`, `api/orders`, `policies`.
- Pruebas ejecutadas: create-order, adversarial y recovery; mismo key retorna ID previo, cambio de payload conflicto, precio cambiado/agotado/otro local rechazados, timeout no reautoriza, conciliación supervisada simulada conserva una sola operación authorize. Carrito/checkout y ausencia de campos de tarjeta verificados en navegador.
- Adaptación: el mock financiero es un ledger transaccional SQL durable (`private.payment_operations`), en vez de un proveedor con memoria de proceso. `BacPaymentProvider` implementa el contrato y falla explícitamente; no hay endpoints bancarios inventados. La API usa `/api/commands` tipada en lugar de duplicar un handler por verbo del dominio.
- Pendiente: refresco y recuperación del pedido con cookies de Supabase reales, ejecución del doble submit HTTP preparado en E2E.
- Siguiente tarea exacta: con Supabase conectado, crear un pedido desde perfil cliente y refrescar `/orders/[id]`.

## Etapa 4 — implementada; sincronización real pendiente

- Funciona en pruebas SQL: transiciones controladas, aceptar/cancelar con versión, ready sin captura, rechazo con motivo, caducidad/no-show idempotentes, outbox ready único. Cola FIFO en desktop y tabs móviles, pausa, incidencias e historial. Suscripción filtrada con RLS, cleanup, refetch visible/reconexión y respaldo cada 15 s. Cambios financieros señalan también la fila pública de pedido.
- Archivos: `src/features/staff/components/queue.tsx`, `src/features/orders/use-live-orders.ts`, `src/features/notifications`, ruta `/staff/[venueId]` y RPC `sweep_orders`.
- Pruebas ejecutadas: transitions, expiración y outbox único. No se afirmó sincronización de Realtime real.
- Pendiente: dos perfiles actualizándose vía Realtime y audio permitido por navegador. El barrido demo ocurre con tráfico autorizado, hasta 100 vencimientos por invocación; no hay scheduler sin tráfico. Un piloto necesita tarea durable backend.
- Siguiente tarea exacta: cliente en perfil A y barra en B; aceptar, preparar y Listo, cortar/restaurar red y volver a primer plano.

## Etapa 5 — implementada; concurrencia entre conexiones y cámara pendientes

- Funciona en pruebas SQL/crypto: token de 256 bits, SHA-256, copia AES-256-GCM reconstruible, QR, código manual limitado incluso en fallos, claim ligado al session_id de Auth. Captura mock una vez, timeout-after-success reconciliable, unknown conserva claim. Solo dueño confirma entrega física; supervisor transfiere tras verificación física auditada. Captura rechazada permite cancelación supervisada con anulación; devolución repetida no duplica operación.
- Archivos: `src/features/pickup`, `private.pickup_tokens`, `pickup_claims`, `payments`, `payment_operations`; escáner cargado al abrir, stream cerrado al desmontar y fallback manual.
- Pruebas ejecutadas: dos sesiones simuladas sin permiso compartido de entrega, QR alterado/otro local/vencido, no entregar sin captura, repetición capture/complete, recuperación post-cobro, token alterado y BAC/real flag fallan cerrados.
- Pendiente: concurrencia PostgreSQL entre conexiones reales (PGlite serializa en una conexión), cámara/audio/permisos físicos y prueba E2E de fallback. E2E real preparado con dos logins independientes del mismo bartender y peticiones en paralelo.
- Siguiente tarea exacta: ejecutar `npm run test:e2e:live` contra Supabase demo desechable, luego probar retiro en iPhone/Safari y Android físicos.

## Etapa 6 — implementada; aceptación integral pendiente

- Funciona en pruebas SQL: menú editable, precio/categoría/tamaño/alérgenos/disponibilidad/archivo, snapshots históricos intactos; ajustes de local, carga de fotos con políticas por local. Resumen por fecha operativa 06:00 Costa Rica, capturado/devuelto/reservado separados, unidades entregadas y mediana con N. Actualiza al cambiar pedidos. Onza configura locales y personal existente con acceso global auditado.
- Archivos: `src/features/admin`, `src/features/analytics`, `src/app/admin`, `src/app/onza`, `api/summary`, `api/platform`, CONTRIBUTING.md, `.github`, docs/github-vercel.md y README.
- Pruebas ejecutadas: guion completo SQL cliente→barra→retiro→entrega→ventas, corte de medianoche/06:00, devoluciones y aislamiento. Build de todas las rutas, lint sin errores y typecheck.
- Pendiente: ejecutar el guion real de punta a punta, validar Storage y vistas operativas con DB conectada; revisar todas las pantallas en teléfonos físicos; serie de 6 fotos licenciadas para aprobación visual final. CI preparado, no ejecutado en GitHub.
- Siguiente tarea exacta: completar el setup externo y correr `npm run test:e2e:live`, `npm exec supabase -- test db`; registrar resultados, no solo los esperados.

## Bloqueo externo confirmado

`npm exec supabase -- status` devolvió exit 1: `docker: command not found (podman also not found) — install Docker Desktop or Podman and ensure it is on PATH`. No hay proyecto enlazado (`linked_project:null`) ni `.env.local` preexistente. Se instaló la CLI solo como dependencia de desarrollo del repo. No se instaló Docker ni se contrataron recursos.

## Checkpoints y límites

Git local en `feat/local-mvp`, identidad preexistente respetada, sin cambios de configuración global. Sin remoto, push ni despliegue. Pagos exclusivamente simulados. No se afirma certificación bancaria, depósitos, SMS/push, funcionamiento en iPhone bloqueado ni cumplimiento de métricas web sin medir.

Revisión hecha por el mismo agente conforme al pedido explícito de trabajar solo; no hubo revisión independiente ni subagentes. Las pruebas reales omitidas permanecen pendientes, no aprobadas.

## Evidencia final

- `npm run check`: typecheck + lint + 22 pruebas SQL/dominio + build, exit 0 antes de optimizar carga. Después de optimizar: typecheck/lint/build exit 0 y nueva prueba del parser de carrito exit 0; ejecución final completa registrada abajo.
- Playwright: 16 pasaron / 2 omitidas explícitamente (guion Supabase real y cámara en barra autenticada). Ambos temas, 360/390/430/768/1280 en componentes y 390/1280 en checkout. Repetición final tras optimización registrada abajo.
- Build de producción: smoke test `/`, `/checkout`, `/login` 200, `/api/health` 200, `/design-system` 404. Node ejecutado por scripts: 24.22.3.
- npm audit tras override acotado de minimatch en typescript-estree: 0 vulnerabilidades reportadas. Lint del override probado. No se cambiaron versiones globales.
- Evidencia guardada en `docs/evidence/`: capturas y medición de bundles. `/` sin DB: 292432 → 188666 bytes gzip. Checkout 350020 y login 257751; sin promesa de presupuesto para el catálogo conectado ni métricas web físicas.
- Se conservó el plan, las decisiones y la revisión propia en docs/local-execution-plan.md y docs/review-notes.md. Git local con main base y feat/local-mvp; no remoto.

### Cierre de verificación posterior a optimización

- `npm test`: **11 archivos, 23 pruebas pasaron**, exit 0 (suite completa posterior a optimizar).
- `npm run test:e2e`: **16 pasaron, 2 omitidas** por ausencia de Supabase real, exit 0. Capturas móviles y escritorio actualizadas en docs/evidence. No se atribuyen los resultados a teléfonos físicos.
- `npm run typecheck` y `npm run lint`: exit 0 sin warnings de código. `npm run build`: exit 0 después de los últimos cambios de UI.
- Typecheck adicional de un checkout limpio del commit (sin .next) ejecutado, exit 0; las dependencias se compartieron por symlink únicamente para ese control local.
- Último checkpoint de código: `2fc5335` (aplicación, SQL, pruebas y setup). Commit posterior incorpora documentación, CI y evidencia final. No hay remoto configurado. `main` conserva el kit base para integración posterior; el trabajo está en `feat/local-mvp`.
- No se inició ningún recurso cloud ni se instaló Docker. El servidor de smoke test se cerró. Para usar la app: ejecutar los pasos del README.

## Continuación alojada — accesos en comprobación

- Rama nueva `fix/hosted-integration` desde `cd0faa6`; ramas y commits previos conservados.
- Supabase CLI lista `onza-dev`, ref `ukdjuubekpanizcmppod`, organización `Onza` (`uczkkbsouopgwhqpvzyw`), ACTIVE_HEALTHY. La lectura administrativa de PostgreSQL se comprueba separadamente; las API keys no se toman como prueba de administración.
- Git no autentica contra el remoto solicitado. Conector GitHub identifica msalas0810 pero devuelve 404 para msalas0810/onza. Se instaló gh desde Homebrew para completar OAuth en Terminal; no se cambiaron credenciales ni se hizo push.
- Sin modificaciones remotas hasta confirmar ambos accesos. Script configure-hosted.mjs preparado para verificar identidad y guardar credenciales en .env.local (0600), sin imprimirlas ni sobrescribir archivos existentes.
- Siguiente tarea exacta: completar `gh auth login --hostname github.com --git-protocol https --web`, verificar repositorio privado y permiso de push, terminar la lectura administrativa de Supabase y después ejecutar el setup alojado.


## Cierre de la conexión alojada y verificación real

- Repositorio confirmado privado `msalas0810/onza`, permiso ADMIN mediante gh/OAuth completado por el usuario. Remoto inicialmente vacío. `main` avanzó por fast-forward a `cd0faa6` y se publicó; `feat/local-mvp` conservada y publicada. Correcciones separadas en `fix/hosted-integration`; sin merge automático ni force push.
- Proyecto administrativo confirmado por CLI: `onza-dev`, ref `ukdjuubekpanizcmppod`, organización Onza `uczkkbsouopgwhqpvzyw`. Consulta de lectura y consulta como postgres con CREATE=true verificadas antes de migrar; no se confundieron API keys con permisos de administración.
- `.env.local` guardado con modo 0600 e ignorado por Git. Claves obtenidas en memoria; passwords demo y AES generados sin imprimir. No fue necesario ingresar valores manuales. Auditoría inicial: 176 blobs históricos, sin patrones de credenciales detectados.
- Aplicadas migraciones 001/002/003 nuevas, seed ficticio idempotente y cuatro cuentas con memberships. No se ejecutó reset. Auth se actualizó con un config mínimo: invitado anónimo y URLs locales; nueve propiedades no declaradas quedaron intactas. No se cambió exposición automática ni esquemas API.
- Migración 004 nueva: revoca tablas/secuencias/funciones privadas para anon/authenticated, conserva solo los predicados RLS requeridos, activa RLS privado. No altera los defaults globales de la plataforma. Flujo real volvió a pasar después de aplicarla.
- E2E real: **2/2 pasaron**, sin omisiones en esa ejecución: cliente invitado → reserva mock → barra → aceptar/preparar → listo y actualización → persistencia al refrescar → QR disponible/código → retiro concurrente con un responsable → timeout de captura exitoso → conciliación → replays paralelos sin doble cobro → entrega repetida idempotente → resumen admin. Fallback manual sin escáner también pasó. No equivale a cámara física.
- Script de seguridad alojada: **19/19 controles pasaron**. Incluye propietario/otro cliente, RLS y backend, intento de cambiar total y autoasignar rol, bartender de otro local, edición/restauración de disponibilidad por admin, pausa/restauración y rechazo del cliente durante pausa. Pedido de prueba se canceló sin borrarlo.
- SQL/dominio: **23/23 pasaron** incluyendo la migración 004 en el harness. Typecheck/lint/build pasaron después de los cambios. No se repitieron suites locales que no dependían de los cambios de conexión.
- Inspección visual conectada: **28 vistas**, 390/1280 px, claro/oscuro, cliente (incluido /orders y /login), barra y admin. 0 desbordes, 0 errores de ejecución observados. Ajustados espacio de acciones del menú, márgenes desktop y mediana menor a un minuto. Capturas con códigos ocultos en `docs/evidence/hosted/`; no contienen QR de retiro ni passwords.
- React/use: **no reproducido después de conectar Supabase**. Mensaje histórico aportado por el usuario: “This library called use() to suspend in a previous render but did not call use() when it finished. This indicates an incorrect use of use().” Se observó antes de conectar, ruta no confirmada entre /, /orders y /login. No se presenta como corregido y no se hicieron cambios especulativos para ese mensaje.
- Una consulta de auditoría administrativa devolvió 401 transitorio; se revalidó la sesión listando proyectos y repitiendo la consulta. Resultado final: private_rls_enabled=true, private_tables_denied=true y private_view_denied=true. Esto se distingue del funcionamiento de API/Auth de la aplicación.
- Pendientes físicos: Safari/iPhone y Android reales, cámara/sonido, VoiceOver, alertas en segundo plano (no prometidas) y fotografías licenciadas. Storage tiene bucket/políticas instalados, pero no se cargó fotografía final ni se afirma aceptación visual fotográfica. No hubo despliegue Vercel, banco real, recursos nuevos ni pago real.
- Siguiente tarea exacta: revisión humana de `fix/hosted-integration` y pruebas físicas; si reaparece React/use, registrar ruta y reproducción exactas antes de modificar código. No fusionar automáticamente.

### Prueba específica de Realtime y publicación final

- `verify-hosted-realtime.mjs`: suscripción WebSocket SUBSCRIBED y evento Postgres `preparing` recibido en la sesión del cliente después de una acción de otra sesión de barra, **sin polling**. Pedido ficticio cancelado por admin al cerrar; evidencia en realtime-check.json.
- Escaneo exacto de secretos de `.env.local` contra 190 blobs históricos antes del último hito: 0 coincidencias, sin imprimir valores. `.env.local` sigue ignorado y no forma parte de los commits.
- Correcciones y evidencia publicadas en `fix/hosted-integration`. `main` permanece en `cd0faa6`; no hubo merge automático, force push ni despliegue. GitHub Actions estaba en curso al cerrar esta comprobación; no se declara verde sin resultado final.

## Despliegue Vercel solicitado · 16 de noviembre de 2026

- Rama vigente verificada: fix/hosted-integration, commit 757d032. main está en código anterior y no se desplegará como fuente de este demo. Sin merge automático.
- Proyecto Vercel creado: onza-demo (prj_ESobIM57nGYOpNXDhqMAo8Y163md), equipo msalas0810s-projects. Next.js, raíz del repositorio, npm ci / npm run build, Node 24. No se contrató plan ni recurso pagado.
- PENDIENTE reportado por el usuario: en su prueba no apareció código de retiro y la entrega no requirió validación. Esa validación NO se considera comprobada para su experiencia; no se amplía este despliegue para resolverla. Las pruebas técnicas anteriores no cierran esta incidencia.
- Acceso a CLI Vercel en comprobación para transferir secretos localmente sin imprimirlos. No se transferirán service_role ni passwords demo al runtime Vercel.

### Resultado del Preview HTTPS

- URL estable: https://onza-demo-msalas0810.vercel.app
- Deployment verificado: dpl_GhMAnUhAvjXno4KpKj7mYyemghw4, READY, entorno Preview (API target staging), rama fix/hosted-integration, commit ee82a7bbf153e5033ea90c540b700d50cb1e169c. URL inmutable: https://onza-demo-137btt61g-msalas0810s-projects.vercel.app. main no fue desplegada ni fusionada.
- Un build automático inicial se creó con target production y fue cancelado; el deployment elegido se creó explícitamente como Preview. La rama production configurada del proyecto sigue siendo main; no se disparó un build de main.
- Raíz '.', Next.js, Node 24, npm ci / npm run build. Git conectado a msalas0810/onza. Nueve variables solo para Preview y rama fix/hosted-integration; secretos transferidos por stdin sin imprimirlos. service_role, passwords demo y flags E2E no fueron transferidos.
- APP_ORIGIN HTTPS apunta al alias estable. Auth en onza-dev conserva localhost/127.0.0.1 y agrega el alias HTTPS y la URL inmutable. Site URL ahora HTTPS. Otras nueve propiedades alojadas se preservaron. Sin nueva base, reset, cambios de pagos o recursos pagados.
- Verificación remota real: 10 controles pasaron (docs/evidence/vercel-verification.json): catálogo HTTPS; pedido invitado; reserva mock autorizada en servidor; refresco conserva pedido; autenticación bartender; aceptación/preparación y listo visibles en cliente; evento WebSocket Realtime observado; sin errores de ejecución; cancelación del pedido de prueba sin captura.
- Acceso anónimo sin cuenta Vercel devuelve 302 a vercel.com: la protección Vercel Authentication sigue activa. En teléfono/computadora, iniciar sesión con la cuenta Vercel autorizada antes del cliente invitado o login de personal. No se afirma prueba en teléfono físico. La autenticación/roles del bartender siguen siendo propios de Onza además de la protección Vercel.
- Se crearon permisos temporales para automatización; un intento adicional fue rechazado automáticamente porque curl había dejado uno activo. Se revocó ese permiso antes de continuar. La prueba final revocó su propio permiso al terminar; comprobación final de cero bypass abajo. No se desactivó protección del proyecto.
- INCIDENTE PENDIENTE: el usuario reporta que no apareció código de retiro y la entrega no requirió validación. No se resolvió ni se comprobó esa validación en este despliegue. La prueba se detuvo en Listo y canceló el pedido, sin capturar ni entregar. Priorizar reproducción con usuario como siguiente tarea, sin atribuir resolución por pruebas anteriores.
- Siguiente tarea exacta: usuario abre el enlace desde teléfono como cliente y el mismo local desde computadora con su bartender; después reproducir la incidencia de validación del retiro en una tarea separada. Sin merge automático.
- Comprobación final: cero bypass de automatización restantes, Vercel Authentication preservada. El permiso temporal de prueba no se entrega al usuario ni se guarda en Git.

## Perfil visual de los locales: portada y logo · 16 de noviembre de 2026

**Estado: código, migraciones y pruebas listos en `fix/hosted-integration`; migraciones 005/006 y seed NO aplicados en `onza-dev` (ver "Pendiente").**

- Qué se hizo: tarjeta de local con portada y fade a oscuro, logo cuadrado redondeado en la esquina inferior izquierda y, a su derecha, nombre, ubicación opcional y "Ver tragos →". Se quitó el badge Abierto/Cerrado de la lista. Pestaña **Perfil** en la administración (portada, logo, nombre y ubicación, con vista previa en vivo); nombre y zona salieron de Ajustes para no editarlos en dos sitios. Placeholders cuando falta la imagen o no carga.
- Migraciones: `202611160005_venue_images.sql` (columnas nullable `cover_url` y `logo_url`; función `public.update_venue_branding`, solo admin del local, valida que la URL sea del bucket y de la carpeta del propio local, con límite de uso) y `202611160006_venue_images_storage.sql` (bucket `venue-images`: lectura pública, 2 MB, jpg/png/webp, SVG excluido; insert/update/delete solo para admin del local dueño de `<venue_id>/`). Aditivas, sin reset. Tipos regenerados con `npm run db:types:offline`.
- Archivos: `src/features/catalog/components/venue-card.tsx`, `venue-list.tsx`, `src/features/admin/components/venue-profile.tsx`, `src/features/admin/venue-image.ts`, comando `venue_branding` en `src/features/orders/server/*`, `src/proxy.ts` (excluye `/demo-venues`), `src/styles/globals.css`, `scripts/generate-venue-placeholders.mjs`, `scripts/seed-venue-images.mjs`, `scripts/lib/venue-images-seed.mjs`, `public/demo-venues/*` (arte original de los 3 locales demo).
- Verificado (ejecutado en esta sesión): `tsc --noEmit` y `eslint .` con exit 0; `next build` compila todas las rutas; `vitest run`: 14 archivos, 46 pruebas pasan (las 23 anteriores más 23 nuevas); Playwright: 41 pasan y 2 se omiten como antes (guion Supabase real y cámara).
  - Aislamiento: un admin de un local no puede cambiar nombre, ubicación ni imágenes de otro local (en ambos sentidos); bartender, invitado y anon tampoco; la tabla no admite escritura directa; URLs externas, de otra carpeta, anidadas, `.svg`/`.gif` o `javascript:` se rechazan. Las políticas de Storage se ejecutaron en PostgreSQL con un esquema `storage` simulado: un admin no sube, reemplaza ni borra en la carpeta de otro local. Se comprobó con mutaciones que estas pruebas fallan si se debilita la migración.
  - Validación de archivo (tipo, 2 MB y firma real del contenido) con pruebas unitarias y desde el formulario en el navegador.
  - Seed idempotente: lógica probada con un cliente simulado (segunda ejecución sin cambios, no pisa imágenes de un admin, mensajes claros si falta migración).
  - Tarjeta: geometría (logo cuadrado en la esquina, texto a su derecha), sin desbordes a 360/390/430/768/1280 px en claro y oscuro, imagen rota y ausente con placeholder, nombres largos, y contraste medido sobre píxeles con portada blanca (≥4,5:1 en ubicación y acción, ≥3:1 en el nombre). Capturas de la home real con datos ficticios en `docs/evidence/venue-list-*.png` y del formulario en `venue-profile-390-light.png`.
- No verificado: la home y la administración **contra `onza-dev`** (la lista real se renderizó contra un servidor REST falso con 4 locales de ejemplo, no contra Supabase); la subida real a Storage y el guardado desde la pantalla de administración con sesión de admin; los límites de tamaño y MIME del bucket (los aplica el servicio Storage, no se probaron); dispositivos físicos.
- Pendiente (bloqueo externo): el conector de Supabase de esta sesión ve otra organización y no `onza-dev`, así que las migraciones no se aplicaron. Desde la computadora con la CLI autenticada: `npm exec supabase -- db push --remote=ukdjuubekpanizcmppod --dry-run --skip-vault` (revisar que liste solo `...0005` y `...0006`), luego sin `--dry-run` y con `--yes`, y `npm run demo:seed-venue-images`.
- Siguiente tarea exacta: aplicar esas dos migraciones y el seed en `onza-dev`, entrar como admin en Administración → Perfil, subir una portada y un logo, y comprobar que otro admin no puede cambiarlos. Después extender `scripts/verify-hosted-security.mjs` con ese control.

## Imagen de cada trago · 16 de noviembre de 2026

**Estado: código, migración y pruebas listos en `fix/hosted-integration`; la migración 0007 y el seed NO están aplicados en `onza-dev` (ver "Pendiente").**

- Qué se hizo: cada trago puede tener una imagen editable por el admin de su local. En la lista de tragos de cada bar y en la página del trago se muestra en un marco de tamaño fijo (88 × 110 px en la lista, 4:5 en el detalle) con bordes redondeados y un marcador de posición del mismo tamaño si no hay imagen o no carga. La administración muestra miniaturas en el menú y el editor de trago permite subir, cambiar y quitar la imagen. El campo antiguo de foto de 5 MB (`photo_path`, bucket `menu-photos`) salió del editor; los tragos que solo tengan ese dato siguen mostrándolo hasta que se les suba una imagen nueva.
- Migración: `202611160007_product_images.sql` (columna nullable `products.image_url`; función `public.update_product_image`, solo admin del local dueño del trago, que solo acepta archivos `product-*` de la carpeta del propio local en el bucket público `venue-images`; no sube la versión del producto para no invalidar carritos; con límite de uso). Mismo bucket y mismas políticas de Storage que las imágenes de bares (2 MB, jpg/png/webp, escritura solo para admins del local dueño de la carpeta), por lo que no hay migración de Storage nueva. Aditiva, sin reset. Tipos regenerados con `npm run db:types:offline`.
- Datos demo: seis ilustraciones originales en estilo plano y fondo claro con la paleta de la marca (cóctel en copa, vaso largo, shot, cerveza, vino, sin alcohol) en `public/demo-products`, y seed idempotente `npm run demo:seed-product-images` que asigna una a cada trago demo (Paloma y Gin tonic: vaso largo; Negroni y Margarita: cóctel en copa; Cerveza; Soda cítrica: sin alcohol). Shot y vino existen pero ningún trago demo los usa todavía.
- Archivos: `src/features/catalog/components/product-image.tsx`, `product-menu.tsx`, `src/features/catalog/product-image-src.ts`, `src/features/admin/components/product-editor.tsx`, `admin-panel.tsx`, `src/features/admin/upload-venue-image.ts`, `src/lib/use-image-failure.ts`, comando `product_image` en `src/features/orders/server/*`, `scripts/generate-product-illustrations.mjs`, `scripts/seed-product-images.mjs`, `scripts/lib/product-images-seed.mjs`.
- Verificado (ejecutado en esta sesión): `tsc --noEmit` y `eslint .` con exit 0; `next build` compila todas las rutas; `vitest run`: 17 archivos, 62 pruebas pasan (las 46 anteriores más 16 nuevas); Playwright: 61 pasan y 2 se omiten como antes (guion Supabase real y cámara).
  - Permisos: un admin no puede cambiar la imagen de un trago de otro local, en ambos sentidos y tampoco apuntándola a su propia carpeta; un trago inexistente responde igual que uno ajeno; bartender, invitado y anon tampoco pueden; la tabla no admite escritura directa; se rechazan URLs externas, de otra carpeta, anidadas, sin prefijo `product-`, `.svg`/`.gif`, `javascript:` y entradas mal formadas. Las políticas de Storage (esquema `storage` simulado) permiten `product-*.jpg|png|webp` solo en la carpeta del propio local. Con mutaciones se comprobó que estas pruebas fallan si se debilita la migración.
  - Seed: lógica probada con un cliente simulado (carpeta del propio local, segunda ejecución sin cambios, no pisa imágenes de un admin, mensajes claros si falta migración o bucket).
  - Interfaz: marco de 88 × 110 px con radio ≥ 12 px tanto con imagen como con marcador de posición a 360/390/430/768/1280 px en claro y oscuro, sin desbordes; imagen rota y ausente con marcador; nombre largo sin deformar la imagen; editor con validación de tipo, 2 MB y contenido real, imagen actual visible y "Quitar imagen". Capturas de la lista real y del detalle con datos ficticios en `docs/evidence/product-menu-*.png`, `product-detail-390-dark.png` y `product-editor-390-light.png`.
- No verificado: nada contra `onza-dev`. Las pantallas reales del bar se renderizaron contra un servidor REST falso con datos de ejemplo, no contra Supabase; no se probó la subida real a Storage ni el guardado del trago con imagen desde una sesión de admin; los límites de tamaño y MIME del bucket (los aplica el servicio Storage); dispositivos físicos. Si la imagen falla después de guardar un trago nuevo, el editor avisa que el trago se guardó y hay que reintentar desde Editar: esa rama se implementó pero no se probó de extremo a extremo.
- Pendiente (bloqueo externo): el conector de Supabase de esta sesión ve otra organización y no `onza-dev`. Desde la computadora con la CLI autenticada: `npm exec supabase -- db push --remote=ukdjuubekpanizcmppod --dry-run --skip-vault` (revisar el listado: `0007`, y `0005` y `0006` si siguen pendientes), luego sin `--dry-run` y con `--yes`; después `npm run demo:seed-venue-images` (si no se ejecutó) y `npm run demo:seed-product-images`.
- Siguiente tarea exacta: aplicar las migraciones pendientes y los seeds en `onza-dev`; entrar como admin, abrir Menú → Editar en un trago, subir una imagen y comprobar que aparece en la lista del bar; comprobar que un admin del otro local no puede cambiarla. Después extender `scripts/verify-hosted-security.mjs` con ese control.


## Funcionamiento y UI compartida · 16 de noviembre de 2026

- Carrito de un local: quitar, cantidad cero, vaciar confirmado, persistencia eliminada, conservación/reemplazo explícitos. Dock “Ver carrito” solo en menú/detalle dueño; acceso discreto desde otros contextos. Checkout conserva validación SQL y no borra un draft distinto creado mientras se enviaba.
- INC-001: reproducido con dos sesiones reales antes del cambio: el public_code reclamaba retiros. Migración 008 reemplaza únicamente la función con búsqueda por token privado o código derivado de su digest privado; 48 bits manuales, 256 en QR, 10 intentos/min por actor, claim por sesión y consumo único. El número público y segundo resolve se rechazan; replays del responsable de capture/complete siguen idempotentes. No se expone código/QR/cifrado en listados del personal.
- Ticket: un fallo de descifrado no oculta el pedido ni el resto de la lista; QR fallido conserva código si se pudo reconstruir. 19 cifrados históricos válidos abrieron con la clave existente; cuatro payloads malformados y ninguno activo, sin rotaciones. Esto no demuestra la causa exacta de la ausencia reportada originalmente.
- Migración 009 añade coordenadas nullable del local y guardado atómico en branding, validado y solo admin propio. Cliente usa GPS temporalmente para ordenar todos los candidatos paginados; sin posición útil/coordenadas, búsqueda manual inmediata. No se guardan ni transmiten posiciones del cliente. Cerca: umbral inicial explícito 5 km, precisión aceptada hasta 1 km; criterios de producto, pendientes de datos de piloto.
- Apariencia en Ajustes, navegación cliente/personal separada, fallback compacto sin foto ni gradiente decorativo, cerrados no accionables, pausa diferenciada, menú compacto de hasta 640 px reutilizando tokens/componentes. Estado y ticket predominan sobre detalles financieros mock.
- Realtime conserva WebSocket; no hay polling conectado. Refetch pendiente si llega evento durante lectura, refetch al volver/conectar, cuatro reintentos visibles por desconexión y un refresco puntual al vencimiento. Sin scheduler durable cuando no hay tráfico ni clientes abiertos.
- Evidencia: typecheck/lint/build; 74 pruebas de dominio/SQL/servicio; 11 casos E2E relevantes con onza-dev, 7 casos de componentes y 29 controles alojados (Storage real incluido). 42 combinaciones de rutas cliente/tamaño/tema y 12 de personal/admin, sin desborde; cinco PNG representativos y ticket redactado. Permisos de ubicación/cámara no disponible emulados, no sensores físicos. Detalles y comandos en el informe enlazado.
- Preview: se confirmó Git conectado a `msalas0810/onza`, rama de producción `main` y creación automática de deployments deshabilitada. Push solo dispara el CI existente. No se cambian settings/variables/protección ni recursos pagados; únicamente se actualiza el Preview demo al cierre.
