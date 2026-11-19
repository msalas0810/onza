# Registro de ejecución · Plan de pulido

Seguimiento de `docs/Onza-Plan-de-pulido.md` para retomar si se corta la sesión. Una fila por entrega.
Estados: **pendiente**, **en curso**, **verificada**, **bloqueada**. «Verificada» solo con prueba ejecutada.

- **Base** `fed579403d75da1d49cc54f0af9239b55c125706` (`origin/fix/hosted-integration`, igual a HEAD local al empezar).
- **Rama** `feat/plan-pulido` (local, sin push).
- **Entorno de prueba** PGlite en proceso (`tests/db`) y servidor local `scripts/local-shim` (no es Supabase: sin Realtime, Storage ni correo). Sin migraciones remotas.

## Checkpoint 0 · accesos publicados por Codex

| Comprobación | Resultado |
| --- | --- |
| `git fetch` + `git log origin/fix/hosted-integration` | Contiene `3babdcb`, `2d3925d`, `fed5794` en historial lineal; HEAD = origin. |
| Código `/acceso` | `AccessScreen` elige `access-mobile.mp4` solo en iPhone/Android teléfono y `access-horizontal.mp4` en iPad (incluido iPadOS como Mac táctil) y escritorio; `src` se asigna recién al reproducir (un solo asset). Muted, loop, `playsInline`, 0.75×, póster si falla autoplay o hay movimiento reducido. |
| Código `/equipo/acceso` | `AccessFrame video` reutiliza `AccessScreen` (mismos assets). Formulario laboral intacto. |
| Clientes | Google y Apple `disabled` con «Próximamente». Correo funcional, destino `next`, enlaces legales y «¿Sos personal?». |
| Cambios locales preservados | `DIARIO.md` (entradas D-2026-11-19-01..03 de Codex, sin commit) y `docs/Onza-Plan-de-pulido.md` sin rastrear. |
| Línea base | `npm test` 29 archivos / 107 pruebas OK; `typecheck` y `lint` OK. |

## Entregas

| # | Entrega | Estado | Evidencia | Commits | Siguiente paso |
| --- | --- | --- | --- | --- | --- |
| 1 | Pedidos y disponibilidad | verificada | Reproducido antes del cambio (ver abajo). `tests/orders/accept-window.test.ts` 15/15 (4:59 acepta, 5:00 exactas vence en la misma transacción, carreras cancelar/aceptar/vencer, dos operadores, cupos, intento, agotar/archivar/restaurar, precio por línea); mutación `<=`→`<` detectada. `scripts/verify-pulido-e1.mjs` 10/10 en Chromium contra shim. `npm test` 31/123, typecheck, lint y build OK. | ver git log `feat(pedidos)` | — |
| 2 | Marca, acceso y cliente | pendiente | — | — | — |
| 3 | Barra y retiro | pendiente | — | — | — |
| 4 | Admin móvil | pendiente | — | — | — |
| 5 | Abuso y capacidad | pendiente | — | — | — |
| 6 | Aceptación automática | pendiente | — | — | — |

## Bloqueos

| Bloqueo | Detalle | Cómo retomarlo |
| --- | --- | --- |

## Entrega 1 · reproducción y causa

Reproducido con datos de prueba en el shim (Mil948, María y Ana) antes de cambiar código:

| Síntoma narrado | Reproducción | Causa | Corrección |
| --- | --- | --- | --- |
| «Hay un intento anterior sin resolver» bloquea | Margarita agotada → Pedir → `OUT_OF_STOCK` → quitar otra línea → Pedir → `ATTEMPT_PENDING` | `onza-checkout-attempt` en `localStorage` (por navegador, no por cuenta) se conservaba tras rechazos definitivos y bloqueaba cualquier carrito distinto | Intento por cuenta; se descarta tras rechazo definitivo (la transacción se revierte); con otro carrito se consulta `attempt_status` en servidor (espera el mismo lock): sin pedido se descarta, con pedido activo se muestra «Ver pedido activo» con número y local |
| Producto «desaparece» al agotar | Agotar Margarita en Admin → salta del primer al último lugar | `getPublishedMenu` ordenaba por `available desc` | Orden estable por nombre en cliente y Admin |
| Archivado se pierde | Archivar → no hay forma de verlo | Admin usaba la consulta pública (`archived=false`) | `getAdminMenu` incluye archivados; vista «Archivados» con «Restaurar» (vuelve agotado) |
| Reactivar rompe carritos | Agotar → reactivar → pedir con el mismo precio → «El menú cambió» | Cada `product_save` subía `version` | `product_availability`/`product_archive` no tocan versión; el servidor compara `expectedPriceMinor` |
| Cupo ocupado indefinidamente | Autorización incierta (`unknown`) contaba siempre | Conteo inline sin plazo | `private.active_order_count`: terminales, vencidos e inciertos fuera de plazo no ocupan cupo (inciertos siguen esperando conciliación) |
| Plazo de 2 min desde checkout | — | `deadline=now()+2 min` al crear | 5:00 desde `queued_at` (servidor); `accept` exige `deadline > now()`; vence y libera reserva |

Límite por cuenta: no existía en servidor; el «límite» era el intento local. No se agregó uno nuevo.
