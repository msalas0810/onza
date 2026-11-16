# Estado de implementación · Onza local

Fecha de trabajo: 15 de noviembre de 2026 (America/Costa_Rica).

**Estado general: implementación de las seis áreas escrita; aceptación multiusuario pendiente por bloqueo externo.** La etapa 1 está verificada. Las etapas 2–6 no se declaran terminadas por tener interfaz: requieren ejecutar Supabase real, sus servicios y el guion entre sesiones. No se reemplazó esa persistencia por navegador.

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

Se completa al integrar los últimos cambios: comandos, cantidades exactas de tests y capturas se registran aquí antes del último commit.
