# Onza V1 · Guía de diseño e implementación

Fuente visual para F2–F7. Acompaña a [`docs/plan-v1.md`](../../docs/plan-v1.md) (plan completo y estado) y a las maquetas de esta carpeta. Si algo aquí contradice la sección 0 del blueprint, manda el blueprint y se anota en §9.

> **Estado:** propuesta de F1 entregada para **revisión visual de Manu**. Nada de esta carpeta está aprobado todavía ni implementado en la app.

## 1. Cómo abrir y comprobar

```bash
python3 -m http.server 8080 --directory design/maquetas-v1
```

- `index.html`: mapa de recorridos. `flujo.html`: cliente (teléfono) + barra/admin (escritorio) sincronizados. `componentes.html`: catálogo con estados. `app.html#/…`: la maqueta.
- Botón **Revisión** (abajo a la derecha): saltar a pantallas, cambiar de cuenta, tema, fondo P-2, movimiento reducido, estados de lista, sin conexión, sesión vencida, simulaciones y componentes usados por la pantalla. `?captura=1` lo oculta.
- Verificación automática: `node scripts/verify-maquetas.mjs` (51 controles; resultado en `verificacion.json`; capturas en `capturas/`).
- Archivos: `assets/tokens.css` (tokens), `assets/components.css` (todas las clases), `assets/templates.js` (un componente = una función), `assets/store.js` (reglas del servidor simuladas), `assets/screens.js` (pantallas y guardas), `assets/review.js` (solo revisión), `data/venues.js` (hechos reales vs. demo).

## 2. Estado de las decisiones

| Tipo | Contenido |
| --- | --- |
| **Firmes (confirmadas por Manu)** | Login obligatorio; Google + correo; Apple visible deshabilitado "Próximamente"; cuentas cliente/laboral separadas; "¿Sos personal?" al portal; dos permisos por local; admin gestiona equipo, menú, disponibilidad y negocio; conservar pedidos, Realtime, aislamiento, retiro privado, idempotencia; cancelar solo antes de aceptar; pagos simulados; Particle Wave original en `/acceso`; paleta negro/ivory/oxblood y vasito original; alta laboral con contraseña temporal y cambio obligatorio; bares reales con fuentes, permisos pendientes antes del lanzamiento; stepper que permite quitar el último; cambio de clave exigido también en APIs; revocar solo la membresía del local. |
| **Diseño F1 (delegado a Claude, sujeto a tu revisión visual)** | Tokens derivados de §3, tipografía, densidades, catálogo de §4, reglas de movimiento §6, tarjeta compacta cuando no hay foto, ticket siempre ivory, una acción primaria por tarjeta de barra, pestañas de admin (Resumen, Pedidos, Menú, Disponibilidad, Negocio, Equipo), copys. |
| **Propuestas pendientes (no aprobadas)** | P-1 menú de local cerrado en solo lectura · P-2 fondo ivory en toda la app (la maqueta lo usa; conmutable a blanco) · P-3 horario estructurado · P-4 borrado de cuenta y nuevas condiciones en la V1 demo · P-5 Particle Wave también en `/equipo/acceso` (la maqueta usa el mismo marco negro) · P-6 el empleado puede pausar/reanudar desde la barra (solo el admin cierra) · P-7 añadir `@number-flow/react` (la maqueta usa una transición CSS y funciona sin la dependencia; recomendación: no añadirla). |

## 3. Tokens

Valores en `assets/tokens.css`. En F2 pasan a `design/tokens.json` y se regeneran con `scripts/generate-tokens.py`. Contrastes WCAG medidos:

| Token | Claro | Oscuro | Contraste |
| --- | --- | --- | --- |
| `bg` | `#F4F1ED` (P-2) | `#0D0D0E` | — |
| `surface` / `surface-raised` | `#EAE6E0` / `#FBFAF8` | `#18181A` / `#202023` | — |
| `text` | `#0D0D0E` | `#F4F1ED` | 17.3:1 |
| `text-muted` | `#5F5A54` | `#A8A29B` | 5.5–6.5:1 / 6.4–7.7:1 |
| `brand` (relleno) | `#741F2C` | `#741F2C` | ivory sobre oxblood 9.4:1 |
| `brand-text` | `#741F2C` | `#E2A2AB` | 9.4:1 / 9.2:1 · oxblood nunca como texto en oscuro (1.8:1) |
| `control-border` | `#8A847D` | `#77716B` | 3.3:1 / 4.0:1 |
| `success-text` / `warning-text` / `danger-text` | `#1F6B45` / `#7A5300` / `#A3283A` | `#8CD3AC` / `#EBC77E` / `#FFA8B3` | ≥ 5.7:1 |
| `*-soft` (fondos de estado) | ver archivo | ver archivo | texto de estado sobre su fondo ≥ 4.5:1 |

Escala tipográfica (Inter variable, `font-optical-sizing: auto`): display 600 32/38 (−0.02em) · title 600 28/34 · heading 600 20/26 · body 400 16/24 · label 500 14/20 · caption 500 12/16 · pedido en barra 600 18/24. Eyebrow: caption en mayúsculas +0.06em. Cifras tabulares en dinero, tiempos, número de pedido y código. Máximo tres tamaños por pantalla.

Espaciado 4/8/12/16/20/24/32/40/48/64 · radios 12 (control), 16 (medios, tarjetas), 24 (hojas, ticket), 999 (pastillas) · alturas 44 (táctil mínimo), 48 (control), 56 (barra), cabecera 56 (cliente) / 64 (equipo), navegación inferior 64 · anchos 480 (cliente), 640 (menú), 1040 (Explorar), 1280 (operación) · márgenes laterales 16 móvil, 32 desde 1024.

Movimiento: press 100 · state 160 · sheet 220 · confirm 300 · celebrate 600 ms · `cubic-bezier(0.2,0,0,1)`. Con movimiento reducido todos valen 0.

## 4. Catálogo de componentes

Uno por patrón, variantes tipadas, sin duplicar por rol. Ruta destino en `src/components/ui/` salvo indicación.

| Componente (archivo destino) | Clase / función en la maqueta | Variantes y estados | Procedencia |
| --- | --- | --- | --- |
| `AppShell` (`app-shell.tsx`) | `.hdr`, `.bnav`, `customerShell()`; `.shdr`, `staffShell()` | `customer` (cabecera + nav inferior en móvil, nav superior ≥1024) · `staff` (logo + EQUIPO + local + persona·rol + sonido + cambiar local + Salir) | Propio |
| `Button` (`primitives.tsx`, ya existe) | `.btn` + `primary/secondary/quiet/danger/inverse`, `sm/lg/block` | normal, hover, activo (scale .98), `aria-busy` (spinner, texto oculto, ancho fijo), deshabilitado con motivo visible | Propio |
| `Field`, `SearchField` | `.field`, `.input`, `.search`, `field()` | label siempre visible, hint, error con ícono junto al campo, `aria-invalid` + `aria-describedby`; `.input.code` para códigos | Propio |
| `SegmentedControl` | `.seg`, `seg()` | `aria-pressed`; bloque o en línea | Propio |
| `Toggle` | `.toggle`, `toggle()` | checkbox nativo con estilo, 48×28 | Propio |
| `StatusBadge` | `.badge` + tono | open, paused, closed, success, warning, danger, brand, plain | Propio |
| `VenueMedia` | `.media`, `media()` | foto 16:9 / 3:2 / 21:9 · "Foto pendiente" solo en Admin › Negocio | Propio |
| `VenueCard`, `VenueRow` (`features/catalog`) | `.vcard`, `.vcard.compact`, `.vrow` | con foto (foto arriba, texto debajo) · **sin foto: compacta con monograma 64 px** · cerrado atenuado 56 % | Propio |
| `VenueHero` | `.vhero`, `venueHero()` | con foto 3:2 (21:9 ≥720) · sin foto: solo identidad · nota "Demo · menú y precios simulados…" obligatoria | Propio |
| `ProductRow` + `QuantityStepper` | `.prow`, `.stepper`, `productRow()`, `stepper()` | Agregar → stepper (entra en 160 ms) · **con cantidad 1 el − es papelera "Quitar"** · agotado sin Agregar; si estaba en el carrito, línea con "Se agotó · quitalo" y stepper activo · variante carrito con aviso de precio nuevo | Patrón `spinbutton` de Number Stepper · alexisroe (MIT), adaptado; sin importar código |
| `CartDock` | `.dock`, `dock()` | solo en el local dueño; ícono baja 4 px y total cambia al agregar | Propio |
| `ConnectionBanner` | `.banner`, `banner()` | offline, reconnecting, danger, info · fijo bajo la cabecera mientras dure | Propio |
| `Notice` | `.notice`, `notice()` | neutral, warning, danger (`role=alert`), success | Propio |
| `EmptyState`, `ErrorState`, `Skeleton` | `.state`, `.state.error`, `.sk` | con acción; esqueleto estático sin brillo | Propio |
| `Sheet` | `.scrim` + `.sheet`, `sheet()` | abajo en móvil, centrada ≥720 · foco al primer control · Escape cierra (salvo sesión vencida) | `@radix-ui/react-dialog` (instalado) |
| `SessionExpiredSheet` | `sheet` tipo `expired` | sin cerrar; "Volver a entrar" conserva `next` y correo | Propio |
| `OrderTimeline` | `.tl`, `timeline()` | Recibido → Preparando → Listo → Entregado | Propio |
| `PickupTicket` | `.ticket`, `ticket()` | siempre ivory sobre negro; QR real de `pickup-service` (en la maqueta, ilustrativo); código en grupos de 4 | Propio |
| `OrderCard` variante barra | `.ocard`, `staffCard()` | una acción primaria: Aceptar (+Rechazar) · Marcar listo · Validar retiro; espera ≥10 min en aviso; error en la tarjeta; deshabilitada sin conexión; `.new` (entrada + resalte 2 s) | Propio |
| `PickupResult` | `.result.ok/.bad` | check dibujado 300 ms; error persistente sin sacudida | Propio |
| `Tabs` | `.tabs` | con URL; en admin ≥1024 se convierte en navegación lateral `.admin .side` | Propio |
| `MetricTile`, `Rows`, `BlockCard`, `SavedState`, `SecretReveal` | `.metric`, `.rows`, `.block-card`, `.saved`, `.secret` | — | Propio |
| `Vasito` (confirmación) | `.vaso` | SVG original `onza-shot.svg` como máscara; se llena una vez | Marca Onza |
| Fondo del acceso | — | Particle Wave **original**, ya en `src/components/backgrounds/particle-wave.tsx`; la maqueta no lo recrea (fondo negro + nota) | 21st.dev @jahed, código aportado por Manu |
| Íconos | `ico()` | trazos de Lucide; animación CSS de un solo disparo | Lucide (ISC), ya instalado |

No adoptados: `lucide-animated` (exige `motion`), steppers de 21st.dev sin licencia declarada. `NumberFlow` queda como P-7.

## 5. Pantallas: maqueta → ruta de la app → componentes

| Maqueta (`app.html#…`) | Ruta en la app | Componentes |
| --- | --- | --- |
| `/acceso`, `/acceso/correo`, `/confirmar`, `/recuperar`, `/restablecer` | `/acceso`, `/confirmar`, `/recuperar`, `/restablecer` | Particle Wave (sin cambios), Field, Button, Notice |
| `/onboarding` | `/onboarding` | Field, Toggle, Button |
| `/sesion-activa` | `/sesion-activa` | Panel, Button |
| `/explorar` | `/` | AppShell, SearchField, VenueCard/VenueRow, EmptyState, ErrorState, Skeleton, ConnectionBanner, Sheet (permiso simulado; en la app lo pide el navegador) |
| `/local/:slug` | `/v/[slug]` (detalle de producto en hoja; `/v/[slug]/p/[id]` se conserva para enlaces) | VenueHero, Notice, chips, ProductRow, QuantityStepper, CartDock, Sheet |
| `/carrito`, `/checkout`, `/confirmado/:id` | `/cart`, `/checkout` (confirmación como estado del checkout antes de redirigir) | ProductRow (carrito), Notice por código, Button cargando, Vasito, SessionExpiredSheet |
| `/pedido/:id`, `/pedidos` | `/orders/[id]`, `/orders` | OrderTimeline, PickupTicket, Sheet (cancelar), Toggle (sonido), VenueRow (pedido) |
| `/cuenta` | `/cuenta` | SegmentedControl, Toggle, Button |
| `/equipo/acceso`, `/equipo/locales`, `/equipo/clave` | `/equipo/acceso` (con sesión muestra locales), nuevo `/equipo/clave` | AppShell staff, Field, VenueRow (equipo) |
| `/barra/:slug` | `/staff/[venueId]` | OrderCard barra, Tabs (móvil), Toggle (pausa), Sheet (rechazo, validar), ConnectionBanner, sonido |
| `/admin/:slug/:tab` | `/admin/[venueId]?tab=` | Tabs/side nav, MetricTile, Rows, Toggle, Sheet (editor, alta, rol, quitar acceso), BlockCard, SecretReveal |

Responsive: cliente centrado (480/640/1040) con nav inferior hasta 1023 px y superior desde 1024; Explorar en 1/2/3 columnas (≥720, ≥1024); barra en pestañas hasta 1023 y tres columnas desde 1024; admin con pestañas hasta 1023 y navegación lateral de 220 px desde 1024. Hojas abajo hasta 719 px. Safe areas en cabecera, navegación y dock.

## 6. Movimiento, sonido y estados

Tabla completa de disparadores en `docs/plan-v1.md` §4.3; clases CSS: `.stepper.enter` (grow-in), `.qty.tick`/`.total.tick` (tick), `.bag.drop` (drop), `.vaso .fill` (vaso-fill), `.anim-bell` (swing, una vez), `.anim-check` (draw), `.ocard.new` (card-in + new-glow 2 s), `.ocard.moved`, `.sheet` (sheet-up), `.banner` (banner-in). Con movimiento reducido: duraciones 0, campana sin oscilar, resalte del pedido nuevo estático 2 s. Prohibido: íconos en bucle, rebotes, sacudidas, parallax, transiciones de página, mover un control mientras se intenta tocar en la barra.

Sonido solo tras gesto (barra: botón de altavoz en la cabecera, tono por pedido nuevo; cliente: interruptor "Avisarme con sonido", apagado por defecto). Vibración 200 ms solo donde `navigator.vibrate` existe (Android); no en iPhone. Wake Lock mientras se muestra el ticket listo; si falla no se muestra nada. La pantalla siempre comunica el estado sin sonido.

Estados por componente: tabla en `docs/plan-v1.md` §4.4, implementada en la maqueta (lista: `?` Revisión › Estado de listas).

## 7. Lógica, permisos y textos

| Acción | Quién | Estado | Error → texto de la maqueta → recuperación |
| --- | --- | --- | --- |
| Pedir | cliente con perfil | carrito con ítems, local abierto | `OUT_OF_STOCK` "Un producto se agotó. Quitalo para seguir." → Revisar carrito · `PRICE_CHANGED` "Cambió un precio. Revisalo para seguir." → Aceptar precio nuevo · `VENUE_CLOSED`/`PAUSED`/`CAPACITY` (carrito conservado) · `OFFLINE` "Sin conexión. No se hizo ningún cambio." → Reintentar con la misma clave de intento · `SESSION_EXPIRED` → hoja |
| Doble envío | — | — | misma clave de intento → mismo pedido |
| Cancelar | cliente dueño | `queued` | `VERSION_CONFLICT` "El local ya aceptó tu pedido. Ya no se puede cancelar." |
| Aceptar / Rechazar | empleado o admin del local | `queued` | conflicto "El cliente canceló #0425 antes de que lo aceptaras."; rechazo exige motivo ≥3 caracteres (motivos rápidos + Otro) |
| Marcar listo | empleado o admin | `preparing` | sin conexión: deshabilitado, nada se encola |
| Validar retiro | empleado o admin del local | `ready` | número público, código inválido, de otro local, consumido, no listo — cada uno con su texto |
| Pausar/reanudar | empleado o admin (P-6) | abierto/pausado | cerrar: solo admin |
| Menú, disponibilidad, negocio | admin | — | cambiar precio sube la versión → carritos piden confirmar |
| Alta / rol / quitar acceso | admin del local | — | correo de cliente "Ese correo ya es de una cuenta personal. Usá otro correo para la cuenta laboral." · ni uno mismo ni el último admin · quitar acceso borra solo la membresía de ese local; la barra abierta muestra "Ya no tenés acceso a este local" |
| Cambio de clave | staff con clave temporal | primer ingreso | navegación y comandos rechazados (`PASSWORD_CHANGE_REQUIRED`) hasta cambiarla |
| Sesión vencida | todos | navegación o acción | navegación → acceso con `next`, correo y aviso; acción → hoja; carrito por cuenta, otra cuenta no lo ve |

Guardas de rutas: misma política que `src/lib/access-policy.ts` (no cerrar sesiones solas; sesión del tipo equivocado → `/sesion-activa`), más sesión vencida y cambio de clave.

## 8. Datos del demo

`data/venues.js` separa `ONZA_FACTS` (nombre, barrio, dirección publicada y fuentes de Mil948, Stiefel Pub, Wilk Craft Beer, Apotecario y Otro Bar) de `ONZA_DEMO` (estado, horario, menú, precios, distancias de maqueta, cuentas ficticias `.demo`). Coordenadas, fotos y logos: `null` — la red de la sesión bloqueó OpenStreetMap, Wikimedia y los sitios; no se inventaron. La fuente de Apotecario es un directorio de terceros: confirmar en su sitio. Onza no tiene relación comercial ni autorización de estos locales.

Imagen `assets/ejemplo/portada-generada.jpg`: ilustración generada por el repo (`public/demo-venues`), usada solo en el catálogo para mostrar el tratamiento fotográfico; no representa a ningún local.

## 9. Contradicciones y puntos sin resolver

1. **Local cerrado.** El plan (§2) decía "Agregar deshabilitado" como comportamiento por defecto, pero la app hoy oculta el menú y P-1 propone solo lectura. La maqueta conserva el comportamiento actual (oculto) y deja P-1 conmutable. Decide Manu.
2. **Borrado de cuenta.** El blueprint 0.1 lo acordó como función ("borrado de cuenta funcional"), pero el plan V1 lo dejó como P-4 (si entra en la demo). Requiere decisión de alcance.
3. **Particle Wave en `/equipo/acceso` (P-5).** La decisión firme cubre `/acceso`; extenderlo al portal laboral no está confirmado.
4. **Pausa desde la barra (P-6).** Los bocetos aprobables la ponían en la barra; la app actual la tiene solo en admin.
5. **Fondo ivory (P-2).** La maqueta lo usa por defecto para poder evaluarlo; no está aprobado.
6. **"Hero adjunto".** No llegó a esta sesión; la referencia aprobada es el acceso actual del repo (instrucción de Manu en F1).
7. **AGENTS.md "Lucide estático por defecto".** Se respeta: los íconos son estáticos y solo se animan una vez ante un evento (agregar, confirmar, listo, retiro validado).
