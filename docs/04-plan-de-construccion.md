# Onza MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task, if available in the host. Steps use checkbox syntax. Do not launch paid resources or real payments automatically.

**Goal:** construir un demo multiusuario de pedido y retiro con acabado visual consistente y pagos simulados.

**Architecture:** monolito modular Next.js con Supabase y un adapter de pagos server-only. El catálogo puede renderizarse en servidor; interacción y Realtime se limitan a las vistas que lo necesitan. Ninguna integración BAC real antes del acuerdo y manual aplicables.

**Tech stack propuesto:** Next.js, React, TypeScript, Supabase, Tailwind/CSS variables, Radix, Lucide, Zod, Vitest, Playwright. Resolver versiones compatibles y fijarlas en lockfile al crear el proyecto.

**Spec:** 01-producto-y-diseno.md, 02-arquitectura.md y 03-bac-y-pagos.md. Este plan no sustituye esos contratos.

## Global Constraints

Cliente sin login obligatorio; staff con sesión real y roles por local. Montos enteros; una moneda/local por carrito. PAYMENT_PROVIDER=mock y REAL_PAYMENTS_ENABLED=false. Tipografía Inter local, márgenes móviles 20 px (16 px a 320), targets 44 px mínimo; botones 48 px. Sin endpoints BAC inventados. Ningún secreto en NEXT_PUBLIC_*. Versionar migraciones y ejecutar con RLS habilitada.

## Review Focus

1. Sesión invitada también es authenticated; no debe obtener permisos de personal (etapa 2, A03).
2. Pérdida de referencia al autorizar: no repetir cobro ciegamente (etapa 3, P04d).
3. QR simultáneo desde dos dispositivos: un solo responsable físico (etapa 5, P04b/P04c).
4. Red intermitente tras captura exitosa: conservar operación y reconciliar (etapa 5, P03).
5. Turno cruza medianoche: business_date usa 06:00 local y no UTC (etapa 6, D02).

Comandos propuestos del proyecto a crear: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm run build`. Cada etapa añade o mantiene esos scripts; una verificación cierra solo con exit code 0. Un commit/revisión por entregable coherente; no declarar pruebas ejecutadas antes de existir la app.

## Interfaces y archivos de verificación

| Etapa | Produce/consume | Pruebas exactas a crear |
| --- | --- | --- |
| 1 | `Button` y `IconButton` en src/components/ui; componentes reciben variant/size tipadas; ThemeControl sin flash | tests/e2e/design-system.spec.ts: temas, 360 px, foco y targets |
| 2 | `getPublishedMenu(venueId)` en src/features/catalog/server/queries.ts; usa usuario+RLS | supabase/tests/rls.test.sql: cliente A no lee B, invitado no staff, staff A no muta B |
| 3 | `OrderService.createOrder` de contracts/order-contracts.ts; PaymentProvider de contracts/payment-provider.ts | tests/orders/create-order.test.ts: mismo key/mismo payload -> mismo ID; distinto payload -> conflicto; total recalculado; timeout sin ref -> unknown |
| 4 | `acceptOrder`, `readyOrder`, `cancelOrder` en src/features/orders/server/order-service.ts | tests/orders/transitions.test.ts: ready no captura; aceptar/cancelar solo un ganador; tests/e2e/live-order.spec.ts: refetch y aviso deduplicado |
| 5 | `claimPickup(actor, credential)`, `capturePickup(actor, claimId)`, `completePickup(actor, claimId)` en src/features/pickup/server/pickup-service.ts; claimId opaco validado por sesión | tests/pickup/concurrency.test.ts: 1 captura, 1 dueño de entrega, unknown no libera claim; tests/e2e/pickup.spec.ts: permiso cámara denegado y código manual |
| 6 | `getVenueSummary(actor, venueId, businessDate)` en src/features/analytics/server/queries.ts | tests/analytics/summary.test.ts: capturado/devuelto/reservado separados, medianoche; tests/e2e/full-demo.spec.ts: guion completo |

Los tipos de retorno detallados de menú, claim y resumen se derivan del esquema 02 al crear esas funciones; no agregan nuevas reglas de negocio. Un claim retorna permiso de entrega solo a la sesión propietaria. Los IDs de prueba se generan en seed, no son credenciales reales.

## Etapa 1 · Lenguaje visual y estructura

Archivos: `src/app/layout.tsx`, `src/styles/`, `src/components/ui/`, `src/app/design-system/`, `public/brand/`, `public/fonts/`.

- [ ] Inspeccionar entorno/repositorio; crear configuración mínima y documentación de arranque.
- [ ] Copiar logos/fuente con licencias, importar tokens y configurar tema sin flash.
- [ ] Implementar componentes reutilizables con variantes y foco accesible.
- [ ] Montar catálogo interno con textos largos, montos, disabled/loading/error y ambos temas.
- [ ] Comprobar layout a 360/390/430/768/1280 px y reduced motion; guardar capturas comparables.
- [ ] Ejecutar typecheck, lint y build; corregir antes de cerrar etapa y registrar el cambio.

**Cierre:** una identidad visible y consistente sin Supabase ni pago todavía; no una landing de marketing. No avanzar multiplicando pantallas con un sistema visual roto.

## Etapa 2 · Persistencia, identidades y catálogo

Archivos: `supabase/migrations/`, `supabase/seed.sql`, `src/lib/supabase/`, `src/features/catalog/`, `src/app/(customer)/`, guards de staff.

- [ ] Escribir migraciones para catálogo, órdenes, membership y datos auxiliares del diseño.
- [ ] Escribir pruebas de RLS que fallen para lecturas/escrituras cruzadas e identidades incorrectas.
- [ ] Implementar políticas, constraints, índices y funciones de escritura acotadas; probar con roles reales, no solo service_role.
- [ ] Añadir seeds idempotentes con locales ficticios y roles demo separados. Configuración manual necesaria queda documentada.
- [ ] Construir Explorar, menú y detalle con datos de Supabase; fallback elegante para foto faltante.
- [ ] Ejecutar tests/RLS/typecheck/build y verificar sesión invitada y staff en dispositivos distintos.

**Cierre:** dos locales aislados y catálogo persistente. No reemplazar silenciosamente Supabase por localStorage si falta la configuración.

## Etapa 3 · Carrito y pedido con reserva ficticia

Archivos: `src/features/orders/`, `src/features/payments/`, `src/app/api/orders/`, checkout y contracts.

- [ ] Escribir pruebas de total, cantidad, precio cambiado, disponibilidad, pedido de un local y doble submit.
- [ ] Implementar creación transaccional, snapshots, autorización mock y estados independientes.
- [ ] Implementar checkout sin datos de tarjeta, aceptación de políticas y errores durables.
- [ ] Añadir pruebas de decline, requires_action y timeout/unknown. Desconexión no crea un segundo pedido.
- [ ] Confirmar que refrescar conserva la orden y el monto autorizado; registrar resultados.

**Cierre:** pedido de servidor entra a cola solo tras reserva ficticia confirmada. Nada de checkout que únicamente cambia una variable local.

## Etapa 4 · Operación en tiempo real

Archivos: `src/features/orders/`, `src/features/notifications/`, `/staff`, endpoints accept/ready/cancel y tareas de caducidad demo.

- [ ] Escribir pruebas de transiciones permitidas, accept/cancel concurrentes y aislamiento por local.
- [ ] Implementar cola, Aceptar y preparar, Listo, pausa y motivos de rechazo.
- [ ] Conectar Realtime con RLS, refetch al reconectar y aviso de conexión.
- [ ] Añadir aviso persistente cliente y habilitación explícita de sonido. Deduplicar por evento y dispositivo.
- [ ] Implementar barrido idempotente de deadlines y documentar scheduler de piloto.
- [ ] Probar cliente y barra en dos sesiones; revisar estados de error/quietud, temas y permisos.

**Cierre:** cambios reales de DB sincronizan la otra pantalla. No afirmar notificaciones con teléfono bloqueado como parte del demo.

## Etapa 5 · QR, captura ficticia y entrega

Archivos: `src/features/pickup/`, adapters, endpoints resolve/capture/complete, migration token/operations y scanner lazy.

- [ ] Escribir pruebas de QR alterado, otro local, vencido, consumido y código manual rate-limited.
- [ ] Implementar generación segura/reconstrucción de ticket y cámara con fallback.
- [ ] Implementar claim durable, captura mock y confirmación física de entrega.
- [ ] Simular dos bartenders y timeout después de éxito; retomar sin duplicar cobro.
- [ ] Verificar que no puede entregarse sin cobro confirmado; incidentes cobrados quedan pendientes de entrega.

**Cierre:** recorrido de punta a punta sin dobles cobros, sin enlaces QR como autorización global y sin necesitar cámara para la alternativa manual.

## Etapa 6 · Administración y acabado

Archivos: `src/features/analytics/`, `/admin`, ajustes/menú, consultas agregadas y tests E2E.

- [ ] Definir fixtures conocidas y pruebas de ventas, devoluciones y corte de día 06:00 local.
- [ ] Implementar menú editable, disponibilidad, filtros y resumen de ventas con cobertura explícita.
- [ ] Probar todo el guion 05, incluidas fallas y separación de datos entre locales.
- [ ] Medir bundles e imágenes, optimizar sin cambiar el diseño; validar Safari real y Android.
- [ ] Completar README, setup, variables, licencias, datos demo, checklist y evidencia de pruebas.

**Cierre:** demo reproducible, visualmente pulido, persistente y claramente marcado como simulado. El founder puede usarlo para mostrar y validar con un local.

## Etapa posterior · BAC, solo tras resolver condiciones

- [ ] Obtener acuerdo para el caso de uso y gateway/manual/versiones aplicables.
- [ ] Documentar mapping de authorize/query/void/capture/refund y verificación del resultado real.
- [ ] Implementar BacPaymentProvider sin cambiar componentes ni reglas del dominio.
- [ ] Programar conciliación/caducidad durables, recuperación y soporte de incidencias.
- [ ] Completar sandbox/certificación bancaria, seguridad y pruebas de retiro/edad/notificación del piloto.
- [ ] Habilitar producción únicamente con el aval correspondiente y operación acordada con los bares.

La implementación de etapas 1-6 puede avanzar sin esta etapa. No simular un aval bancario para cerrar el plan.
