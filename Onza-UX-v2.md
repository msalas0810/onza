# Onza · Flujos, dirección visual y auditoría v2

16 de noviembre de 2026 · Propuesta para revisar la implementación existente.

## Actualización implementada · 16 de noviembre de 2026

El encargo autónomo posterior reemplazó la secuencia de aprobación A–E: se trabajó incrementalmente sobre el código `506e3bf`, sin repetir la auditoría completa. Estado y evidencia actuales: `docs/hosted-ux-verification.md` y `DIARIO.md`.

El número público es solo referencia: el retiro usa QR privado o código privado de 12 caracteres, sin precarga del personal. La segunda validación se rechaza como ya entregado; repetir capture/complete por el responsable previamente validado sigue siendo idempotente. Sin cambios de clave ni reemplazo silencioso de tickets anteriores.

Sin portada, VenueCard usa una composición compacta y neutra; el fade queda reservado al contraste sobre fotografías existentes. Cercanía inicial: hasta 5 km con precisión de ubicación de hasta 1 km, distancias aproximadas y posición solo en memoria. Los locales demo carecen de coordenadas reales: no se inventaron; el fallback manual es el comportamiento inmediato. Apariencia vive en `/settings`; ancho del menú 640 px mediante token compartido.

## Cómo usar este documento

Primero ejecutar únicamente el prompt A. Entregar su evidencia al founder y a un revisor independiente. Después ajustar esta propuesta con lo observado y ejecutar B–E por separado. Este documento no certifica la aplicación ni afirma haber recorrido el sitio.

Fuentes de evidencia inicial: dos capturas adjuntas y problemas descritos por Manu. No se ha inspeccionado el código actual ni reproducido aquí el carrito, las cancelaciones o la geolocalización. Distinguir siempre observado en pantalla, reportado por el founder, confirmado en código y demostrado mediante prueba.

Preservar la marca Onza, su wordmark y símbolo sin línea interior, la familia blanco/grafito/borgoña y las fuentes/tokens existentes. No empezar otra identidad ni reemplazar el stack. Las instrucciones de Manu de este turno actualizan el diseño anterior: descubrimiento por cercanía con permiso, cerrados no accionables, apariencia dentro de Ajustes y cancelar solo antes de aceptación.

## 1. Diagnóstico inicial

| Hallazgo | Evidencia disponible | Qué comprobar |
| --- | --- | --- |
| Club Cero aparece antes que un local abierto | Captura de Explorar; el estado cerrado fue mostrado en capturas anteriores | Estado actual y lógica de orden; no inferirlo solo del nombre |
| Las portadas comparten el mismo gradiente/símbolo | Captura | Fallback frente a imagen cargada; no confundir placeholder con acabado final |
| El dock Ver pedido flota sobre Explorar | Captura | Si representa carrito sin enviar o pedido confirmado; origen y destino del CTA |
| No se puede vaciar el carrito | Reporte del founder | Reproducir con pasos y verificar reducer/store, persistencia y controles |
| El menú separa demasiado nombre, descripción, precio y acción | Captura recortada | CSS computado y composición a viewport conocido; los píxeles de la captura no prueban tamaños CSS |
| Agregar tiene casi el ancho de la columna de texto en cada producto | Captura | Variante de Button, width en el wrapper, densidad de ProductRow |
| Selector Sistema está en la cabecera | Captura; está arriba a la derecha en la imagen | Mover elección de apariencia a Ajustes según preferencia nueva |
| Cancelación podría mostrarse tras aceptar | Reporte/preocupación del founder | Dos sesiones y prueba de carrera, no basta inspeccionar el botón |
| Retiro sin QR/validación | Incidencia INC-001 previamente reportada | Identificar acciones y guards de backend; no darla por resuelta |

La solución no es reducir todo. Se necesita una jerarquía clara y acciones de tamaño correcto para su contexto. Reutilizar Button no garantiza que ProductRow esté bien compuesto.

## 2. Qué significa premium para Onza

Dirección: hospitalidad editorial y operación clara. La bebida y el local llevan el protagonismo; navegación y preferencias acompañan. La identidad se expresa en proporción, fotografía y consistencia, además del color.

Principios operativos propios, inspirados en las referencias de la sección 9:

- R01. Una tarea y un CTA dominante por contexto; las acciones repetidas de lista tienen menor peso que el checkout.
- R02. Cada agrupación visual corresponde a un objeto del negocio: local, producto, carrito o pedido. No mezclar esos cuatro contextos.
- R03. Jerarquía por tamaño, peso, proximidad y alineación. No usar bordes grandes y espacios enormes como sustituto de composición.
- R04. Escala compartida de texto, espacios, iconos y controles; variantes por contexto, no un componente de tamaño único para todo.
- R05. El estado modifica acciones y presentación: abierto/cerrado, draft/confirmado, recibido/preparando/listo.
- R06. Siempre se puede corregir un carrito. Una operación monetaria exige estado confirmado y reglas del servidor.
- R07. La experiencia funciona sin ubicación, sin foto, sin cámara y con reconexión; no inventa distancias o capacidades.
- R08. Preservar accesibilidad: foco, etiquetas, contraste, teclado, ampliación de texto y reduced motion. Minimalismo no equivale a controles invisibles.
- R09. Las comprobaciones de build y las fotos son evidencias distintas. Ambas son necesarias; ninguna sustituye las pruebas de comportamiento.
- R10. Una sola IA modifica el repo a la vez; capturador y revisor trabajan sobre el mismo commit identificado.

No añadir auroras, glassmorphism, animación continua ni estilos de una landing por asociarlos a startups financiadas. No hay una plantilla visual que garantice una percepción premium.

## 3. Flujos objetivo

### Descubrir el local

Home sin permiso: cabecera contenida con marca y acceso a Ajustes; explicación breve y acción Usar mi ubicación; búsqueda/selección manual disponible. No abrir el diálogo de permiso sin contexto.

Con posición útil: un local abierto cercano destacado, luego Otros abiertos cerca de vos; los cerrados van al final en una sección secundaria. El destacado no se repite en la lista. Si ninguno está abierto, mostrarlo con claridad sin recomendar un cerrado como disponible.

El criterio inicial es disponibilidad y después distancia aproximada entre locales con coordenadas válidas. No inventar coordenadas para que funcione la demo. Datos ficticios de ubicación se marcan como tales. Sin coordenadas/permiso, mostrar la zona y omitir distancias. Los umbrales de cercanía se ajustan con datos reales del piloto; no llamar cerca a un local arbitrariamente lejano.

La API web requiere permiso y puede entregar una posición poco precisa. GPS no demuestra que la persona esté dentro de un bar. Usar Cerca de vos, no Estás en este bar. El usuario confirma el local antes de pedir. Un QR del establecimiento abre ese menú directamente y conserva ese contexto, sin redirigirlo al vecino por GPS. Mantener la ubicación del cliente efímera por defecto; no almacenarla en su perfil ni hacer tracking continuo para este flujo.

Cerrados: imagen atenuada, badge Cerrado superpuesto y texto legible. Sin Ver tragos, enlace, hover de acción ni foco de tarjeta accionable. Desactivar entrada al menú cerrado es una decisión de producto de Manu; mostrar un menú cerrado en solo lectura también sería válido en otro producto, pero no es la política elegida aquí. La URL directa debe mostrar el estado cerrado sin permitir pedidos. Los pedidos previos siguen accesibles desde Pedidos y la barra conserva sus funciones.

### Elegir tragos

Menú: identidad y estado del local, barra de retiro, búsqueda, categorías compactas y filas de producto. Detalle para foto, ingredientes y cantidades cuando haga falta. No obligar a abrir el detalle para cada agregado simple.

ProductRow agrupa nombre, descripción, precio y acción. Imagen a la derecha, precio alineado y Agregar compacto; después de agregar, el control puede pasar a cantidad en la misma posición. No un botón de ancho completo por producto. El botón de continuar del carrito sí ocupa el ancho disponible.

No anidar botones dentro de un enlace que cubre toda la fila. Hacer foto/título accesibles como enlace al detalle y controles de cantidad como acciones separadas. Agotado no agrega; el estado se valida nuevamente al confirmar.

### Carrito antes de enviar

Persistir el carrito puede ser útil; el problema es perder contexto o no poder borrarlo. Regla propuesta: un único carrito draft por sesión, un local y una moneda.

- Dock grande solo dentro del menú/detalle del local dueño y al editar su carrito. En Explorar, acceso discreto a Retomar carrito de [local], sin tapar portadas. Al vaciarlo desaparece todo indicador.
- El carrito muestra local, líneas editables, quitar producto, total y Vaciar carrito. Llevar la cantidad a cero elimina la línea.
- Al agregar en otro local, confirmar Reemplazar carrito de [A] por uno de [B]; permitir conservar y volver. No mezclar locales ni borrar silenciosamente.
- Navegar a otro local no modifica por sí solo el carrito guardado ni muestra el dock del local anterior sobre su menú.
- Label del draft: Ver carrito. Label de una orden persistida: Ver pedido. No tratar una orden ya enviada como un carrito editable.
- Una orden activa y un draft nuevo son objetos distintos; Pedidos contiene la orden, el editor contiene el draft. Eliminar el draft no cancela la orden.

### Confirmar, esperar y retirar

Checkout: confirmar local y barra, cantidades, total final y promesa de reserva/captura simuladas. Un solo envío idempotente. Después de éxito, limpiar únicamente el draft que produjo esa orden.

| Estado del pedido | Acción del cliente | Acción de barra |
| --- | --- | --- |
| Confirmando reserva / resultado incierto | Esperar, sincronizar o pedir ayuda; no duplicar envío | No preparar sin autorización confirmada |
| Recibido y aún no aceptado | Cancelar pedido disponible | Aceptar y preparar o rechazar |
| Preparando | Sin Cancelar pedido; contacto/ayuda | Marcar listo |
| Listo | Ticket de retiro y ubicación de la barra | Resolver QR/código y validar retiro |
| Entregado | Comprobante e historial | Ninguna segunda entrega/captura |
| Cancelado/expirado | Estado de la liberación de reserva | Ninguna preparación nueva |

Cancelar y aceptar compiten en el servidor: un solo cambio gana. Si llegó la aceptación antes del clic de cancelar, responder con el estado actual y explicación; no mostrar una cancelación ficticia. El servidor rechaza igualmente intentos manuales de cancelar después de aceptar. Ocultar el botón no impide el abuso de una API.

Después de aceptar, ayuda/incidencias sigue disponible para producto faltante o problema real. La ausencia de un botón automático no significa imposibilidad de resolver una devolución. Conservar las políticas de no-show/timeout ya documentadas hasta revisarlas específicamente; no cambiarlas accidentalmente en este rediseño.

INC-001 queda dentro de la cobertura de auditoría. El rediseño no sustituye el cierre funcional de ticket/validación/captura/entrega. No dar por terminado el flujo si el bartender puede saltarse su guard. Marcar listo no captura dinero; reserva, captura y liquidación son hechos distintos.

### Ajustes y personal

Ajustes accesible con engranaje discreto y nombre accesible. Apariencia dentro de ese panel: Sistema, Claro y Oscuro con monitor/sol/luna, selección inequívoca y texto. Iconos sobrios, sin animación permanente. Persistir la elección sin flash; respetar tema del sistema si no hay elección.

Explorar y Pedidos son navegación del cliente. El acceso a personal puede vivir como entrada secundaria identificada en Ajustes; nunca conceder rol por un selector. Barra y administración conservan sesiones y permisos. El nuevo onboarding/cuentas no forma parte de este trabajo.

## 4. Contrato visual que debe concretar el diseñador

Estos valores son un punto de partida para la prueba visual, no una medición de las capturas. Inspeccionar primero los tokens reales del proyecto y no crear un segundo sistema paralelo.

| Elemento | Propuesta inicial para probar |
| --- | --- |
| Cuerpo / inputs | 16/24 CSS px; campos con etiquetas |
| Producto / precio | 16–18 px, jerarquía diferenciada, cifras tabulares |
| Descripción | 14/20 px; lista breve y detalle accesible |
| Título de local/pantalla | 24–32 px según ancho; evitar títulos enormes en cada bloque |
| Márgenes móviles | 16–20 px; escala de espaciado compartida |
| Controles principales | 44–48 px de altura; al menos 44×44 px de área táctil como objetivo de Onza |
| Agregar en fila | Ancho por contenido, hit area 44 px; no heredar w-full del checkout |
| Imagen de producto | 88–96 px de ancho, relación 4:5 estable en móvil |
| Ancho de menú | Columna de lectura contenida, inicialmente 560–680 px en desktop |
| Dock + navegación | Alturas y offsets compartidos, safe area y espacio reservado al final del contenido |

Mantener escala 4/8, Inter existente y tokens semánticos actuales salvo ajustes justificados. Auditar los colores de error, disabled y selección en ambos temas. La atenuación del cerrado se aplica a la foto/superficie, no a toda la tarjeta si destruye legibilidad.

El objetivo táctil de Onza es una decisión de diseño, no una afirmación de que todas las normas web exigen 44 px. Referencias de tamaños nativos de Apple usan puntos, no píxeles CSS.

Componentes canónicos propuestos: AppShell, SettingsSheet, ThemeChoice, LocationPrompt, VenueCard (featured/list/closed), VenueStatus, ProductRow, ProductDetail, AddControl, QuantityStepper, CartDock, CartSheet/Page, OrderStatus, PickupTicket, OrderActions y OperationCard. Nombres adaptables a los existentes. Una regla común de apariencia y estado, con geometrías distintas cuando la tarea cambia.

Fotografía/ilustración: distinguir placeholders de fotos reales. Para el demo puede conservarse una serie consistente de ilustraciones; para el piloto, fotos representativas con derechos. No cambiar la imagen de una bebida por una foto bonita que representa otro producto. Evitar seis estilos de autores distintos.

## 5. Auditoría basada en evidencia

Un paquete de capturas permite crítica visual. Para juzgar el flujo también hacen falta pasos, estado inicial, acción y resultado real. Capturar una ruta no demuestra que sus botones funcionen.

### Entregables del auditor

Crear una carpeta local artifacts/ux-audit-[fecha]/ con:

- README.md: commit, rama, entorno, versión de navegador, cómo reproducir y bloqueos.
- routes.md: rutas descubiertas en código, rol, propósito y componente dueño.
- flows.md: recorrido y tabla origen → acción → guard → destino → feedback → evidencia.
- findings.md: ID, severidad, evidencia, pasos, esperado/real, archivo/línea si se confirmó y propuesta mínima.
- coverage.csv: ruta/estado/rol/tema/viewport y screenshot correspondiente; no marcar cobertura solo por existir un archivo de test.
- screenshots/: PNG de estados relevantes, con nombres estables.
- contact-sheets/: hojas legibles por rol/flujo para revisión rápida, más las imágenes individuales.
- index.html: galería local estática con enlaces a pasos/capturas, sin publicar ni cargar dependencias remotas.
- Una grabación corta por flujo principal solo si las herramientas lo permiten; útil para reordenamientos, foco, transiciones y reconexión.

No incluir .env, cookies, localStorage/sessionStorage, cabeceras, tokens, contraseñas ni dumps de red en el ZIP. Usar únicamente identidades ficticias y pedidos de prueba. Redactar QR/tokens de retiro en capturas compartibles y marcar la redacción. No entregar trazas de navegador sin sanear porque pueden contener sesiones.

### Cobertura mínima, sin multiplicar fotos inútiles

1. Cliente: Explorar; abierto/cerrado; menú; detalle; carrito vacío/lleno; quitar/vaciar; cambio de local; checkout; recibido/preparando/listo/entregado/cancelado; reconexión y errores relevantes.
2. Personal: login; cola nueva/preparando/listos; aceptar/cancelar concurrentes; retiro; código inválido/reutilizado y permisos de otro local.
3. Admin: menú; crear/editar/disponibilidad; imagen cargada/error; ventas; pausa del local; ajustes existentes.
4. Ubicación: si existe, permiso aceptado/denegado/timeout; si no existe, marcar no implementada, no construirla durante el inventario.
5. Cliente móvil 390×844 para todas las pantallas principales. Claro/oscuro en las pantallas canónicas. Desktop 1440×900 en home, menú, carrito, pedido, barra y admin. Revisión 360 px para overflow/teclado. Estados de error al menos una vez. Presupuesto inicial orientativo 35–50 capturas útiles; justificar más o menos por cobertura, no por llenar una cuota.

Capturar primer viewport y full-page cuando aporte contexto. DPR 1 consistente y zoom 100%; medir estilos computados antes de afirmar tamaños. La emulación no prueba cámara, audio, GPS o teclado físico en iPhone.

Usar checkout mock y datos demo. Las acciones de prueba pueden crear pedidos ficticios en onza-dev: identificarlos y no borrar pedidos ajenos ni cambiar configuración remota. Si una credencial o herramienta falta, marcar bloqueado y continuar los recorridos accesibles. No llamar fallo del producto a una dependencia de prueba ausente.

### Priorización

- P0: acceso indebido, cobro/entrega sin validación o fuga de datos; se confirma antes de etiquetarlo así.
- P1: no se puede completar pedido, borrar carrito o elegir el local correcto.
- P2: fricción, navegación ambigua, presentación de cerrado, densidad y preferencias mal ubicadas.
- P3: pulido visual sin bloqueo funcional.

Revisar cada captura con preguntas concretas: ¿qué tarea predomina?, ¿qué pertenece a qué?, ¿cuál es la siguiente acción?, ¿puedo deshacer una selección?, ¿sé en qué local estoy?, ¿cambia lo disponible al cambiar el estado?, ¿puedo usarlo con una mano y leerlo de noche?, ¿la pantalla funciona sin animación ni foto?

## 6. Plan de prompts y modelos

Las configuraciones siguientes son recomendaciones de trabajo para Onza, no una clasificación oficial de calidad estética ni una garantía de consumo. No se ha hecho una comparación controlada entre los modelos en este repo.

| Paso | Trabajo | Elección práctica |
| --- | --- | --- |
| A | Capturar app y documentar flujo actual | Claude Code local, Opus 5.5 Medium, velocidad normal; alternativa Codex Sol Medium Standard si ya está configurado |
| Revisión independiente | Evaluar evidencia y resolver prioridades | Este chat; si se usa otro auditor, Astra High en una revisión acotada es opcional |
| B | Prototipo de composición y contrato visual | Opus 5.5 High normal o Sol High Standard; elegir uno |
| C | Estados del carrito, cancelación y descubrimiento | Sol High Standard; Opus 5.5 High normal si se mantiene ese implementador |
| D | Aplicar componentes a pantallas restantes | El mismo implementador, Medium para migraciones de UI ya especificadas |
| E | Verificación y evidencia comparativa | Sol Medium Standard u Opus 5.5 Medium normal; subir esfuerzo solo ante diagnóstico complejo |

Para ahorrar uso: leer instrucciones una vez por sesión, pedir al final enlaces/evidencia en lugar de enormes transcripciones, cargar capturas por flujo, reutilizar evidencia del mismo commit cuando siga siendo válida y evitar que dos agentes hagan el mismo inventario. No reducir pruebas críticas de permisos/dinero por ahorrar tokens. No ejecutar A–E de golpe antes de revisar el resultado de A.

### Prompt A · Inventario y evidencia, sin rediseñar

Leé DIARIO.md, AGENTS.md y CLAUDE.md. Inspeccioná git status, rama y commit antes de empezar; conservá cambios ajenos. Trabajá sobre fix/hosted-integration según lo acordado, sin cambiar main, crear ramas ni reescribir historial. No edites código funcional ni despliegues.

Quiero un inventario verificable de la UI/UX actual de Onza para una revisión independiente. Ejecutá la app local conectada al demo configurado o inspeccioná el deployment identificado si local no es viable. Registrá qué entorno y commit corresponde a cada evidencia; no mezcles ambos sin avisar.

Descubrí las rutas reales de cliente, bartender y administrador; no adivines URLs. Recorré los flujos de la sección 5 de Onza-UX-v2.md. Reproducí especialmente: carrito al salir de local, quitar/vaciar, agregar en otro local, orden de abiertos/cerrados, Agregar en menú, apariencia, cancelar antes/después de aceptar e INC-001. No des por confirmado un problema solo porque lo reportamos.

Usá browser/Playwright si está disponible. Si no podés abrir un navegador real, declaralo y entregá lo verificable en código; no inventes capturas. Usá dos sesiones para cliente y bartender. Solo datos ficticios y pagos mock; no alteres roles, RLS ni migraciones para facilitar la auditoría.

Entregá artifacts/ux-audit-[fecha]/ con README, routes.md, flows.md, findings.md, coverage.csv, capturas por rol/estado, contact sheets e index.html. Guardá geometría CSS computada de ProductRow, Agregar, QuantityStepper y CartDock. Registrá nombres de componentes y archivos causantes solo cuando lo confirme el código. Separá hechos, hipótesis y preferencias.

Toda captura debe indicar ruta, viewport, tema, rol y estado. No incluyas credenciales, PII, tokens de sesión ni QR válidos en el paquete compartible. No guardes HAR/trazas sin sanear. Registrá los pedidos demo que crees; no borres datos ajenos. Actualizá el diario con el inventario realizado sin secretos. Entregá un ZIP local de la evidencia y un resumen breve de cobertura/bloqueos; no hagas push hasta revisar que solo contiene material compartible.

Terminá después de la auditoría. No arregles todavía los hallazgos, no agregues cuentas/onboarding, no instales una nueva biblioteca visual y no despliegues. Necesito revisar la evidencia antes de elegir cambios.

### Prompt B · Composición de referencia

Leé la evidencia de A y los hallazgos priorizados por el founder; conservá instrucciones y cambios del repo. Aplicá la dirección de secciones 2–4 de Onza-UX-v2.md, ajustada con la revisión. Identificá los componentes/tokens reales que vas a conservar. No hagas otro sistema paralelo.

Implementá primero una vista de revisión local del home y menú con los componentes reales: destacado cercano, lista de abiertos/cerrados, ProductRow, cantidad, CartDock y Ajustes/Apariencia. Fixtures deterministas, ninguna modificación remota. Mostrá a 390 px y 1440 px, claro/oscuro, textos largos, agotado y sin imagen. No añadas dependencias sin necesidad ni mezcles plantillas de diferentes estilos. No alteres todavía el comportamiento financiero.

Entregá capturas y un contrato breve docs/design/ONZA-UI-CONTRACT.md con geometrías, variantes, estados y referencias usadas. Pedir revisión de esta composición es el cierre concreto de esta etapa, no un bloqueo para preparar código/revisiones locales. No expandas el rediseño por toda la app ni publiques hasta revisar la composición.

### Prompt C · Reglas de navegación y estado

Con la composición revisada, implementá los flujos objetivo del documento sin reescribir módulos ajenos. Un draft de un local, edición/quitar/vaciar, cambio de local con confirmación y distinción entre carrito y orden activa. El dock solo aparece en el contexto definido. Precio y disponibilidad se vuelven a verificar en servidor.

Cancelación automática del cliente solo antes de aceptación; resolver carrera aceptar/cancelar atómicamente y actualizar UI. Después de aceptar, quitar Cancelar y conservar ayuda/incidencias. No cambiar por accidente políticas de timeout/no-show.

Descubrimiento: abiertos primero; cercanía real si hay permiso y coordenadas válidas; destacado no duplicado; cerrados atenuados y no accionables. Permiso denegado/timeout mantiene búsqueda manual. No almacenar tracking ni generar distancias inventadas. Si faltan coordenadas, proponer una migración no destructiva y fixtures explícitos; no aplicarla a otro proyecto ni comprar APIs de mapas.

Probar los criterios de sección 7, incluidos intentos directos al backend. Registrar INC-001 por separado y no afirmar validación de retiro si sigue abierta. Conservar mock, roles, RLS y aislamiento. Antes del push, revisar diff y ejecutar checks relevantes; no desplegar sin instrucción del founder.

### Prompt D · Extender el sistema visual

Migrá checkout, seguimiento, carrito, Ajustes, barra y admin a los componentes y tokens revisados en B. Conservá sus reglas, rutas y permisos. Reutilizar no significa forzar a la barra de trabajo en la misma composición que el catálogo del cliente.

Eliminá controles de apariencia de la cabecera principal; usá monitor/sol/luna con etiquetas dentro de Ajustes, foco y selección accesibles. Reservá espacio para navegación y docks; no ocultar último producto ni botones con teclado/safe area. Quitá texto técnico de las pantallas de cliente y mantené mensajes de estado accionables. No agregues marketing, cuentas ni nuevas métricas.

Entregá comparación antes/después por pantalla y verificaciones. Confirmá que campos, imágenes cargadas/rotas, errores y textos largos conservan layout. Registrá ajustes reales del contrato visual para que no quede desactualizado.

### Prompt E · Cierre y entrega

Recorré nuevamente la matriz de A sobre el commit nuevo y compará evidencias con viewports idénticos. No uses solo build/typecheck como aceptación. Probá flujos y estados de sección 7, incluye ambas sesiones y red intermitente. Marcá por separado evidencia en emulación y pruebas pendientes en iPhone físico.

Entregá resumen de requisitos cumplidos/no cumplidos, capturas comparativas, resultados reales y commit. Actualizá DIARIO.md, implementation-status y el contrato canónico. AGENTS.md y CLAUDE.md deben enlazar al mismo contrato con pocas reglas esenciales, no copiar tres versiones del manual. No cierre por puntuación estética inventada. Cualquier paso crítico no demostrado sigue pendiente.

## 7. Criterios de aceptación concretos

- AC01. Ningún cerrado aparece antes de los abiertos en el listado general; el destacado es abierto y no se duplica. Búsqueda manual funciona sin ubicación.
- AC02. Cerrado muestra estado y no se puede activar por ratón/teclado. URL directa no permite comprar; el backend vuelve a validar disponibilidad.
- AC03. El carrito tiene local visible, quitar línea y vaciar. Después de vaciar, recargar y navegar no lo resucita.
- AC04. Agregar en otro local exige una decisión; conserva A o crea B, nunca mezcla ambos. Volver del navegador no revierte silenciosamente esa decisión.
- AC05. El dock de A no invade el menú B ni tapa Explorar. Un pedido confirmado no se edita al vaciar un draft.
- AC06. Una captura de menú contiene información agrupada y Agregar compacto; ningún CTA queda oculto por dock, teclado o navegación. No hay overflow a 360 px o zoom 200%.
- AC07. Apariencia persiste, respeta Sistema y no cambia las fotos. Sun/moon/monitor tienen nombres accesibles y selección comunicada.
- AC08. Solo se puede cancelar antes de aceptar, tanto en UI como por endpoint. La carrera entre ambas operaciones tiene un ganador y feedback claro.
- AC09. Geolocalización denegada, incierta, caducada o con venues sin coordenadas no produce un local falso ni bloquea la compra manual.
- AC10. Todas las pantallas principales tienen loading, vacío y error pertinentes. Un menú vacío sin búsqueda no dice Probá otra búsqueda como única explicación.
- AC11. Ningún nuevo estilo duplica Button/Input/Tabs/Badge sin razón. Variantes tienen tamaños y estados definidos; no hay w-full global heredado en cada acción de lista.
- AC12. La entrega exige validación de retiro y una sola captura si INC-001 está dentro del cambio aprobado; si no, permanece explícitamente abierta. No confundir listo con entregado.

## 8. Mobbin, 21st y recursos gratuitos

Mobbin es una biblioteca de referencias de pantallas/recorridos; su plan gratuito es limitado y su pricing lista Flows y MCP dentro de planes pagos. No prometer investigación completa por MCP gratis. No comprar una suscripción para iniciar esta auditoría.

21st.dev es un registro de componentes de muchos autores, no un sistema visual único. Navegar tiene acceso gratuito; las funciones de copia/instalación/MCP tienen límites o planes según la función. La licencia del registro/CLI no concede automáticamente los derechos de cada componente ni de sus fotos/demos. Elegir piezas por necesidad y conservar avisos; no copiar portadas de las demos como imágenes propias.

Base gratuita recomendada: documentación de Apple HIG, heurísticas NN/g, documentación de Geist, Radix/shadcn y los componentes ya instalados. Para patrones de compra, estudiar recorrido de descubrimiento → menú → carrito → checkout → estado de productos reales a los que se tenga acceso legítimo. No hace falta que sean visualmente idénticos a Onza. Por referencia, anotar URL, tarea, principio aprovechado y qué no aplica. Máximo tres referencias por flujo para no construir un collage.

Usar Mobbin para comprender secuencias y estados; 21st para una pieza seleccionada; Radix/shadcn para estructura accesible; tokens propios para identidad. Ninguna de esas herramientas sustituye las reglas de negocio ni una prueba con cliente y bartender.

## 9. Fuentes primarias consultadas

Consulta del 16 de noviembre de 2026. Los umbrales, geometrías, flujos y configuraciones de modelo propuestos para Onza son recomendaciones propias; no se atribuyen textualmente a estas fuentes.

1. Apple HIG, Layout — jerarquía, alineación y adaptación: https://developer.apple.com/design/human-interface-guidelines/layout.md
2. Apple HIG, Buttons — jerarquía de acciones y uso de controles: https://developer.apple.com/design/human-interface-guidelines/buttons.md
3. Apple HIG, Typography — jerarquía y legibilidad: https://developer.apple.com/design/human-interface-guidelines/typography.md
4. Nielsen Norman Group, 10 Usability Heuristics — control, feedback, consistencia y prevención: https://www.nngroup.com/articles/ten-usability-heuristics/
5. Linear, A calmer interface for a product in motion — posiciones previsibles y pesos visuales: https://linear.app/now/behind-the-latest-design-refresh
6. Vercel Geist — referencia pública de consistencia: https://vercel.com/geist/introduction
7. Radix — primitivas accesibles y personalizables: https://www.radix-ui.com/primitives/docs/overview/introduction
8. shadcn/ui — componentes editables: https://ui.shadcn.com/docs
9. OpenAI, Build responsive front-end designs — referencias, Playwright y comparación visual: https://learn.chatgpt.com/use-cases/frontend-designs
10. OpenAI, Models — selección de modelo/esfuerzo: https://learn.chatgpt.com/docs/models
11. Anthropic, Claude Code best practices — evidencia visual y criterios comprobables: https://code.claude.com/docs/en/best-practices
12. Anthropic, Prompting Claude Opus 5.5 — comenzar calibración con Medium: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5
13. Mobbin, Pricing — Flows/MCP en planes listados: https://mobbin.com/pricing
14. Mobbin, comparación publicada por el propio proveedor — declara plan gratuito limitado: https://mobbin.com/blog/best-mobbin-alternatives
15. 21st, Plans — navegación y planes: https://21st.dev/plans
16. 21st, Terms — separar código de medios y licencias: https://21st.dev/terms
17. W3C Geolocation, especificación publicada (borrador vigente) — permiso, coordenadas y precisión: https://www.w3.org/TR/geolocation/
