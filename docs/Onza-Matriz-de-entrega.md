# Onza · Matriz de entrega (30 requisitos)

19 de noviembre de 2026 · rama `review/rescate-entrega` sobre `feat/plan-pulido` (`83ba141`), que a su vez parte de `fed5794`.

**Cómo leerla.** Estados: **verificado**, **parcial**, **pendiente**, **bloqueado**. «Verificado» significa que lo recorrí en la interfaz o transición real contra la app local (Next.js en modo dev y build de producción, conectada al servidor de verificación `scripts/local-shim` con las migraciones reales sobre PGlite, pagos mock). **Todo se verificó en Chromium con emulación de viewport/dispositivo, y WebKit para el video; nada se probó en un iPhone, iPad o Android físicos.** Esa prueba física está en «Pendiente» de cada fila que la necesita. Una build verde o código existente no cuentan: cada fila cita la prueba que se ejecutó o la captura que abrí.

**Limitaciones del entorno de prueba** (afectan a las filas indicadas): el servidor local no tiene Realtime, Storage ni correo, y acepta cualquier contraseña. Supabase real (`onza-dev`) no se tocó.

**Insumos que no estaban.** La transcripción `Pasted text(20261119-090655).txt` y `onza screens and logic.zip` no están en este Mac (búsqueda en Spotlight y en el home). La matriz sale de `docs/Onza-Especificacion-de-rescate.md`, que ya las incorpora. Si aparecen, hay que contrastarlas y agregar lo vigente que falte.

**SHA.** Los de `7bfb779`…`f785f01` son del trabajo de anoche (re-verificado hoy). Los de esta sesión: `41505e1` Tus locales, `22c698b`/`bde956f`/`13d369b`/`4c2a848` cuenta y acceso, `d10c97a` medición y código muerto, `be18740` higiene.

## Acceso y marca

| ID | Estado | Pantalla / transición | Archivo | Prueba / captura | SHA | Pendiente |
|---|---|---|---|---|---|---|
| A01 | verificado | Lockup con punto rojo en cliente y equipo; cabecera compacta; «Onza Equipo» | `src/components/ui/brand.tsx` | `verify-pulido-e2` 27/27; capturas `despues-acceso/*`, `…/equipo-390-light.png`. A 320×568 el correo queda visible sin desplazar (`verify-rescate-acceso` 12/12); «¿Sos personal?» exige scroll a esa altura | `4c24f05`, `4c2a848` | Safe area y barra del navegador en iPhone real |
| A02 | verificado | `/acceso` y `/equipo/acceso`: video por dispositivo, 0.75×, sin audio, póster | `src/app/acceso/*`, `public/access/*` | `verify-access-video` 11/11 en Chromium y WebKit (emulación); medición de red: iPhone baja solo `access-mobile.mp4`, iPad/escritorio solo `access-horizontal.mp4` | `fed5794` | Safari de iPhone y de iPad físicos |
| A03 | verificado | Google/Apple deshabilitados con «Próximamente»; título «Pedí tu ronda. Retirá en la barra.»; vidrio en campos | `src/app/acceso/page.tsx`, `access.module.css`, `auth-form.tsx` | `verify-pulido-e2`; `verify-rescate-acceso` (badge dentro del botón a 320/340/360/390: **antes se salía del botón a 320 px**); `despues-acceso/acceso-390-light.png`, `acceso-320x568.png`, `equipo-390-light.png` | `4c24f05`, `bde956f`, `4c2a848` | Decisión editorial de Manu sobre el título (se quitó el subtítulo para no repetir «ronda») |
| A04 | parcial | «Continuar con correo» → correo/contraseña/recuperación → «Creá una» → alta; trago favorito opcional | `auth-form.tsx`, `onboarding-form.tsx`, `profile-editor.tsx`, migración 020 | `verify-pulido-e2` (login real con `next`, alta sin tabs, edad); `verify-rescate-cuenta` 6/6 (trago favorito guardado, precargado y vaciable); `tests/db/profile-details.test.ts` | `4c24f05`, `13d369b` | Confirmación de correo, autofill y gestores de contraseñas: el servidor local no envía correo y no hay gestor en Chromium headless |

## Cliente

| ID | Estado | Pantalla / transición | Archivo | Prueba / captura | SHA | Pendiente |
|---|---|---|---|---|---|---|
| C01 | verificado | Explorar: estados de ubicación, búsqueda con sugerencias, teclado/Escape | `venue-list.tsx` | `verify-pulido-e2` (búsqueda sin GPS, sugerencias que no ocultan tarjetas, teclado); `auditoria/explorar-390-light.png` | `4c24f05` | Permiso de ubicación real en teléfono; orden por cercanía con coordenadas reales (los locales de prueba no las tienen) |
| C02 | verificado | Tarjetas altas, logo, barrio, «Abierto» + horario, cerrados al final y sin enlace | `venue-card`, `venue-status.tsx` | `tests/e2e/venue-card.spec.ts` 14/14 (5 anchos × 2 temas); `auditoria/explorar-390-light.png` | `4c24f05` | Fotos y logos con permiso (PEN-003): hoy hay respaldo |
| C03 | verificado | Menú con foto cuadrada, stepper papelera/−/+, detalle con tamaño y alérgenos, agotado | `product-menu`, `/v/[slug]/p/[id]` | `verify-pulido-e1`/`e2`; `auditoria/menu-390-light.png` | `4c24f05` | — |
| C04 | verificado | Dock como acceso al carrito; carrito con flecha «Volver al menú»; sin controles fijos; aislamiento por local | `cart-page.tsx` | `verify-pulido-e2` (cabecera sin carrito duplicado); `auditoria/cart-390-light.png` | `4c24f05` | — |
| C05 | parcial | Checkout con total, retiro, nota de cancelación y «Sin cobro real» | `checkout.tsx`, `venue-hero.tsx` | `auditoria/checkout-390-light.png` | `4c24f05` | **Decisión de Manu:** se conserva la línea «Menú de demostración · sin relación comercial con el local» en la cabecera del local (locales reales sin acuerdo). La especificación pide quitar el texto general de demostración; quitarla es un cambio de una línea en `venue-hero.tsx:36` |
| C06 | parcial | Envío con vasito que se llena, seguimiento por estados, refresco con etiqueta, aviso | `use-live-orders.ts`, `ready-sound.tsx` | `verify-pulido-e1`/`e3` (estados y refresco manual) | `0250975` | **Realtime sin probar** (el servidor local no lo tiene: la barra muestra «Reconectando…»). Sonido y vibración solo en dispositivo |
| C07 | verificado | Listo: QR protagonista, «Código privado», «¡Disfrutá!» una vez, «Volver al menú» o Explorar, historial sin animación | `enjoy.tsx`, `pickup-panel.tsx` | `verify-pulido-e3` 21/21 | `0250975` | — |
| C08 | verificado | Pedidos activos primero, historial por noche operativa (corte 06:00), foto, «+N más» | `orders` | `tests/orders/night.test.ts`; `verify-pulido-e2`; `auditoria/orders-390-light.png` | `4c24f05` | — |
| C09 | parcial | Cuenta: avatar, nombre y @usuario **editables** (hoja «Editar perfil»), correo aparte, selector de apariencia, «Cerrar sesión» | `profile-editor.tsx`, `avatar-editor.tsx`, migración 020 | `verify-rescate-cuenta` 6/6 (rechazo de @usuario ajeno e inválido, guardado tras recargar); `tests/db/profile-details.test.ts` 2/2; `despues/cuenta-editar-390.png`, `cuenta-editada-390.png`. **Antes no se podía editar nombre ni @usuario** | `22c698b`, `13d369b` | **Subir/quitar foto real: Storage no existe en el servidor local** (bloqueo; ver abajo) |

## Pedidos y consistencia

| ID | Estado | Pantalla / transición | Archivo | Prueba / captura | SHA | Pendiente |
|---|---|---|---|---|---|---|
| O01 | verificado | Cupo no se bloquea por vencidos/cancelados/inciertos; «Ver pedido activo» | migración 013, `checkout.tsx` | `tests/orders/accept-window.test.ts`; `verify-pulido-e1` 10/10 | `7bfb779` | — |
| O02 | verificado | 5:00 desde la cola, `mm:ss`, 4:59 acepta y 5:00 vence, una sola transición | migración 013, `queue.tsx` | `accept-window.test.ts` 15/15 (mutación detectada); `verify-pulido-e1` | `7bfb779` | — |
| O03 | verificado | Revalidación al confirmar; agotar ≠ archivar; restaurar exige habilitar | migración 013, `admin-panel.tsx` | `accept-window.test.ts`; `verify-pulido-e1` (agotar → cliente → reactivar → cliente) | `7bfb779` | — |
| O04 | verificado | Estados coherentes tras recarga; reintento idempotente; eventos con actor | `private.commands`, `order_events` | `tests/orders/*` (idempotencia, concurrencia), `tests/db/adversarial.test.ts`; `verify-pulido-e3` | `7bfb779`, `0250975` | Reconexión de Realtime (ver C06) |

## Personal

| ID | Estado | Pantalla / transición | Archivo | Prueba / captura | SHA | Pendiente |
|---|---|---|---|---|---|---|
| T01 | verificado | Un local → directo por rol; cero → acceso pendiente; varios → «Tus locales»; admin: Administrar + Abrir barra, bartender: Abrir barra | `src/app/equipo/locales/page.tsx` | `verify-pulido-e3` (selector por rol, clave temporal primero); `verify-tus-locales` | `0250975`, `41505e1` | — |
| T02 | verificado | Nombre, rol y estado arriba; acciones debajo (dos columnas si caben, si no apiladas); al lado en escritorio | `locales/page.tsx`, `globals.css` (`.venue-pick*`) | `verify-tus-locales` 143/143: Apotecario, Wilk Craft Beer, Otro Bar, Mil948, Stiefel × Abierto/Pausado/Cerrado × admin/bartender × 320/360/390/1440; **antes**: `antes/antes-admin-390.png` (botones tapaban «Abierto» y partían «Apotecari/o»); **después**: `despues/despues-admin-390.png`, `…-320.png`, `…-1440.png`, `despues-bartender-360.png` | `41505e1` | — |
| T03 | verificado | Barra: tabs con contadores, «Cerrados hoy», aceptar verde, rechazar con motivo, Ajustes, pausa | `queue.tsx` | `verify-pulido-e3`/`e6`; `auditoria/barra-390-light.png` | `0250975` | Uso con una mano en teléfono físico |
| T04 | parcial | «Validar retiro» abre la cámara; «Ingresar código» siempre visible; permiso denegado → manual; `AB12 CD34 EF56`; pegado con guiones | `pickup-panel.tsx` | `verify-pulido-e3` (sin cámara cae al manual, normalización, código incorrecto) | `0250975` | **Bloqueado: decodificador QR alternativo.** Safari de iPhone no tiene `BarcodeDetector`; instalar `jsqr@1.4.0` fue denegado por el permiso del entorno (dos veces). Paso exacto: `npm install --save-exact jsqr@1.4.0`, usarlo en `pickup-panel.tsx` cuando falte `BarcodeDetector`, y agregarlo a `THIRD_PARTY_NOTICES.md`. Cámara real sin probar |
| T05 | verificado | Código → resumen → cobro simulado → «Entregué físicamente el pedido completo» → cola; sin «Validar otro código» a medias; «Retomar entrega» | `pickup-panel.tsx` | `verify-pulido-e3` (corte entre cobro y entrega, sin doble cobro, dos empleados) | `0250975` | — |

## Administración móvil

| ID | Estado | Pantalla / transición | Archivo | Prueba / captura | SHA | Pendiente |
|---|---|---|---|---|---|---|
| D01 | verificado | Seis tabs en una fila fija que desliza sola; activo a la vista; enlace directo; teclado | `admin-panel.tsx` | `verify-pulido-e4` 21/21 a 360 px; `auditoria/disponibilidad-390-light.png` | `dd21af8` | — |
| D02 | parcial | Menú (alta/edición/archivados/restaurar), Disponibilidad, Negocio con portada y logo separados y vista previa de la tarjeta, Equipo | `admin-panel.tsx` | `verify-pulido-e4`; `auditoria/negocio-390-light.png`, `disponibilidad-390-light.png` | `dd21af8` | **Subida real de portada/logo (Storage) sin probar**: el servidor local no la tiene. Probar en un proyecto Supabase aislado con las migraciones 014–020 |
| D03 | verificado | Selector Día/Semana/Mes/Año en hoja, corte 06:00; «Activos (N)/Todos» | `analytics/components/*` | `verify-pulido-e4`; `tests/analytics/period.test.ts` | `dd21af8` | — |
| D04 | verificado | Tarjetas de datos, reservas aparte, gráfico por hora con pico, desglose de productos en hoja | `venue_summary_range` (migración 016) | `tests/analytics/summary-range.test.ts` (medianoche, 06:00, devoluciones, vacío); `verify-pulido-e4`; `auditoria/resumen-390-light.png` | `dd21af8` | — |

## Capacidad, abuso y automatización

| ID | Estado | Pantalla / transición | Archivo | Prueba / captura | SHA | Pendiente |
|---|---|---|---|---|---|---|
| P01 | verificado | Límite 3 en 10 min → pausa de 5 min; **en observación por defecto**; excluye rechazos, vencimientos, reintentos | migración 018 | `tests/orders/abuse-waitlist.test.ts` 8/8 | `d1dc154` | Revisar falsos positivos en observación antes de pasar a `enforce` |
| P02 | verificado | «La barra está llena» → lista de espera persistente, un lugar por cuenta y local, oferta exclusiva con vencimiento | migración 018 | `abuse-waitlist.test.ts`; `verify-pulido-e5` 9/9 | `d1dc154` | — |
| P03 | verificado | Confirmar cupo revalida stock, precio y estado; último lugar con un solo ganador; pausa suspende ofertas | migración 018 | `abuse-waitlist.test.ts` (recarga, expiración, agotado, concurrencia); `verify-pulido-e5` | `d1dc154` | — |
| P04 | parcial | Aceptación automática apagada por defecto, por local; máximo en preparación; misma transición que la manual; motivos registrados | migración 019 | `tests/orders/auto-accept.test.ts` 8/8; `verify-pulido-e6` 9/9 (sin barra abierta pasa a Preparando) | `f785f01` | **Scheduler durable (PEN-005):** corre al crear el pedido y en cada barrido por tráfico; `public.auto_accept_tick()` espera un cron con `service_role` (`select public.auto_accept_tick();` cada minuto). Sin cron en este entorno |

## Resumen

| Estado | Cantidad | IDs |
|---|---:|---|
| verificado | 23 | A01 A02 A03 C01 C02 C03 C04 C07 C08 O01 O02 O03 O04 T01 T02 T03 T05 D01 D03 D04 P01 P02 P03 |
| parcial | 7 | A04 C05 C06 C09 D02 T04 P04 |
| pendiente | 0 | — |
| bloqueado | 0 | T04, D02 y C09 son parciales con un bloqueo concreto cada uno (ver abajo) |

## Bloqueos y cómo liberarlos

| Bloqueo | Afecta | Cómo se libera |
|---|---|---|
| `jsqr` no instalable en este entorno | T04 | `npm install --save-exact jsqr@1.4.0` con permiso, luego integrar en `pickup-panel.tsx` |
| Sin Storage, Realtime ni correo en el servidor local | C06, C09, D02, A04 | Aplicar las migraciones 013–020 en un proyecto Supabase de prueba aislado y repetir esos recorridos |
| Sin cron | P04 | Programar `select public.auto_accept_tick();` cada minuto en el proyecto de prueba |
| `ffmpeg` local roto (falta `libx265`) | Recodificar el MP4 móvil (4,6 MB) | `brew reinstall ffmpeg`; no se tocaron los videos aprobados |
| Pruebas físicas | A01, A02, C01, C06, T03, T04 | Safari/Chrome en iPhone, iPad y Android reales |
