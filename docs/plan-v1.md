# Onza V1 demo — plan ejecutable

Rama: `fix/hosted-integration`. Sin ramas nuevas, sin tocar `main`. Plan aprobado por Manu el 2026-11-17; F1 ejecutada. **F1 es una ejecución parcial: no sustituye ni cancela F2–F7.**

## Estado de ejecución (leer primero)

| Fase | Estado | Entregables / siguiente paso |
| --- | --- | --- |
| F1 · Maquetas y sistema visual | ✅ Terminada y aprobada por Manu como base visual (commit `8cb0b41`) | `design/maquetas-v1/` |
| F2 · Tokens y primitivas | ✅ Implementada | `design/tokens.json` → `tokens.css` (42 pares de contraste), `src/styles/globals.css`, `primitives.tsx`, `sheet.tsx`, `connection-banner.tsx`, `/design-system` actualizado. `NumberFlow` no se añadió (P-7 sigue pendiente). Falta: los íconos animados son solo CSS (campana, check, vasito, dock) |
| F3 · Cliente | ✅ Implementada | Explorar (portada, más cercano solo con ubicación fiable, cerrados al final), local, producto, carrito por cuenta con revisión, checkout con errores por código, pedido con ticket, cuenta, sesión vencida. Pendiente: fotos/logos reales (sin fuente verificable) y P-1 (menú de local cerrado) |
| F4 · Equipo | ✅ Implementada | `StaffShell`, `/equipo/acceso` (directo al local), `/equipo/locales`, `/equipo/clave`, barra densa con rechazo en hoja y validar retiro en hoja |
| F5 · Administración y equipo | ✅ Código y pruebas; **migración 011 sin aplicar a `onza-dev`** | Pestañas por URL, Disponibilidad, Negocio, Equipo; `/api/team` y `/api/team/password` (necesitan `SUPABASE_SERVICE_ROLE_KEY` de servidor). Pendiente: R3/R5 (P-4) |
| F6 · Datos del demo | ✅ Código y seed; **migración 012 y seed sin aplicar** | `fixtures/real-venues.json` (hechos con fuente vs. simulado), `npm run demo:seed-real-venues`. Pendiente: coordenadas, fotos y logos (sin acceso a fuentes) |
| F7 · Verificación y Preview | 🟡 Parcial | Local: typecheck, lint, 107 pruebas, build, 65 controles del recorrido real sobre PGlite. CI en verde en `709b42e` (incluye Supabase local real y E2E en vivo); Vercel construyó el Preview. **Sin hacer**: migraciones y seed en `onza-dev`, verificación en el Preview, teléfonos físicos. Pasos exactos en `docs/vercel-demo.md` |

Para continuar (Sonnet u otra IA): leer `DIARIO.md` → este archivo → `design/maquetas-v1/GUIA.md` → abrir las maquetas. La guía es la fuente visual; este plan, la fuente de alcance, tareas y criterios.

### Instrucciones consolidadas de Manu (todas vigentes)

1. Decisiones firmes del encargo original (login obligatorio, Google + correo, Apple "Próximamente", cuentas separadas, sin turnos, "¿Sos personal?", empleado/administrador por local, admin gestiona equipo/menú/disponibilidad/negocio, conservar pedidos/Realtime/aislamiento/retiro privado/idempotencia, cancelar solo antes de aceptar, pagos simulados).
2. Dirección visual: acceso actual del repo como referencia aprobada; Particle Wave original solo en el acceso; vasito y SVG originales; negro `#0D0D0E`, ivory `#F4F1ED`, oxblood `#741F2C`; sobrio, fotografía protagonista, controles consistentes, textos cortos.
3. Bares reales: nombres y ubicaciones reales; logos y fotos aportados o con uso permitido; fuentes guardadas; revisión de permisos pendiente antes del lanzamiento; nunca afirmar autorización ni relación comercial; no bloquear las maquetas por eso.
4. Alta laboral con contraseña temporal y cambio obligatorio; invitación por correo para después; no implementar ambos métodos; no contratar servicios.
5. Correcciones al plan: el stepper permite quitar el último producto; el cambio de clave se exige también en las APIs; revocar quita solo la membresía de ese local y el servidor rechaza acciones posteriores; P-1–P-4 siguen siendo propuestas; verificación dirigida por fase y suite integral al final.
6. Ampliación "cómo se siente": referencias con decisión, catálogo breve con procedencia, reglas de movimiento y estados, maquetas que demuestren flujos, correspondencia maqueta → componente (§4.1–4.5, §5.1, §8 y `GUIA.md`).
7. F1: Claude diseña y decide lo visual; Sonnet debe poder seguirlo; priorizar coherencia sobre cantidad de capturas; no tocar producto, Supabase ni Vercel; no inventar fotos, coordenadas ni verificaciones; terminar F1 y detenerse para revisión.

Contradicciones sin resolver: `design/maquetas-v1/GUIA.md` §9.

## Contexto

Onza ya tiene un backend que funciona: pedidos idempotentes, Realtime, aislamiento por local (RLS + servidor), retiro con código privado y QR, cancelación solo antes de aceptar, pagos mock, cuentas obligatorias (`ACCOUNTS_REQUIRED=true` en el Preview) y acceso con Particle Wave original. La experiencia no está a la altura: hay dos paletas, el portal del equipo está a medias, el administrador no puede gestionar su equipo, una sesión vencida termina en un error sin salida y los locales son ficticios. El objetivo es una V1 demo coherente y comprobable para cliente, empleado y administrador, **reutilizando el backend** y cambiando solo lo necesario.

### Qué se pudo comprobar en esta sesión (y qué no)

| Fuente | Estado |
| --- | --- |
| Código del repo (clon superficial de la rama) | Leído selectivamente: `src/proxy.ts`, `src/lib/access-policy.ts`, `layout.tsx`, `navigation.tsx`, páginas de cliente/equipo/admin, `login.tsx`, `admin-panel.tsx`, `queue.tsx`, `client-api.ts`, `cart-store.ts`, tokens y migraciones |
| DIARIO, blueprint §0, `docs/hosted-ux-plan.md`, bocetos y capturas | Leídos |
| Demo `onza-demo.vercel.app`, Supabase `*.supabase.co`, OSM, Wikimedia, 21st.dev, sitios de bares | **Bloqueados** por la política de red del contenedor (403 del proxy / ENOTFOUND). **No se recorrió la app en navegador.** |
| Conector Supabase | Solo ve otra organización ("Pedidos SaaS", "pedidos-staging"); **sin acceso a `onza-dev`** |
| Búsqueda web | Disponible (solo resultados, sin abrir páginas) |
| Hero adjunto del mensaje | **No llegó a esta sesión.** Referencia usada: `docs/evidence/access/access-desktop.png` (acceso actual) |

Todo hallazgo de abajo es **lectura de código o capturas previas**, salvo que diga lo contrario. Ninguna función se marca como "comprobada" en esta sesión.

---

## 1. Mapa de rutas y permisos (estado actual)

| Área | Ruta | Quién | Estado actual |
| --- | --- | --- | --- |
| Entrada | `/acceso` | sin sesión | Implementado y comprobado en Preview (D-17-04): Google (sin configurar), Apple deshabilitado, correo, "¿Sos personal?" |
| | `/confirmar`, `/recuperar`, `/restablecer`, `/auth/callback` | sin sesión | Implementado; correo real sin probar |
| | `/onboarding` | cliente sin perfil | Implementado; probado con datos ficticios (D-16-06) |
| | `/sesion-activa?want=` | sesión del tipo equivocado | Implementado (R2) |
| Cliente | `/` Explorar | cliente | Lista con abiertos primero, ubicación opcional; sin coordenadas reales |
| | `/v/[slug]`, `/v/[slug]/p/[id]` | cliente | Menú, detalle, agregar; cabecera solo texto |
| | `/cart`, `/checkout` | cliente | Carrito de un local, checkout mock con intento idempotente local |
| | `/orders`, `/orders/[id]` | cliente | Seguimiento Realtime, cancelar si `queued`, ticket con QR + código |
| | `/cuenta` (`/settings` redirige) | cliente | Apariencia, preferencias, condiciones, cerrar sesión. Sin borrado (R3) |
| | `/policies` | todos | Borrador |
| Equipo | `/equipo/acceso` (`/login` redirige) | staff | Formulario + lista de membresías |
| | `/staff/[venueId]` | empleado o admin del local | Cola Nuevos/Preparando/Listos, validar retiro |
| | `/admin/[venueId]` | admin del local | Pestañas Resumen/Pedidos/Menú/Perfil/Ajustes |
| Interno | `/onza`, `/design-system` | rol `onza` / dev | Fuera del alcance visual V1 |

Permisos en servidor: tipo de cuenta por membresía (`current_account`), `has_venue_access(venue, admin_only)`, roles DB `bartender/admin/onza`. **Se conservan en DB (R4)**; la UI los muestra como **Empleado** / **Administrador**.

## 2. Recorridos: objetivo, fricción, evidencia, solución y criterio

Formato compacto. "Evidencia" = archivo:línea o captura.

### Cliente

| Recorrido | Problema observado · evidencia | Solución | Aceptación |
| --- | --- | --- | --- |
| **Acceso y recuperación** | Funciona. Falta estado "correo no confirmado → reenviar" y mensaje de límite de envíos de Supabase | Conservar pantalla; añadir estados reenviar/límite/enlace vencido en `/confirmar` y `/restablecer` | Cada error de Auth tiene texto propio y una acción; destino QR (`next`) sobrevive a confirmar y onboarding |
| **Sesión vencida** | El proxy solo protege navegaciones; un `fetch` a `/api/commands` con sesión vencida devuelve `NOT_AUTHORIZED` → "Tu sesión no tiene permiso para este pedido o local" (`src/lib/errors.ts:19`, `client-api.ts`). Sin salida | Código `SESSION_EXPIRED` distinto (servidor: `getUser()` nulo ≠ sin permiso). Cliente: hoja "Tu sesión venció · Volver a entrar" con `next` a la pantalla actual; carrito conservado por cuenta (R6 mínimo) | Prueba: expirar cookie en checkout → hoja → login → vuelve a checkout con el mismo carrito; otra cuenta en el mismo dispositivo no lo ve |
| **Descubrimiento** | Copy "Locales ficticios" (`src/app/page.tsx:24`); sin coordenadas, el orden por cercanía no se puede demostrar (D-16-05) | Bares reales con coordenadas verificadas (§6); tarjeta con foto protagonista; buscador | Con ubicación: "Más cerca" con distancia; sin ubicación: orden abiertos → nombre, sin distancias inventadas |
| **Ubicación denegada / imprecisa** | Implementado (D-16-04), solo emulado | Mantener lógica; texto corto "Sin ubicación · ordenado por disponibilidad" y botón para reintentar | Denegar, timeout y precisión >1 km no muestran distancias |
| **Local cerrado / pausado** | En el menú, cerrado oculta todo el menú (`v/[slug]/page.tsx:46`) | Ver propuesta P-1 y contradicción `GUIA.md` §9.1 (la maqueta conserva el menú oculto). Propuesta original: estado arriba, Agregar deshabilitado, carrito de ese local bloqueado en checkout con mensaje | El servidor ya rechaza pedidos a locales cerrados; la UI lo explica antes del checkout |
| **Menú** | Cabecera solo texto, botón Agregar de ancho completo por fila (captura `docs/evidence/hosted/customer-390-light-1.png`, anterior) | Cabecera con portada+logo; filas compactas del boceto (imagen 64–72 px, Agregar → stepper); etiqueta "Menú y precios de demostración" | Fila ≤ 96 px a 390; stepper 44 px; agotado visible y no accionable |
| **Carrito por local** | Funciona (reemplazar/conservar, dock solo en local dueño). Clave `onza-cart-draft` no ligada a la cuenta (`cart-store.ts:73`) | Clave por id opaco de cuenta; logout limpia (ya), vencimiento conserva (R6) | Prueba de dos cuentas en un dispositivo |
| **Checkout** | Funciona mock e idempotente (`checkout.tsx:65-78`) | Rediseño visual: resumen, total, "Pago simulado · sin dinero real", una acción | Doble clic / recarga no crea dos pedidos (prueba existente se mantiene verde) |
| **Seguimiento / desconexión** | `use-live-orders.ts` ya distingue Conectado/Reconectando/Sin conexión, pero se muestra como texto suelto | Componente `ConnectionBanner` común (cliente y barra) persistente mientras dure | Cortar red → banner; al volver → refetch y banner desaparece |
| **Cancelación** | Solo si `queued` (`order-detail.tsx:170`); servidor con un ganador | Conservar; confirmación en hoja; si el local acepta mientras tanto: "El local ya aceptó tu pedido" | Carrera aceptar vs cancelar: un ganador, UI coherente (prueba existente) |
| **Retiro** | Código privado + QR, número público rechazado (INC-001) | Ticket "Listo" a pantalla completa con punto de retiro, QR, código agrupado; brillo/contraste altos | Sin cambios en `pickup-service.ts`; capturas en ambos temas |
| **Cuenta** | Sin borrado (R3), sin R5 | Fuera de V1 demo salvo que lo decidas (P-4) | — |

### Empleado

| Recorrido | Problema · evidencia | Solución | Aceptación |
| --- | --- | --- | --- |
| **Ingreso** | Con sesión iniciada, `/equipo/acceso` sigue mostrando el formulario y debajo botones "Abrir barra" sin nombre de local, uno por `venue_id` (`login.tsx:33-137`) | Con sesión: selector de locales con nombre/logo y rol; con un solo local, redirección directa a la barra; sin sesión: formulario | Staff con 1 local entra directo; con 2 ve ambos nombres; nunca ve el formulario estando dentro |
| **Primer ingreso** | No existe | `/equipo/clave` obligatoria si `must_change_password` (§5 F5) | No se puede abrir barra hasta cambiarla |
| **Navegación / cabecera** | La cabecera global de cliente (logo → `/`, "DEMO", cuenta) aparece en rutas de equipo (`layout.tsx:36-43`); logo lleva a `/` → `/sesion-activa`. Nav inferior "Espacios de trabajo" vuelve al formulario (`navigation.tsx:21`) | Shell de equipo propio: logo + "Equipo" + local + persona·rol + Salir (boceto `barra-1440-claro.png`) | Ningún enlace de equipo lleva al área cliente |
| **Cola de barra** | Rechazo con `window.prompt` (`queue.tsx:54`): no accesible, sin motivos rápidos | Hoja con motivos predefinidos ("Sin stock", "Cliente no está"…) + texto | Teclado y lector de pantalla; motivo ≥ 3 caracteres validado |
| **Validar retiro** | Funciona; cámara solo con permiso | Conservar; estados de código inválido / consumido / de otro local claros | Pruebas existentes de pickup verdes |
| **Errores de acceso** | Página de error enlaza a `/login` y pierde `next` (`staff/[venueId]/page.tsx:31`, `admin/[venueId]/page.tsx:38`); NOT_AUTHORIZED se muestra como "configuración" | Estado "No tenés acceso a este local" + "Cambiar de local"; sesión vencida → `/equipo/acceso?next=` | Empleado de A que abre `/staff/B` ve el estado correcto |

### Administrador

| Recorrido | Problema · evidencia | Solución | Aceptación |
| --- | --- | --- | --- |
| **Equipo** | No existe; staff solo por `scripts/seed-users.mjs` | Pestaña Equipo: alta con contraseña temporal mostrada una vez, cambio de rol, revocar acceso (§5 F5) | Alta con correo de cliente rechazada (R1.3); no puede quitarse a sí mismo ni al último admin; revocar corta la sesión |
| **Menú** | Funciona (crear, editar, agotar, imagen) | Reubicar en filas del sistema; agotar como interruptor inline | Sin regresión en `tests/admin` y `product-image.spec.ts` |
| **Disponibilidad** | Está en "Ajustes" mezclado con contacto/capacidad (`admin-panel.tsx:432+`) | Pestaña Disponibilidad: Abierto / Pausado / Cerrado + agotados del día | Cambiar a Pausado se refleja en Explorar vía Realtime o refetch |
| **Negocio** | "Perfil" (imágenes, coordenadas) + "Ajustes" (contacto, horario texto) separados | Unificar en "Negocio": portada, logo, dirección, coordenadas, punto de retiro, horario informado, contacto | Un único formulario por bloque, guardado con estado visible |
| **Navegación** | Pestañas en estado React; recargar pierde la pestaña (`admin-panel.tsx:26`) | Pestaña en `?tab=` | Recargar conserva pestaña; enlace directo funciona |

## 3. Problemas prioritarios (impacto × esfuerzo)

| # | Prioridad | Problema | Esfuerzo |
| --- | --- | --- | --- |
| 1 | P0 | Dos paletas: app `#681d3b` sobre blanco/grafito vs. acceso negro/ivory/`#741F2C` (`design/tokens.css:3-15`) | Bajo |
| 2 | P0 | Admin no gestiona equipo (decisión firme incumplida) | Alto (migración + ruta servidor) |
| 3 | P0 | Sesión vencida sin salida en acciones | Medio |
| 4 | P0 | Portal del equipo: formulario siempre visible, locales sin nombre, cabecera de cliente | Medio |
| 5 | P0 | Locales ficticios y sin coordenadas: no se puede demostrar descubrimiento | Medio (datos + verificación) |
| 6 | P1 | `window.prompt` en rechazo; errores NOT_AUTHORIZED como "configuración" | Bajo |
| 7 | P1 | Menú/Explorar sin fotografía protagonista; filas largas | Medio |
| 8 | P1 | Carrito no ligado a cuenta (R6) | Bajo |
| 9 | P1 | Estados de conexión no unificados | Bajo |
| 10 | P2 | Pestañas admin sin URL; horario como texto libre | Bajo |
| — | Abierto | PEN-001 (React `use()`) no reproducido; vigilar en las pruebas de cada fase | — |

## 4. Sistema visual

**Lenguaje:** el acceso es la única pantalla con movimiento (Particle Wave original ya implementado en `src/components/backgrounds/particle-wave.tsx`; no se rehace ni se reutiliza fuera de `/acceso` y `/equipo/acceso`). El resto: sobrio, fotografía protagonista en Explorar y cabecera del local, tipografía Inter con escala firme, controles idénticos en los tres roles.

**Tokens (cambio en `design/tokens.json` → `scripts/generate-tokens.py`):**

| Token | Claro | Oscuro | Nota |
| --- | --- | --- | --- |
| `bg` | `#F4F1ED` ivory (propuesta P-2, pendiente) | `#0D0D0E` | Reemplaza blanco/`#111113`; la maqueta permite comparar con fondo blanco |
| `surface` / `surface-raised` | ivory −3% / `#FFFFFF` | `#161618` / `#1E1E21` | Derivados documentados en `contrast-audit.md` |
| `text` / `text-muted` | `#0D0D0E` / ~`#5E5A55` | `#F4F1ED` / ~`#ABA6A0` | Verificar ≥ 4.5:1 |
| `brand` (relleno) | `#741F2C` | `#741F2C` | Ivory sobre oxblood ≈ 9.4:1 |
| `brand-text` | `#741F2C` | tinte claro (~`#E3A3AC`, a verificar) | Oxblood sobre negro ≈ 1.8:1: **nunca como texto en oscuro** |
| `access-*` | se fusionan con los anteriores | | Una sola fuente de verdad |

Escala: display 32/38, title 28/34, heading 20/26, body 16/24, label 14/20, caption 12/16 (se conservan). Espaciado 4–64 (se conserva). Radios 12/16/24. Táctil 44, control 48, barra 56. Anchos: cliente 480, menú 640, explorar 1040, operación 1280.

**Componentes (uno por patrón, variantes tipadas, en `src/components/ui/`):** `AppShell` (variante cliente | equipo), `BottomNav` (móvil) / barra lateral (≥ 1024 en equipo/admin), `PageHeader`, `VenueCard` (foto 16:9, logo, estado, distancia), `VenueHero`, `ProductRow` + `QuantityStepper`, `StatusBadge`, `Sheet` (Radix ya instalado), `EmptyState`, `ErrorState` (con acción), `ConnectionBanner`, `SessionExpiredSheet`, `OrderCard` (cliente y barra con variantes), `Tabs` con URL, `Field`/`Toggle`/`SegmentedControl`. Lucide estático, transiciones 100–300 ms con reduced motion.

**Móvil / escritorio:** cliente es móvil primero (≤ 480 centrado en escritorio, Explorar en grilla 2–3 columnas ≥ 768). Barra: 1 columna con pestañas en móvil, 3 columnas ≥ 1024. Admin: pestañas arriba en móvil, lateral ≥ 1024. Safe areas y dock por encima de la barra inferior.

### 4.1 "Premium" en decisiones concretas

| Dimensión | Regla |
| --- | --- |
| Color | Oxblood solo para: acción primaria (una por vista), selección activa y punto del wordmark. Estados (éxito/aviso/error) apagados, nunca saturados. Ivory/negro como base; sin grises azulados |
| Superficies | Bordes de 1 px en lugar de sombras; una sola elevación (hojas y diálogos). Radios 12 controles / 16 medios / 24 hojas, sin excepciones |
| Fotografía | Explorar: portada 16:9 con texto **debajo** de la foto (sin velos ni degradados sobre la imagen). Cabecera del local: 3:2 en móvil, 21:9 en escritorio. Sin filtros; mismo recorte en todos los locales; placeholder del color `surface` mientras carga. Sin foto: monograma tipográfico actual, nunca un genérico de stock |
| Tipografía | Inter variable local. Máximo tres tamaños por pantalla. Display con tracking −0.02em; eyebrow 12/16 mayúsculas +0.06em. Cifras tabulares (`font-variant-numeric: tabular-nums`) en precios, totales, tiempos, número de pedido y código de retiro. Código de retiro en grupos de 4 |
| Densidad | Cliente: filas de 88–96 px, aire alrededor de la foto. Barra: tarjetas densas, controles de 56 px, texto de pedido 17–18 px legible a un brazo. Admin: filas de tabla de 48 px |
| Copy | Verbos cortos ("Agregar", "Pedir", "Marcar listo"). Un solo mensaje por estado; sin párrafos explicativos |
| Vasito | Ícono de app, marca de carga de página (estático), y un único momento animado: confirmación del pedido (se llena una vez) |
| Carga | Esqueletos estáticos con la forma final, sin brillo perpetuo. Spinner solo dentro del botón que se tocó |

### 4.2 Catálogo de componentes y procedencia

Regla: pocos componentes, todos reescritos sobre nuestros tokens y CSS (el proyecto no usa Tailwind; los componentes shadcn de 21st.dev se **adaptan**, no se pegan). Cada origen se registra en `THIRD_PARTY_NOTICES.md`.

| Componente Onza | Procedencia | Licencia | Decisión |
| --- | --- | --- | --- |
| Fondo del acceso | [Particle Wave · @jahed (21st.dev)](https://21st.dev/@jahed/components/particle-wave), código original ya integrado | Registrada en notices | **Conservado**; solo `/acceso` y `/equipo/acceso` |
| Íconos | `lucide-react` (ya instalado) | ISC | Base de todos los íconos |
| Íconos animados (4: agregar, confirmar, pedido listo, retiro validado) | Animación propia en CSS sobre el SVG de Lucide (trazo y transformaciones) | ISC (Lucide) | Sin dependencia nueva. [lucide-animated / pqoqubbw](https://github.com/pqoqubbw/icons) (MIT) evaluado y **no adoptado**: exige `motion` para cuatro íconos |
| Número animado (total del dock, cantidad del stepper, contadores de barra) | [NumberFlow · Maxwell Barvian](https://github.com/barvian/number-flow), `@number-flow/react` | MIT, sin dependencias | **Propuesto como única dependencia nueva**; se decide en F1 al ver la maqueta. Alternativa sin dependencia: fundido de 160 ms |
| Stepper de cantidad | `QuantityStepper` existente + semántica `spinbutton` de [Number Stepper · alexisroe](https://21st.dev/@alexisroe/components/number-input.md) (MIT) | MIT | Se adapta el patrón, no se importa |
| Hoja / diálogo | `@radix-ui/react-dialog` (ya instalado) | MIT | Base de `Sheet`, confirmaciones, rechazo, sesión vencida |
| Descartados | Steppers de 21st.dev sin licencia declarada (p. ej. "Quantity", "Number Stepper" de otros autores) | sin licencia | No se usan |

21st.dev no es accesible desde este entorno: antes de adaptar un componente de ahí, se obtiene su código original (dominio permitido o archivo aportado por Manu), igual que se hizo con Particle Wave. Nunca se presenta una recreación como original.

### 4.3 Movimiento

Tokens existentes: press 100 ms, state 160 ms, sheet 220 ms, confirm 300 ms, `cubic-bezier(0.2,0,0,1)`; se agrega `celebrate` 600 ms (solo confirmación). Con `prefers-reduced-motion` todos van a 0 y se reemplazan por cambio instantáneo de estado; el texto siempre comunica lo mismo que la animación.

| Momento | Disparador | Comportamiento | Duración | Movimiento reducido |
| --- | --- | --- | --- | --- |
| Agregar | Toque en Agregar | El botón se transforma en stepper; el ícono del carrito del dock baja 4 px y vuelve; el total cambia con NumberFlow | 160 + 220 ms | Cambio inmediato |
| Cambiar cantidad | − / + | Dígito rueda. Con cantidad 1, el − se convierte en papelera ("Quitar") y elimina la línea: nunca queda un artículo atrapado | 200 ms | Inmediato |
| Pedir | Toque en "Pedir" | Spinner en el botón (mínimo 300 ms visible para evitar parpadeo), controles bloqueados | — | Igual |
| Pedido confirmado | Respuesta del servidor | Vasito se llena una vez y lleva al seguimiento | 600 ms | Check estático + "Pedido enviado" |
| Cambio de estado del pedido | Evento Realtime o refetch | Paso de la línea de tiempo se completa; título con fundido | 300 / 160 ms | Inmediato |
| Pedido listo | Evento `ready` | Tarjeta pasa a oxblood, ícono campana oscila una vez, sonido opcional, `aria-live` | 400 ms, una vez | Sin oscilación |
| Barra: pedido nuevo | Evento Realtime | Tarjeta entra desde arriba; fondo resaltado se apaga en 2 s; contador se actualiza; tono si el sonido está activado | 220 ms | Sin entrada, resaltado estático 2 s |
| Barra: aceptar / listo | Toque | La tarjeta se mueve de columna (FLIP) | 220 ms | Salto directo |
| Retiro válido | Validación OK | Panel verde, check se dibuja, "Entregado #0427" | 300 ms | Check estático |
| Retiro inválido | Validación rechazada | Borde y mensaje de error persistentes; foco vuelve al campo. **Sin sacudida** | 160 ms | Inmediato |
| Hojas | Abrir/cerrar | Desliza desde abajo (móvil) o centro (escritorio) | 220 ms | Fundido 0 ms |
| Banner de conexión | Cambio de conexión | Desliza bajo la cabecera y queda fijo mientras dure | 160 ms | Inmediato |

Prohibido: íconos en bucle, rebotes, parallax, transiciones de página completas, animaciones que muevan un control mientras se intenta tocar en la barra.

**Sonido y hápticos (soporte real):**
- Sonido: Web Audio solo tras un gesto ("Activar sonido"), como ya hace `src/features/notifications/ready-sound.tsx`, según la política de autoplay ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices), [Chrome](https://developer.chrome.com/blog/autoplay)). Barra: tono por pedido nuevo con interruptor visible. Cliente: tono al quedar listo, desactivado por defecto. Nunca es la única señal.
- Hápticos: `navigator.vibrate` no existe en Safari de iOS ([informe W3C](https://w3c.github.io/vibration/reports/implementation.html)). Solo Android, una vibración de 200 ms cuando el pedido queda listo, opcional. No se usan trucos no estándar. Sin promesas de hápticos en iPhone.
- Pantalla del ticket: Screen Wake Lock para que no se apague mientras se muestra el QR ([soporte iOS 18.4+](https://caniuse.com/wake-lock)); la web no puede subir el brillo, así que el ticket usa máximo contraste. Si falla, no pasa nada visible.

### 4.4 Estados por componente

| Componente | Cargando | Éxito | Error | Deshabilitado | Desconectado |
| --- | --- | --- | --- | --- | --- |
| Botón primario | Spinner interno, ancho fijo, `aria-busy` | Vuelve a normal; resultado en pantalla | Mensaje junto al botón, botón activo para reintentar | Opacidad + motivo visible cerca ("Local cerrado") | Deshabilitado con "Sin conexión" |
| Agregar / stepper | — (local) | Stepper | — | Agotado: "Agotado", sin Agregar; si ya estaba en el carrito, la línea queda con "Quitar" disponible | Funciona (carrito local) |
| Explorar / menú | Esqueleto | — | `ErrorState` + Reintentar | Local cerrado atenuado | Contenido en caché + banner |
| Checkout | Botón con spinner | Vasito → seguimiento | Por código (ver §4.5) | Sin ítems / local cerrado | No permite pedir; conserva carrito |
| Seguimiento | Esqueleto | Línea de tiempo | `ErrorState` | — | Banner "Reconectando…", refetch al volver |
| Tarjeta de barra | — | Se mueve de columna | Mensaje en la tarjeta + Reintentar; conflicto → refresca | Acción no válida para su estado no aparece | Acciones deshabilitadas + banner; nada se encola a ciegas |
| Formularios admin | Botón con spinner | "Guardado" persistente junto al bloque | Por campo + general | Sin cambios → Guardar deshabilitado | No guarda; conserva lo escrito |

### 4.5 Lógica de flujos: permisos × estado × resultado × recuperación

**Pedido** (estados reales en DB: `pending_authorization → queued → preparing → ready → delivered`, más `canceled`, `expired`, `uncollected`).

| Acción | Quién | En qué estado aparece | Al completarse | Si falla | Recuperación |
| --- | --- | --- | --- | --- | --- |
| Pedir | Cliente con perfil | Carrito con ítems, local abierto y no pausado | Pedido `queued` (mock aprobado), ticket privado generado | `OUT_OF_STOCK`, `PRICE_CHANGED`, `VENUE_CLOSED/PAUSED/CAPACITY`, red | Línea afectada marcada en el carrito: quitar agotado / aceptar precio nuevo; local cerrado → carrito conservado; red → mismo intento idempotente al reintentar (`onza-checkout-attempt`) |
| Doble envío | — | — | Misma clave de idempotencia → mismo pedido | `IDEMPOTENCY_CONFLICT` | Abrir el pedido existente |
| Cancelar | Cliente dueño | Solo `queued` | `canceled`, desaparece de Nuevos en la barra | `VERSION_CONFLICT` (el local aceptó antes) | Hoja: "El local ya aceptó tu pedido"; se refresca el estado |
| Aceptar | Empleado o admin del local | `queued` | `preparing` en ambas pantallas | Conflicto (cliente canceló) | Tarjeta se refresca y se retira con aviso en línea |
| Rechazar | Empleado o admin | `queued` | `canceled` con motivo visible al cliente | Igual | Igual |
| Marcar listo | Empleado o admin | `preparing` | `ready`; cliente recibe Listo con ticket | Red | Banner, sin reintento automático; botón vuelve a estar activo al reconectar |
| Validar retiro | Empleado o admin del local | `ready` | `delivered`, código consumido | Inválido / consumido / de otro local / intentos agotados | Mensaje específico; el número público nunca sirve |
| Vencimientos | Sistema (barrido con tráfico, PEN-005) | `queued`/`ready` | `expired` / `uncollected` | — | Estado final explicado al cliente |
| Stock cambia | Admin agota | Cualquier momento | Menú del cliente se actualiza al refetch; checkout lo rechaza en servidor | — | Ver "Pedir" |
| Sesión vencida | Cualquiera | Cualquier acción | — | `SESSION_EXPIRED` (nuevo) | Hoja de reingreso con `next`; carrito y borrador conservados para la misma cuenta (R6) |

**Equipo** (F5): crear empleado y cambiar rol → solo admin del local; revocar → borra solo la membresía de ese local (las demás siguen); el servidor rechaza cualquier acción posterior en ese local; nunca el último admin ni uno mismo; correo de cliente → "Usá otro correo para la cuenta laboral"; contraseña temporal → cambio obligatorio antes de cualquier acción, también vía API.

**Sincronización cliente ↔ barra:** Realtime como canal principal (ya implementado), refetch al volver a primer plano y al reconectar, estado visible del canal. La versión del pedido resuelve conflictos: la pantalla siempre muestra lo que dice el servidor después de un error.

## 5. Fases de entrega

Cada fase termina con: commit(s) coherentes en la rama, entrada en `DIARIO.md`, "Siguiente tarea exacta" actualizada y tabla de tareas marcada en `docs/hosted-ux-plan.md` (nueva sección "Plan V1"). **Checkpoint para reanudar:** cada tarea es atómica (≤ 1 commit); una sesión nueva lee esa tabla y continúa en la primera tarea sin marcar.

### F1 · Maquetas HTML navegables (sin tocar la app) — ✅ terminada, pendiente de revisión visual

Entregado en `design/maquetas-v1/`:
- `index.html` (mapa de recorridos), `app.html` (maqueta), `flujo.html` (cliente | barra/admin sincronizados), `componentes.html` (catálogo con estados), `GUIA.md` (guía de implementación), `README.md`.
- `assets/tokens.css`, `assets/components.css` (todas las clases), `assets/templates.js` (un componente = una función), `assets/store.js` (reglas del servidor simuladas: permisos, versiones, idempotencia, stock, revocación, clave temporal), `assets/screens.js` (pantallas y guardas), `assets/review.js` (barra de revisión), assets originales (marca, Inter, ilustraciones, capturas reales del acceso).
- `data/venues.js`: hechos reales con fuentes separados de los datos simulados (se usó `.js` y no `.json` para que funcione también abriendo el archivo sin servidor).
- `scripts/verify-maquetas.mjs` → `verificacion.json` (51 controles) y 9 capturas en `capturas/`.

Comprobado: guardas de acceso; registro → confirmar → perfil (18+, usuario tomado, condiciones); stepper con quitar; carrito de un local con reemplazar/conservar; checkout con carga e idempotencia; pedido visible en la barra sin recargar y resaltado; aceptar/listo reflejado en el cliente; número público rechazado, código privado entrega una vez, código consumido rechazado; cancelar vs aceptar con un ganador; agotado y precio nuevo con recuperación; sesión vencida con reingreso y carrito conservado; sin conexión sin envío; alta con correo de cliente rechazada; contraseña temporal mostrada una vez; quitar acceso a un local sin tocar otros y acción posterior rechazada; clave temporal obligatoria en navegación y comandos; sesión del tipo equivocado; sin desborde en 360/390/1440 claro/oscuro; cero errores de consola.

No comprobado: teléfonos físicos, lector de pantalla real, sonido/vibración/Wake Lock en dispositivos; la maqueta no prueba el servidor real.

### 5.1 Correspondencia maqueta → componentes a implementar

| Maqueta | Componentes | Archivo de la app que cambia |
| --- | --- | --- |
| Acceso y entradas | Particle Wave (sin cambios), `Field`, `Button`, `ErrorState` | `src/app/acceso/`, `auth-form.tsx`, `simple-forms.tsx` |
| Explorar | `AppShell` cliente, `PageHeader`, `VenueCard`, `EmptyState`, `ConnectionBanner` | `src/app/page.tsx`, `venue-list.tsx`, `venue-card.tsx` |
| Local y detalle | `VenueHero`, `StatusBadge`, `ProductRow`, `QuantityStepper`, `NumberFlow`, dock | `v/[slug]/page.tsx`, `product-menu.tsx`, `add-product.tsx`, `cart-dock.tsx` |
| Carrito / reemplazar local | `ProductRow`, `Sheet`, `NumberFlow` | `cart-page.tsx`, `venue-change-dialog.tsx` |
| Checkout | `Button` (cargando), confirmación vasito, `ErrorState` por código, `SessionExpiredSheet` | `checkout.tsx`, `client-api.ts`, `api/commands` |
| Seguimiento y ticket | `OrderCard` cliente, línea de tiempo, `ConnectionBanner`, `Sheet` de cancelación | `order-detail.tsx`, `order-list.tsx`, `use-live-orders.ts`, `ready-sound.tsx` |
| Equipo: acceso, locales, clave | `AppShell` equipo, `Field`, lista de locales (con un solo local, directo a la barra) | `equipo/acceso/page.tsx`, `login.tsx`, nuevo `equipo/clave` |
| Barra | `OrderCard` barra, `Tabs`, `Sheet` de rechazo, `ConnectionBanner`, interruptor de sonido | `queue.tsx` |
| Validar retiro | `Sheet`, `Field`, panel de resultado | `pickup-panel.tsx`, `scan-sheet.tsx` |
| Admin (6 pestañas) | `AppShell` equipo, `Tabs` con URL, filas de tabla, `Toggle`, `SegmentedControl` | `admin-panel.tsx`, `product-editor.tsx`, `venue-profile.tsx`, nuevo `team-panel.tsx` |
| Cuenta | `PageHeader`, `SegmentedControl`, `Toggle` | `cuenta/page.tsx`, `theme-control.tsx` |

### F2 · Tokens y primitivas en la app (sin cambiar comportamiento)
Tareas: tokens nuevos + regeneración (incluye `celebrate`); `contrast-audit.md`; primitivas del §4.2 con los estados del §4.4; cuatro íconos animados en CSS; `NumberFlow` solo si se aprobó en F1; `/design-system` actualizado; acceso pasa a usar los tokens unificados sin cambio visual.
Aceptación: `npm run check`; `tests/e2e/design-system.spec.ts` y `local-ui.spec.ts` verdes; capturas del design system en ambos temas.

### F3 · Cliente
Tareas: AppShell cliente; Explorar con `VenueCard` foto; `VenueHero` y menú compacto; estados cerrado/pausado; carrito por cuenta; checkout visual; `ConnectionBanner`; `SESSION_EXPIRED` (servidor `order-service`/`api/commands` + `SessionExpiredSheet`); ticket listo.
Aceptación: suite existente verde + nuevas pruebas (sesión vencida en checkout, carrito por cuenta, local cerrado). E2E con dos contextos contra Supabase local.

### F4 · Equipo
Tareas: shell de equipo (fuera de la cabecera de cliente); `/equipo/acceso` con/sin sesión y redirección directa; etiquetas Empleado/Administrador; hoja de rechazo; `ErrorState` de acceso con `next`.
Aceptación: pruebas de política (`tests/lib/access-policy.test.ts`) ampliadas; E2E: empleado de A no abre B; flujo aceptar→listo→retiro intacto.

### F5 · Administración y equipo
Tareas:
1. Migración **aditiva** (R4): `staff_accounts(user_id pk, display_name, must_change_password bool default false, created_by, created_at, revoked_at)`; RPC `list_venue_team(venue)` solo admin del local; sin tocar `memberships` ni roles.
2. Ruta servidor `POST /api/team` (crear, cambiar rol, revocar) con `SUPABASE_SERVICE_ROLE_KEY` **solo en servidor**, verificando `has_venue_access(venue, true)`; crear usuario con `auth.admin.createUser` (sin correo), contraseña temporal generada y devuelta una sola vez; rechazar correo existente de cliente (R1.3). **Revocar** borra únicamente la fila `(user_id, venue_id)` de ese local: las membresías de otros locales quedan intactas y no se cierran sesiones globales (solo si la persona se queda sin ninguna membresía). Cada acción posterior ya pasa por `has_venue_access` y RLS en el servidor, así que se rechaza con `NOT_AUTHORIZED` en cuanto se revoca; la barra abierta muestra "Ya no tenés acceso a este local" al siguiente refetch o evento.
3. `/equipo/clave` y guardia si `must_change_password` en **tres capas**: proxy (navegación), APIs (`/api/commands`, `/api/team`, `/api/orders`, `/api/summary` responden `PASSWORD_CHANGE_REQUIRED`) y SQL (`has_venue_access` devuelve falso mientras la marca esté activa), para que no se pueda operar llamando la API directamente.
4. Pestañas con URL: Resumen, Pedidos, Menú, Disponibilidad, Negocio, Equipo.
Aceptación: pruebas SQL (PGlite) de aislamiento del equipo; pruebas de ruta: admin de A no gestiona B, empleado no gestiona, último admin protegido, correo de cliente rechazado, empleado intentando comprar vía API rechazado (R1.6 parcial), **revocar en A no afecta su membresía en B**, **acción posterior a la revocación rechazada en servidor**, **cuenta con cambio de clave pendiente rechazada por la API**.

### F6 · Datos del demo (bares reales, no destructivo)
Tareas: migración aditiva `venues.demo_listed boolean not null default true`; Explorar filtra por `demo_listed`; seed idempotente `scripts/seed-real-venues.mjs` con UUID/slug nuevos, menús y precios simulados, cuentas staff demo por local; locales ficticios pasan a `demo_listed=false` (reversible, sin borrar pedidos ni membresías); imágenes en `public/demo-venues/real/` con `SOURCES.md` y `THIRD_PARTY_NOTICES.md`.
Aceptación: seed dos veces = mismo estado; pedidos antiguos intactos; cada local real con fuente y fecha de verificación.

### F7 · Verificación integral y Preview
Migraciones a `onza-dev` con dry-run (Manu o CLI autorizada), push → Preview automático, verificador HTTPS ampliado (cliente + empleado + admin en tres contextos), capturas 360/390/1440 claro/oscuro, entrada en DIARIO con lo no verificado (teléfonos físicos, Google, correo real).

## 6. Datos para el demo: bares reales

Decisión tuya: nombres y ubicaciones reales; logos y fotos que aportes o con uso permitido; fuentes guardadas; **revisión de permisos queda como pendiente previo al lanzamiento**; nunca se afirma autorización ni relación comercial. Etiqueta visible en el local: "Demo · menú y precios simulados · sin relación comercial con el local".

Candidatos (San José). Dirección según fuentes secundarias encontradas por búsqueda; **coordenadas sin verificar** (OSM/Google bloqueados aquí):

| Bar | Zona / dirección publicada | Fuente encontrada | Pendiente |
| --- | --- | --- | --- |
| Mil948 | Edificio B, Calle Negritos, Barrio Escalante | [World's 50 Best Discovery](https://www.theworlds50best.com/discovery/Establishments/Costa-Rica/San-José/Mil948.html), [La República](https://www.larepublica.net/mil948-brinda-cultura-y-experiencia-de-consumo-con-mixologia/) | Confirmar sitio `mil948.com`, coordenadas |
| Stiefel Pub | Barrio Otoya/Amón, junto a la Embajada de México, frente al CENAC | [Tico Times](https://ticotimes.net/2013/10/08/stiefel-pub-raises-the-craft-beer-bar) | Vigencia, coordenadas |
| Wilk Craft Beer | Avenida 9, Barrio Escalante (antigua embajada de Polonia) | [Lonely Planet](https://www.lonelyplanet.com/articles/best-things-to-do-in-barrio-escalante), [Delfino 2026](https://delfino.cr/2026/01/wilk-donde-la-cerveza-artesanal-se-encuentra-con-el-buen-rock) | Coordenadas |
| Apotecario | 300 m este de la Iglesia Santa Teresita, Barrio Escalante | Ficha que cita `apotecario.cr` | Confirmar en sitio oficial |
| Otro Bar | Barrio Escalante | [World's 50 Best Discovery](https://www.theworlds50best.com/discovery/Establishments/Costa-Rica/San-José/Otro-Bar.html) | Dirección exacta, coordenadas |
| Bebedero (reserva) | Edificio Steinvorth, Calle 1 Av. 1 | [OpenTable](https://www.opentable.com/r/bebedero-san-jose), [La República](https://www.larepublica.net/noticia/bar-bebedero-lleva-su-oferta-coctelera-a-monteverde) | Posible traslado a Monteverde: verificar antes de usar |

Proceso por bar: coordenadas desde OpenStreetMap (nodo citado) contrastadas con una segunda fuente; si no coinciden en < 100 m, coordenadas `null` y la app no inventa distancia. Imágenes: las que aportes, o Wikimedia Commons con licencia y atribución; si no hay, fallback tipográfico. Cada registro guarda `source_urls`, `verified_at`, `asset_source`, `asset_license`.

Las maquetas (F1) no esperan esta verificación: usan los nombres con coordenadas marcadas "por verificar".

## 7. Propuestas que requieren tu decisión (no incluidas por defecto)

**Estado: pendientes, no aprobadas.** Las maquetas las muestran como alternativa conmutable desde la barra de revisión cuando aplica; la implementación usa el comportamiento por defecto hasta que Manu decida.

- **P-1** Local cerrado: mostrar el menú en solo lectura con "Abre a las…" (hoy se oculta). Requiere horario estructurado (P-3) para el "Abre a las".
- **P-2** Fondo claro ivory en toda la app (propuesto en §4) vs. blanco con ivory solo en superficies.
- **P-3** Horario estructurado por día en lugar de texto libre (migración aditiva).
- **P-4** Incluir R3 (borrado de cuenta) y R5 (nuevas condiciones) en la V1 demo, o dejarlos para después de la demo.
- **P-5** Particle Wave también en `/equipo/acceso` (la maqueta usa el mismo marco negro del acceso).
- **P-6** El empleado puede pausar/reanudar pedidos desde la barra; solo el administrador cierra el local.
- **P-7** Añadir `@number-flow/react` para números animados. La maqueta resuelve el cambio con CSS; recomendación: no añadir la dependencia.

## 8. Referencias consultadas y la decisión que sustentan

- [Supabase · Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking): las identidades con el mismo correo verificado se vinculan automáticamente → cuentas laborales solo con correo y contraseña, alta rechazada si el correo ya es de cliente (R1), sin Google en el portal del equipo.
- [Supabase · Rate limits](https://supabase.com/docs/guides/auth/rate-limits) y [discusión del proveedor por defecto](https://github.com/orgs/supabase/discussions/29370): el SMTP integrado envía muy pocos correos → alta laboral con contraseña temporal sin correo; invitación pospuesta.
- [Toast · Orders Hub statuses](https://doc.toasttab.com/doc/platformguide/platformOrderStatuses.html) y [KDS Order Ready](https://doc.toasttab.com/doc/platformguide/platformMarkingKDSOrdersAsOrderReady.html): recibido → en preparación → listo → cerrado con una acción principal por tarjeta → se confirman Nuevos/Preparando/Listos y una sola acción primaria por pedido en la barra.
- WCAG 2.2 (2.5.8 tamaño del objetivo, 1.4.3 contraste; estándar conocido, no reabierto en esta sesión) → tokens 44/48/56 y la regla de no usar oxblood como texto en oscuro.
- [sunday · Order & Pay](https://sundayapp.com/how-it-works/): web app abierta desde el QR, sin descarga → confirma que Onza siga como web app y que el QR conserve el destino durante acceso y onboarding.
- [Mind the Product · OpenTab](https://www.mindtheproduct.com/behind-the-seamless-open-tab-how-a-simple-ordering-feature-turned-into-a-scalable-payments-system/): pedidos que quedaban "Pending" sin fin → todo estado intermedio del pedido tiene vencimiento y salida visible (§4.5).
- [NumberFlow](https://github.com/barvian/number-flow) y [lucide-animated](https://github.com/pqoqubbw/icons): evaluados para movimiento de números e íconos → se adopta solo NumberFlow (si F1 lo aprueba); íconos en CSS propio.
- Curvas Material 3 (énfasis de entrada `cubic-bezier(0.05,0.7,0.1,1)`, cifras de fuentes secundarias): **no adoptadas**; se conservan los tokens propios más cortos porque la barra necesita respuesta inmediata.
- [MDN · Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices), [informe W3C de Vibration](https://w3c.github.io/vibration/reports/implementation.html), [caniuse · Wake Lock](https://caniuse.com/wake-lock) → reglas de sonido, hápticos y pantalla del ticket del §4.3.

## 8.1 Criterios de aceptación pendientes (F2–F7)

Todos los criterios de §5 F2–F7 siguen pendientes. Además, antes de declarar la V1 lista: decisiones P-1–P-7 tomadas; contradicciones de `GUIA.md` §9 resueltas; coordenadas, fotos y logos verificados o explícitamente `null`; R1 con sus cuatro pruebas; recorrido teléfono + computadora en dispositivos físicos por Manu; suite integral (F7) verde una sola vez al final.

## 9. Accesos y dependencias que pueden bloquear el trabajo autónomo

| # | Bloqueo | Impacto | Quién lo resuelve |
| --- | --- | --- | --- |
| 1 | La red del contenedor bloquea `onza-demo.vercel.app`, `*.supabase.co`, `openstreetmap.org`, `commons.wikimedia.org`, `21st.dev` y los sitios de los bares | No puedo recorrer la demo, verificar coordenadas ni descargar imágenes | Manu: agregar esos dominios en Network access del entorno |
| 2 | El conector Supabase ve otra organización, no `onza-dev` | Migraciones y seeds de F5–F7 en `onza-dev` | Manu: ejecutar con CLI o conectar la organización Onza. Las pruebas locales usan PGlite / `supabase start` (Docker presente, imágenes sin comprobar) |
| 3 | Permiso de escritura en GitHub para esta sesión | Sin push no hay Preview | Se solicita al publicar F1; si se rechaza, se entrega ZIP |
| 4 | `SUPABASE_SERVICE_ROLE_KEY` hoy es "solo scripts" | La gestión de equipo (F5) la necesita en servidor (nunca `NEXT_PUBLIC_*`) | Manu: variable de servidor en Vercel Preview |
| 5 | Hero adjunto no recibido | La referencia visual es el acceso actual | Manu: guardarlo en `design/referencias/` |
| 6 | Logos y fotos de los bares | Sin ellos se usa Wikimedia o el fallback | Manu aporta; revisión de permisos antes del lanzamiento |
| 7 | Google OAuth, SMTP propio, textos legales, teléfonos físicos | No bloquean la demo con correo y contraseña | Manu (ya en blueprint §0.3) |
| 8 | Código original de componentes de 21st.dev (fuera de Particle Wave) | No se puede adaptar ninguno sin verlo; hoy solo NumberFlow (npm/GitHub) es viable | Manu: permitir `21st.dev` o aportar el código |
| 9 | Sonido, Wake Lock y vibración en teléfonos reales | Solo se comprueban en dispositivo | Prueba física de Manu (PEN-002) |

## Verificación (resumen por fase)

Criterio: **verificación dirigida** en cada fase (las pruebas del área tocada + `typecheck`/`lint`/`build`), y **suite integral una sola vez al finalizar la implementación** (F7). No se repiten auditorías completas por commit.

- Cada fase: typecheck, lint, build, pruebas del área tocada y `git diff --check`. F7: `npm run check` completo + E2E completo.
- Maquetas: script de capturas + inspección; sin desborde ni errores de consola.
- App: Playwright con dos/tres contextos (cliente, empleado, admin) contra Supabase local; pruebas SQL PGlite para equipo y aislamiento; las invariantes existentes (pedido único, un ganador aceptar/cancelar, código de retiro de un solo uso, aislamiento entre locales) deben seguir verdes.
- Preview: verificador HTTPS ampliado después de cada push autorizado.
- No se declara "funcional" nada que no tenga prueba registrada en DIARIO; teléfonos físicos, Google y correo real quedan explícitamente sin verificar hasta que Manu los pruebe.
