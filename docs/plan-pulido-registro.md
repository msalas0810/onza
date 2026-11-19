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
| 1 | Pedidos y disponibilidad | verificada | Reproducido antes del cambio (ver abajo). `tests/orders/accept-window.test.ts` 15/15 (4:59 acepta, 5:00 exactas vence en la misma transacción, carreras cancelar/aceptar/vencer, dos operadores, cupos, intento, agotar/archivar/restaurar, precio por línea); mutación `<=`→`<` detectada. `scripts/verify-pulido-e1.mjs` 10/10 en Chromium contra shim. `npm test` 31/123, typecheck, lint y build OK. | `7bfb779` | — |
| 2 | Marca, acceso y cliente | verificada (emulación) | `scripts/verify-pulido-e2.mjs` 27/27 (login real por formulario con `next`, alta sin tabs, vidrio con blur, Google/Apple deshabilitados, «¿Sos personal?», ingreso laboral directo, búsqueda con sugerencias y teclado, cerrados sin enlace, cabecera sin chip ni carrito duplicado, Cuenta con avatar). `scripts/verify-access-video.mjs` 11/11 (asset por dispositivo en ambos accesos, 0.75×, muted, loop, inline, sin video con movimiento reducido). e2e `venue-card` 14/14 en 5 anchos × 2 temas. `tests/db/avatar.test.ts` 3/3, `tests/catalog/search.test.ts`, `tests/orders/night.test.ts`. `npm test` 34/130, typecheck, lint, build, `check-kit` OK. Capturas 360/390/768/1280 claro/oscuro revisadas. | `4c24f05` | Subida real de avatar a Storage sin probar (el shim no tiene Storage) |
| 3 | Barra y retiro | verificada (emulación, sin cámara real) | `scripts/verify-pulido-e3.mjs` 21/21 en dos sesiones: pedir → aceptar → listo → retiro; escáner sin cámara cae al código manual; pegado con guiones normalizado a `AB12 CD34 EF56`; cobro simulado y entrega física separados; corte entre cobro y entrega → «Retomar entrega» sin segundo cobro; dos empleados con el mismo código (el segundo no puede cobrar); «¡Disfrutá!» una vez y comprobante en historial; selector por rol con dos locales; clave temporal primero. `tests/pickup/code.test.ts`. `npm test` 35/132, lint, typecheck, build OK. | ver git log `feat(barra)` | Cámara y decodificador alternativo (ver bloqueos) |
| 4 | Admin móvil | pendiente | — | — | — |
| 5 | Abuso y capacidad | pendiente | — | — | — |
| 6 | Aceptación automática | pendiente | — | — | — |

## Bloqueos

| Bloqueo | Detalle | Cómo retomarlo |
| --- | --- | --- |
| Storage real | El shim no implementa Storage: la subida/lectura del avatar (bucket privado `avatars`) no se probó de punta a punta. Políticas y función sí, en PGlite con stub. | Aplicar 014 y 015 en un proyecto Supabase de prueba aislado y subir una foto desde `/cuenta`. |
| Fotos de locales reales | `public/demo-venues/real/` está vacía a propósito (sin permisos). Explorar usa respaldo nocturno; la composición con foto se verificó con los locales ficticios. | Agregar archivos con su entrada en `SOURCES.json` y `npm run demo:seed-real-venues`. |
| Decodificador QR alternativo | Safari de iPhone no ofrece `BarcodeDetector`. Se intentó instalar `jsqr@1.4.0` (Apache-2.0) y el permiso de instalación fue denegado. Sin detector, «Validar retiro» abre directo el código manual con aviso. | `npm install --save-exact jsqr@1.4.0` y usarlo en `src/features/pickup/components/pickup-panel.tsx` cuando falte `BarcodeDetector` (dibujar el cuadro del video en un canvas y pasar los píxeles a jsQR). Agregar a `THIRD_PARTY_NOTICES.md`. |
| Cámara real | Chromium sin dispositivo no abre cámara: se probó solo el camino de fallo. | Probar «Validar retiro» en Android/Chrome y en iPhone físicos. |
| Safari y dispositivos físicos | Solo emulación Chromium (UA/viewport de iPhone/iPad). | Probar `/acceso` y `/equipo/acceso` en iPhone y iPad reales. |

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

## Entrega 2 · decisiones

- Lockup único `src/components/ui/brand.tsx` (vasito rojo + wordmark + punto rojo, máscaras de los SVG oficiales). El SVG no trae punto: se agrega en el componente. Rojo `--onza-mark` (claro `#741F2C`, oscuro `#B33A4C`) y `--onza-access-mark` `#A43849` (el aprobado del video) en `design/tokens.json`.
- Vasito un escalón mayor en el acceso (54→60 px escritorio, 52→58 iPhone, 48→54 equipo); wordmark, encuadres, sombras y video sin cambios.
- Tokens `layout` (gutter `clamp(1rem, 3vw, 2rem)`, áreas 2.75rem/3rem, radio de tarjeta, blur, elevaciones) generados por `scripts/generate-tokens.py`.
- Se conserva una sola línea «Menú de demostración · sin relación comercial con el local» en la cabecera del local: los locales son reales y no hay acuerdo (decisión a revisar por Manu).
- Avatar privado (bucket `avatars` no público, solo la persona lo lee); el perfil social queda para otra fase.
