# Onza

## 01 · La experiencia que vamos a construir

Onza convierte una visita a la barra en una secuencia clara: elegir el local, ver el menú, pedir, esperar el aviso y recoger. El cliente siempre sabe qué está pasando. La barra ve una cola ordenada y controla cuánto trabajo acepta. El dueño ve qué se entregó y cuánto se cobró.

El producto inicial es una web app móvil; la app de iPhone es una evolución posterior, no una promesa de reutilizar automáticamente toda la interfaz web. La API, el dominio y la identidad deben poder compartirse con esa futura app.

La tesis de largo plazo sigue siendo inteligencia de barra. Este MVP crea datos confiables de pedidos y entregas; no pretende deducir market sentiment ni elasticidad a partir de una muestra pequeña. Esa capacidad futura se añade cuando existan cobertura de ventas, costos y experimentos suficientes.

**Decidido por el fundador:** web primero; identidad Onza; vaso de shot minimalista ahora sin línea interior; blanco/grafito/borgoña; modo claro y oscuro; fotos de bebidas; cliente y bartender conectados; administración básica; BAC como primera entidad a evaluar; hold al pedir y captura al entregar.

**Propuestas de esta especificación:** invitado mediante sesión anónima de Supabase; Inter para interfaz; Next.js + TypeScript; menú editorial en lista; una barra de recogida por local; tiempos iniciales de cancelación; cuenta demo por rol. Son decisiones razonadas para esta versión, no preferencias atribuidas al fundador.

**Bloqueo de cobros reales:** el contrato público BAC F-CRI-0006171 V5 enumera Licores, Market Place y Facilitadores de Pago en su cláusula 3.11. La decisión de investigar BAC no equivale a autorización para Onza. Construir con MockPaymentProvider; adaptar un producto bancario aprobado después. Ver documento 03.

## 02 · Alcance y condiciones de éxito

### Dentro del MVP

- Descubrimiento de locales ficticios en el demo y acceso directo a un local mediante URL/QR.
- Menú fotográfico, categorías, detalle de producto, cantidades y carrito de un solo local.
- Checkout simulado que explica reserva y cobro posterior; aceptación de políticas y confirmación de mayoría de edad.
- Pedido persistente con seguimiento en tiempo real y ticket de retiro.
- Barra: recibir, aceptar, preparar, marcar listo, validar QR o código y confirmar entrega.
- Administrador del local: productos, precios, disponibilidad, pausa de pedidos y ventas básicas.
- Onza: acceso de administración global para configuración de locales; sin dashboard financiero inventado.
- Diseño adaptable, temas, accesibilidad y estados de error completos.

### Después del MVP

App nativa, tiquetera, favoritos sincronizados, GPS, mapas, bundles, promociones, propinas, cuentas de grupo, monedero, pagos crypto, impresión, integraciones POS, inventario por receta, IA y experimentación de precios. Tampoco entrega parcial: un pedido inicial se entrega completo o se cancela mediante soporte.

### El demo está completo cuando

Dos sesiones independientes pueden terminar el recorrido sobre Supabase. El cliente no pierde el pedido al refrescar. El bartender no entrega ni cobra dos veces. Los cambios actualizan la pantalla correcta y las ventas del administrador. Los mismos componentes funcionan en ambos temas y al menos a 360, 390, 430, 768 y 1280 px.

## 03 · Referencias y criterio de diseño

**Apple Human Interface Guidelines:** referencia principal para jerarquía, adaptación, legibilidad y movimiento con propósito. Traducimos esos principios a web; no copiamos componentes de iOS ni distribuimos SF Pro. [S1-S3]

**Vercel Geist:** referencia pública para tokens semánticos, escalas y consistencia entre estados. Usamos un sistema propio de Onza; no asumimos que exista un paquete público idéntico al sistema interno de Vercel. [S4]

**Linear:** referencia de oficio para navegación sobria, alineación y reducción de ruido. Su rediseño publicado es un caso de estudio, no un brandbook descargable que estemos licenciando. [S5]

**me&u y GoTab:** referencias funcionales para pickup, estado de pedido y avisos separados de marketing. No copiamos su política ni atribuimos a Bozu funciones no verificadas. [S6-S7]

La dirección es **hospitalidad editorial, precisión de producto y calma operativa**. Fotos cuidadas, jerarquía fuerte, pocos controles y respuestas inmediatas. Premium no significa más animación ni más decoración: el objetivo es que nunca haya duda de dónde tocar ni de si el pedido pasó.

## 04 · Identidad visual

### Marca y assets

El símbolo mantiene la silueta del shot aprobado y elimina únicamente la línea horizontal interior. El wordmark se vectoriza desde el original elegido; no se intenta adivinar su tipografía. Inter es exclusivamente la tipografía de interfaz.

Usar `brand/svg/onza-lockup.svg` en accesos y encabezados amplios; `onza-wordmark.svg` en la navegación del cliente; `onza-shot.svg` para favicon y espacios pequeños. Variantes blancas para fondos oscuros. Conservar proporciones; margen libre mínimo equivalente a 25% del alto del símbolo. Mínimos: símbolo 24 px; wordmark 80 px; lockup 112 px. Sin sombras, contornos añadidos, deformación ni animación del logo.

### Color y temas

Se conserva la familia aprobada blanco/grafito/borgoña. Los HEX concretos normalizan los usados en el mapa previo; los valores oscuros y semánticos son una propuesta técnica nueva. `design/tokens.json` es la fuente editable; el CSS se genera de ella.

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| bg | #FFFFFF | #111113 | Fondo principal |
| surface | #F5F5F7 | #1B1B1F | Bloques secundarios |
| surface-raised | #FFFFFF | #242429 | Sheet, diálogo y tarjetas elevadas |
| text | #242426 | #F5F5F7 | Texto principal |
| text-muted | #66666D | #ADADB7 | Texto secundario legible |
| border | #E5E5EA | #34343B | Separación decorativa |
| control-border | #85858E | #777780 | Límite de inputs y controles |
| brand | #681D3B | #681D3B | Acento estable, relleno CTA |
| brand-text | #681D3B | #E7A4BE | Texto/enlaces de marca |
| brand-soft | #F7EFF2 | #302029 | Selección suave |
| on-brand | #FFFFFF | #FFFFFF | Texto sobre borgoña |
| success-text | #17663F | #89D8AE | Pedido listo/entregado |
| warning-text | #825600 | #F2CD80 | Espera o atención |
| danger-text | #A12A35 | #FFADB5 | Error o acción destructiva |

Por defecto seguir `prefers-color-scheme`; selector Sistema/Claro/Oscuro en preferencias. Persistir elección y aplicarla antes del primer render para evitar flash. Fotografías conservan sus colores; no invertirlas. No usar borgoña oscuro como texto sobre fondo oscuro. Los colores de estado siempre llevan texto/icono, no solo color.

### Tipografía, espacios y forma

Inter Variable local, pesos 400/500/600; 700 solo para un número o título puntual. Fallback `system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`. Cifras tabulares en montos, tiempo y códigos. No cargar otra familia ni pesos separados.

| Uso | Tamaño / interlínea | Peso |
| --- | --- | --- |
| Título de local | 32 / 38 px | 600 |
| Título de pantalla | 28 / 34 px | 600 |
| Sección / producto destacado | 20 / 26 px | 600 |
| Cuerpo / formulario | 16 / 24 px | 400 |
| Botón | 16 / 20 px | 600 |
| Ayuda / etiqueta | 14 / 20 px | 400/500 |
| Microtexto no esencial | 12 / 16 px | 500 |

Escala de espacios: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 px. Márgenes móviles 20 px; a 320 px, 16 px. Desktop 32 px. Separación entre secciones 32 px. No justificar texto. Párrafos de ayuda breves. Radios: controles 12 px, fotografías/tarjetas 16 px, sheet 24 px. Un solo nivel de sombra para overlays; listas planas con separadores.

Ancho de lectura cliente máximo 480 px para menú/checkout; descubrimiento puede crecer a 960 px. Operación y administración hasta 1280 px. Targets mínimos 44x44 px, botones principales 48 px; barra 48-56 px. Inputs de 16 px para evitar zoom accidental en móviles. Respetar safe areas y reservar altura para barras fijas; el teclado no oculta el botón o el error.

### Fotografía

El local debe mostrar bebidas reales y representativas. Formato producto 4:5, encuadre y luz consistentes, cristalería completa, fondo neutro o nocturno controlado. Sin texto sobreimpreso, fondos distintos para cada trago ni collage. Imágenes 800-1200 px de alto, WebP/AVIF precomprimidos; miniaturas de 88x110 px o variantes equivalentes. Hero de local 2:1. Texto alternativo descriptivo.

Las fixtures usan image=null: el componente debe tener un fallback tipográfico sobrio y estable. No se incluyen fotos de comercios reales ni se presenta una imagen genérica como el producto exacto. Para aprobar el acabado del menú se necesitará al menos una serie de 6 fotos consistentes, con derechos de uso, incorporadas después a Storage.

## 05 · Componentes y movimiento

Construir `/design-system` como catálogo interno protegido con todas las variantes: default, hover, focus, pressed, disabled, loading, error, long text, claro y oscuro. Usar primitivas accesibles Radix y componentes locales estilo shadcn; sus estilos se adaptan a Onza, no se conservan como diseño genérico. [S8]

| Familia | Componentes compartidos |
| --- | --- |
| Base | Button, IconButton, TextField, Select, Checkbox, Tabs, Dialog/Sheet, Toast |
| Identidad | BrandMark, ThemeControl, Price, VenueHeader |
| Catálogo | VenueCard, CategoryTabs, ProductRow, ProductDetail, PhotoFallback |
| Pedido | QuantityStepper, CartDock, OrderSummary, OrderStatus, PickupTicket |
| Operación | OrderCard, QueueLane, ConnectionStatus, ScanSheet, DeliveryResult |
| Sistema | EmptyState, ErrorState, Skeleton, StatusBadge, DemoBanner |

Lucide estático: 20/24 px, stroke 1.75 o 2, mismo valor en toda la aplicación. Licencia ISC y avisos MIT de iconos derivados. `lucide-animated` es un proyecto separado basado en Lucide y Motion, con licencia MIT; no es necesario importar su colección completa. Preferir animación CSS de un icono estático; copiar solo un componente animado si aporta una señal clara. [S9-S10]

Acciones: botón principal relleno borgoña, secundario con superficie/borde, terciario de texto. Un CTA primario por contexto; durante una operación monetaria mostrar estado y bloquear el doble envío sin quitar el texto del botón. No usar solo iconos para Aceptar, Listo, Cancelar o Entregar.

Movimiento propuesto: pressed 100 ms; cambio de estado 160 ms; apertura de sheet 220 ms; confirmación puntual 300 ms máximo. Animar transform/opacity; sin movimiento continuo del vaso, confetti, loaders infinitos sin explicación ni reordenamientos que muevan un botón bajo el dedo. Un aviso listo puede hacer una sola animación de campana/check. `prefers-reduced-motion` elimina desplazamientos no esenciales y mantiene la información. [S3]

## 06 · Navegación y pantallas del cliente

**Navegación inferior:** Explorar y Pedidos. El carrito aparece como dock contextual cuando tiene contenido; el seguimiento activo conserva acceso desde cualquier pantalla. Preferencias en menú discreto. No añadir Perfil vacío para simular una app más grande.

| Pantalla / ruta propuesta | Contenido y acción principal |
| --- | --- |
| `/` | Locales, buscador por nombre, abierto/pausado y zona. Abrir un local. |
| `/v/[slug]` | Foto/identidad del local, recogida, categoría, listado con fotos/precios y búsqueda local. Agregar. |
| `/v/[slug]/p/[id]` | Foto, nombre, descripción, tamaño y alérgenos informados; cantidad y Agregar al pedido. |
| `/cart` | Un solo local, editar cantidades, total y Continuar. |
| `/checkout` | Resumen, políticas, reserva y simulación. Confirmar pedido. |
| `/orders` | Pedidos de la sesión actual; activo primero. |
| `/orders/[id]` | Estado, instrucciones, QR y asistencia del local. |

**Explorar:** no pedir ubicación al abrir. El QR del local abre su menú directamente. Una tarjeta incluye nombre, zona y estado; no puntuaciones, distancias o tiempos inventados. Local cerrado admite explorar pero no pedir. Pausa comunica que no acepta pedidos ahora. No distinguir usuarios por género, patrimonio u otros perfiles.

**Menú:** lista editorial, texto a la izquierda y foto de 88x110 px a la derecha; precio fijo visible y botón Agregar accesible. Categorías sticky dentro de los límites del header. Tap en producto abre detalle; tap en Agregar no requiere abrirlo. Agotados visibles al final de la categoría, sin CTA activo. Mostrar ingredientes y alcohol informado por el negocio; no generar recomendaciones de consumo con IA.

**Carrito:** un local por pedido y una moneda. Cambiar de local con carrito pide conservar o vaciar; no borrar silenciosamente. Cantidad 1-10 por línea y límite total configurado en backend. No notas libres ni personalización en v1. El precio se vuelve a verificar al continuar; si cambió, se informa y se pide confirmar otra vez.

**Checkout:** no formulario de tarjeta real en el demo. Selección Simular autorización aprobada/rechazada en entorno de prueba. Texto: “Reservaremos ₡X. El cobro se confirma al recoger tu pedido”. CTA: “Confirmar y reservar ₡X”. Mostrar local, barra, total final y políticas junto al CTA, no escondidas en un menú. No prometer BAC certificado, custodia propia ni reparto automático todavía. Registrar versión aceptada de términos y política. Checkbox de mayoría de edad no sustituye verificación presencial.

## 07 · Seguimiento, QR y notificaciones

**Estados visibles:** Pedido recibido; Preparando; Listo para recoger; Entregado. Cada estado lleva hora real, un mensaje corto y la siguiente acción. No barra de progreso porcentual ficticia. Si el local no ha aceptado, explicar que la reserva no equivale a preparación.

En Listo, el ticket domina: nombre del local/barra, código humano de 6 caracteres, QR y texto “Retirá en Barra principal”. El QR solo se muestra para pedidos vigentes; no contiene datos bancarios ni personales. Un código compartido puede permitir recoger el pedido: avisarlo discretamente. No presentarlo como prueba de identidad o mayoría de edad.

| Contexto | Qué podemos prometer |
| --- | --- |
| Web abierta y conectada | Estado actualizado y aviso persistente grande. Sonido tras interacción explícita, si el navegador lo permite. |
| Safari iPhone en segundo plano/bloqueado | No garantizar ejecución, sonido o vibración. Al volver, sincronizar estado. |
| Web instalada en pantalla de inicio iOS 16.4+ | Push posible con permiso solicitado tras acción del usuario; entrega/sonido dependen del sistema. |
| Navegador compatible con Vibration API | Vibración breve opcional con feature detection; nunca requisito del flujo. |
| Safari/WebKit iPhone | No basar el producto en navigator.vibrate; no está implementado en la evidencia revisada. |

Fuentes técnicas: WebKit, Apple, MDN y reporte de implementación W3C. [S11-S14]

**Diseño del demo:** botón opcional “Activar sonido”, que prueba el tono y comunica si no se pudo reproducir. Un aviso breve al entrar en Listo, deduplicado por evento/dispositivo; no repetir al refrescar, ni reproducir sin fin. No intentar saltarse silencio, Focus o restricciones del navegador. Reservar un NotificationService para push y SMS; el demo implementa solo aviso visual/audio en primer plano. No simular SMS como enviados.

**Para un piloto real:** resolver alertas de recogida con push instalado y/o SMS transaccional con consentimiento y costo definido. El diseño deja estos proveedores sustituibles. Estado de pedido, notificación enviada y notificación entregada son hechos diferentes; la pantalla nunca confunde uno con otro.

## 08 · La barra

Ruta `/staff/[venueId]`. Sesión autenticada; acceso únicamente al local asignado. Tablet/desktop con tres columnas: Nuevos, Preparando, Listos. En móvil, tabs con cantidades y una lista por estado. Entregados va al historial; no una cuarta columna de ruido.

OrderCard: código, hora, tiempo transcurrido, líneas y cantidades, y una acción principal. Sin email, teléfono completo, monto como foco principal ni datos de tarjeta. Orden FIFO por estado; no mover automáticamente una tarjeta mientras hay interacción. El local puede pausar nuevas órdenes sin esconder las pendientes.

- **Aceptar y preparar:** transición única queued -> preparing. No aceptar si la reserva no está confirmada. Rechazar pide motivo y solicita anulación.
- **Marcar listo:** preparing -> ready; registra hora y crea evento de aviso, una vez.
- **Escanear retiro:** cámara con permiso al tocar Escanear; escáner se carga solo al abrir. HTTPS, limpieza de stream al cerrar, código manual como alternativa.
- **Entregar:** se valida pedido/local/vigencia y se asigna el retiro a una sola sesión de bartender. Se confirma la captura y solo ese responsable puede entregar y confirmar. Otro dispositivo ve “Retiro atendido por otra persona”. Si se interrumpe luego de capturar, queda “Cobrado, entrega pendiente”; el responsable retoma sin recobrar. Cambiar de responsable requiere verificación física y transferencia auditada por supervisor; no se libera el retiro automáticamente.
- **Fallos:** si la captura no está confirmada, no mostrar verde de éxito. Si no hay conexión, no operar dinero ni marcar entregas offline. Mantener menú de contingencia “Cobrar en barra” como proceso manual externo, sin marcarlo como pago BAC dentro de Onza.

El layout ayuda a organizar la recogida; la app no aumenta por sí misma la capacidad de preparar bebidas. La estación de retiro y su señalización son parte del piloto.

## 09 · Administración útil, sin dashboard de adorno

Navegación: Resumen, Pedidos, Menú, Ajustes. El administrador puede operar la barra si tiene ambos permisos. Onza configura locales y staff mediante un acceso global explícito; nunca un selector público que conceda roles.

Resumen: filtro de local y fecha operativa; cobros capturados netos de devoluciones, pedidos entregados, unidades entregadas y tiempo mediano de preparación. Tabla por producto con unidades y ventas correspondientes. Mostrar tamaño de muestra; sin porcentajes de crecimiento sin período comparable. “Dinero reservado”, “Cobrado” y “Depositado” no son equivalentes. No mostrar Depositado sin conciliación del banco.

Menú: crear/editar nombre, descripción breve, categoría, precio final, foto, tamaño, alérgenos y disponibilidad. Publicar exige nombre/precio válido/categoría; sin foto se permite fallback, pero no pasa la aprobación visual final. Editar precios no cambia pedidos ya confirmados.

Ajustes: nombre del local, zona, horario, barra de retiro, contacto, pausa, ETA informada, capacidad activa y políticas. El demo propone una sola barra por local. No formulario de datos bancarios hasta definir el contrato real.

Métricas del MVP son las ventas que pasan por Onza. No representan todas las ventas del establecimiento. La inteligencia futura necesita POS/importaciones y datos de costos; no ocultar esa cobertura incompleta.

## 10 · Políticas operativas propuestas

Estas reglas son valores iniciales de producto para el demo. Deben ser revisadas con el comercio y, para dinero real, con el proveedor y asesoría aplicable.

| Caso | Comportamiento inicial |
| --- | --- |
| Barra no acepta en 2 minutos | Expirar pedido y solicitar anulación de reserva. |
| Cliente cancela aún en cola | Cancelar si gana la transición atómica frente a Aceptar; solicitar anulación. |
| Ya preparando | No cancelación automática por cambio de opinión; solicitar ayuda al local. Nunca cobrar por no entrega bajo la promesa del MVP. |
| Falta un producto | Rechazar completo antes de preparar; en v1 no sustitución ni captura parcial. |
| Tiempo excesivo | Al superar el máximo informado, cliente puede solicitar cancelación; soporte resuelve el estado de preparación/entrega sin doble transición. |
| Listo y no recogido | Aviso y recordatorio visual; a los 20 minutos se cierra como uncollected y se anula la reserva si no hay captura. |
| Reserva anulada | Mostrar “Liberación solicitada” hasta confirmar; disponibilidad del saldo depende del emisor. |
| Ya cobrado y falta entrega | Bandeja de incidencias; entregar sin recobrar o tramitar devolución. No expirar como si el dinero nunca se hubiera cobrado. |

Un pedido preparado pero no recogido cuesta ingredientes y trabajo al bar. La reserva no compensa ese desperdicio. No añadir penalidad oculta. El recordatorio por SMS/push es fase posterior, no una capacidad que el demo deba fingir.

## 11 · Microcopy y accesibilidad

Español claro, tratamiento de vos moderado: “Elegí tus tragos”, “Agregar”, “Ver pedido”, “Listo para recoger”. Mensajes financieros directos: “Monto reservado”, “Cobro confirmado”, “No pudimos confirmar el cobro”. Evitar frases de marketing durante errores, emojis festivos y tecnicismos como capture_pending en UI.

WCAG AA como objetivo: texto normal al menos 4.5:1; grande y componentes no textuales, 3:1 según corresponda. Los bordes decorativos no sustituyen el contraste de controles. Probar teclado, VoiceOver, zoom 200%, lectura de estados y nombres largos. Cambios de estado con aria-live polite; errores críticos con role alert, sin leer el reloj cada segundo. Devolver foco al cerrar sheets. Un lector puede completar el pedido sin interpretar una foto o un QR.

## 12 · Qué queda para después de esta revisión

El kit fija una dirección implementable. Antes de dinero real: acuerdo BAC aplicable a alcohol/múltiples comercios, manual del gateway, identidad del vendedor por pedido, modelo de comisión, validación de edad, políticas definitivas, atención nocturna, notificación fuera de primer plano y pruebas reales en iPhone. Para el demo: elegir 6 fotos de prueba con licencia y configurar un proyecto Supabase dedicado. Nada de esto impide construir el sistema de diseño y el recorrido simulado ahora.
