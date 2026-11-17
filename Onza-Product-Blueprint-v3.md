# Onza — Product blueprint v3

16 de noviembre de 2026 · Propuesta de dirección de producto y entrega.

## Estado y uso

Este documento organiza el producto completo, pero no autoriza implementar todas sus funciones de golpe. Distingue decisiones del founder, propuestas de este plan y dependencias todavía sin resolver. No certifica el estado actual del repositorio. El último trabajo fue reportado en los commits e1e8987 y 8ae61b5; el implementador debe comprobar el HEAD real.

La captura nueva confirma un checkout con selector de resultado simulado, párrafo extenso sobre reservas y una alerta que obliga al empleado a abrir otro perfil para comprar. No prueba que todas las pantallas estén igual ni que los controles del retiro hayan regresado.

Las instrucciones actuales de Manu reemplazan dos decisiones de Onza-UX-v2.md: el acceso al personal sale de Ajustes y la elección de tema deja de tener textos explicativos redundantes. La marca, los controles de seguridad ya corregidos y el stack se conservan. Al incorporar este documento al repo, consolidar las instrucciones vigentes y marcar las anteriores como históricas; no mantener dos mandatos opuestos.

## 1. Producto y límite del primer lanzamiento

Promesa: encontrar el local correcto, pedir una ronda, conocer su estado y recogerla con una credencial válida. El bar recibe una cola operable y puede administrar menú y disponibilidad.

Primer piloto: un local colaborador, una barra de retiro y menú corto. Varias personas reales prueban como clientes mientras una persona opera la barra. El modelo admite varias organizaciones y locales, pero no exige construir todas las herramientas de una cadena para el piloto.

Dentro del primer alcance: catálogo, búsqueda, carrito, acceso del cliente, pedido, seguimiento, retiro, cola, menú, imágenes, disponibilidad, miembros y resumen de operaciones Onza. Pagos simulados hasta confirmar integración bancaria.

Fuera: tiquetera, bundles previos a eventos, fidelidad, promociones complejas, elasticidad de precios, predicciones de consumo, app nativa, múltiples monedas por pedido y entregas parciales. Conservar datos ordenados para inteligencia futura sin fabricar un dashboard de predicciones ahora.

No prometer eliminar las filas si la barra no tiene capacidad de preparación o un punto de retiro definido. La demanda digital también puede saturar el servicio: pausar pedidos debe ser una operación visible y rápida.

## 2. Arquitectura de experiencia

Se consideraron tres caminos:

- Continuar parchando la interfaz única: menor esfuerzo inicial, pero mantiene mezcla de cliente, empleado y herramientas de demo.
- Separar en repositorios, bases y autenticaciones distintas: aumenta infraestructura, sincronización y errores antes de validar el producto.
- **Propuesta recomendada: mismo repo y backend, dos interfaces con navegación propia, una identidad y permisos por organización.** Reutiliza el trabajo útil y permite cambiar de contexto sin una explicación técnica.

No hace falta comprar otro dominio. Hoy las rutas pueden separar experiencias; más adelante un subdominio de equipo puede apuntar a la misma aplicación. Un subdominio por sí solo no es un control de acceso ni arregla sesiones.

| Área | Entrada propuesta | Navegación | Qué no aparece |
| --- | --- | --- | --- |
| Cliente | / y enlaces QR al local | Explorar, Pedidos, Cuenta | Cola, roles, incidencias técnicas y simulador |
| Acceso cliente | /acceso | Google o correo configurados; volver a la compra | Selector de rol o creación de organización |
| Equipo | /equipo/acceso | Acceso y selección de organización solo si hay varias | Carrito y navegación de consumidor |
| Barra | /equipo/[organizacion]/[local]/barra | Nuevos, Preparando, Listos; escanear | Ajustes de propiedad o exportaciones generales |
| Negocio | /equipo/[organizacion]/[local] | Resumen, Pedidos, Menú, Local, Equipo | Configuración interna de Onza |
| Plataforma | Ruta interna existente protegida | Alta de negocios y soporte limitado | Acceso desde navegación del público |

Son destinos de producto, no una orden de renombrar todas las rutas. El implementador puede preservar rutas actuales con nuevos layouts y redirecciones. Debe documentar el mapeo y conservar enlaces a pedidos existentes.

En la página de acceso cliente hay un enlace secundario al pie: **¿Sos personal?**. En la web pública también puede existir un enlace discreto de pie a Equipo, sin ocupar la navegación principal. El empleado guarda la URL directa de su barra. No ponerlo en Ajustes ni exigir que cada cliente elija un rol al entrar.

## 3. Identidad, organizaciones y permisos

Decisión propuesta, pendiente de ratificación de Manu: navegar sin cuenta; solicitar acceso al confirmar la primera compra y volver al mismo carrito. Esto cambia el MVP invitado y añade fricción y dependencias; no bloquear el demo actual esperando OAuth o correo ni fingir un login operativo. No imponer un formulario antes de ver el menú. La pantalla de acceso se ofrece también desde Cuenta.

Una persona tiene una identidad, no un rol global excluyente de cliente o bartender. Las membresías añaden permisos laborales a esa identidad. Esa persona puede comprar en contexto cliente sin abrir incógnito. Ser empleado no concede acceso a pedidos de otras personas desde la interfaz cliente.

Separar: identidad de Auth, perfil, organización, local y membresía. Una organización puede tener varios locales; una persona puede trabajar en más de uno. El alcance de cada membresía se valida en servidor/RLS, no solo con un selector en pantalla. No confundir las organizaciones del producto con la organización administrativa del dashboard de Supabase.

| Capacidad | Cliente | Barra | Admin del negocio | Propietario | Plataforma |
| --- | --- | --- | --- | --- | --- |
| Comprar/ver pedidos propios | Sí | En contexto cliente | En contexto cliente | En contexto cliente | En contexto cliente |
| Operar pedidos del local asignado | No | Sí | Sí | Sí | Solo soporte autorizado y auditado |
| Editar menú, precios, fotos y estado | No | Marcar agotado/pausar según permiso | Sí | Sí | Alta/soporte acotados |
| Invitar o revocar personal | No | No | Solo personal de barra en locales asignados | Admins y personal de su organización | Bootstrap controlado |
| Configurar cobros futuros | No | No | No por defecto | Sí | Sin privilegio automático de retiro de fondos |

Ingreso del personal por invitación o membresía existente. Autenticarse con Google no crea permisos. Invitaciones con expiración, destinatario verificado y permisos explícitos; nadie elige ser admin desde el navegador. Revocar membresía corta el acceso en las comprobaciones del servidor. Evitar dejar una organización sin propietario activo. La transferencia de propiedad queda fuera del primer piloto. El mínimo inicial es alta controlada por Onza y membresías existentes; invitaciones autogestionadas y selector multiorganización se habilitan después según necesidad, sin retrasar el primer pedido.

Alta inicial de negocio: Onza crea o aprueba la organización y asigna su primer propietario. Después este invita al equipo y publica su menú. Autoservicio completo de comercios se deja para otra etapa.

Google y correo son opciones deseadas, no capacidades confirmadas. Definir un único método de correo para la primera versión, conservar el acceso existente durante la transición y listar configuración manual de OAuth/correo. No mostrar botones que no funcionan. No exigir teléfono, @usuario o perfil extenso sin una necesidad del piloto.

Preservar pedidos invitados ya existentes y su acceso durante la migración. No reasignarlos por email, código público ni parámetros del navegador. La vinculación futura exige prueba de pertenencia. El cliente no necesita leer “sesión invitada”, “JWT” ni “sesión de personal”.

## 4. Recorridos completos

### C1. Llegar y encontrar el local

QR del establecimiento → menú de ese local. No interponer Explorar ni redirigir al vecino por GPS.

Entrada general → Explorar → local elegido. Búsqueda y selección manual siempre disponibles. “Usar ubicación” es opcional y contextual. Con posición útil y coordenadas fiables, destacar el abierto más cercano sin duplicarlo; después otros abiertos cercanos. No afirmar que alguien está dentro de un bar ni llamar cercano a uno arbitrariamente lejano. No guardar tracking preciso del cliente.

Cerrados al final, portada atenuada, badge Cerrado, sin CTA de compra. Pausado es distinto de cerrado. Una URL directa conserva información y pedidos previos, pero no permite comprar. Estados de carga, error y ningún abierto tienen mensajes distintos.

### C2. Armar la ronda

Menú → Agregar → cantidad → carrito. Foto/título abren detalle; el control de cantidad no obliga a abrir otra pantalla. Filas con nombre, descripción breve, precio, imagen y control unidos visualmente. Agotados no se añaden.

Un carrito por local y moneda. Quitar línea, bajar cantidad a cero y Vaciar deben ser descubribles. Navegar no borra el carrito. Añadir de otro local solicita reemplazarlo o conservarlo. El dock grande solo aparece en el local dueño; otros contextos tienen acceso discreto al carrito guardado con nombre del local.

### C3. Identificarse y confirmar

Carrito → acceso si hace falta → retorno al carrito/checkout preservado → revisión final → confirmar. Redirección cancelada o login fallido no pierde selección. Revalidar precios, disponibilidad, estado del local y total en servidor; mostrar cambios antes de enviar.

Checkout muestra local, punto de retiro, productos, importe final y acción principal. En demo, “Confirmar pedido · ₡15 000” y una indicación discreta “Demo · sin cobros”. El texto real del botón financiero se decide con el flujo BAC confirmado, no con una preferencia estética.

La mayoría de condiciones va en un enlace breve “Cancelaciones y retiro”. Mostrar antes de confirmar cualquier condición que cambie materialmente el cobro o pérdida de dinero. No esconderla en una política larga. Conservar consentimientos necesarios sin casillas premarcadas por el sistema; una autodeclaración de edad no es verificación documental.

El selector “Resultado de reserva simulada” sale de la experiencia cliente. Los escenarios de prueba viven en herramientas internas con controles de servidor; esconder el select no basta si una API pública todavía permite elegir resultados.

### C4. Esperar y retirar

Recibido → Preparando → Listo → Entregado. Un estado principal, siguiente paso claro, lugar de retiro y resumen secundario. Recibido permite cancelar; después de aceptar, solo ayuda o incidencias según permisos. El servidor resuelve carreras con una única transición ganadora.

Listo muestra QR y código privado, distintos del número público. El bartender escanea o introduce lo presentado por el cliente. Tras comprobar local, rol, estado y credencial, se ejecuta el flujo de captura mock/entrega ya protegido. Una respuesta incierta se reconcilia; reintentar no cobra dos veces ni entrega otra vez.

Notificación visual inmediata y sonido opt-in. La experiencia no depende de vibración, audio o notificaciones en segundo plano: los permisos y capacidades varían. Al volver a la web, refrescar estado desde el servidor. No anunciar una capacidad de iPhone que no se haya probado físicamente.

### C5. Volver o pedir ayuda

Pedidos muestra activos primero e historial después. Sin pedidos: estado vacío breve. Sesión vencida: recuperar acceso, no “revisá tu conexión”. Pedido inexistente y sin permiso no exponen datos de terceros. Pedido entregado es comprobante, no ticket reutilizable.

Cuenta concentra identidad, salida, privacidad y apariencia. Apariencia: **Sistema / Claro / Oscuro** con selección clara e iconos accesibles. Sin subtítulos “elegí el tema de tu dispositivo” ni bloques repetidos. Una etiqueta pequeña es preferible a un icono cuyo significado haya que adivinar.

### E1. Operar barra

Acceso equipo → organización/local autorizado → barra. Si solo hay uno, entrada directa. Cabecera compacta con local y estado de recepción; pedidos nuevos, preparando y listos con cantidades y espera visibles. Acciones según estado: Aceptar, Rechazar, Marcar listo, Escanear retiro. No pedir al bartender que entienda reservas o sesiones.

Pausar recepción no abandona la cola existente. Dos empleados ven cambios confirmados, no estados inventados por la interfaz. Desconexión muestra estado discreto pero bloquea acciones que no se pueden confirmar; el regreso reconcilia datos. Una incidencia de pago permite retomar sin repetir captura.

### E2. Administrar el negocio

Resumen: pedidos e importe de operaciones Onza, sin presentarlos como todas las ventas del bar ni como dinero ya liquidado.

Menú: categorías, nombre, descripción, precio, foto y disponibilidad. Guardar con feedback local y vista previa. Imágenes con tamaño/tipo permitido, Storage autorizado por local y fallback. La configuración del local contiene portada, logo, dirección, coordenadas, horario y barra de retiro. Revisar calendario y zona horaria antes de automatizar abierto/cerrado.

Equipo: invitar, ver estado de invitación, asignar alcance y revocar. Propietario controla permisos sensibles. Un cambio de precio afecta compras nuevas; un pedido confirmado conserva su snapshot de producto/precio.

### E3. Preparar y publicar el primer bar

Organización y propietario → perfil → barra de retiro → menú corto con precios/imágenes → miembro de prueba → pedido de prueba → listo/retiro → publicar. Mantener borradores y datos de QA fuera del catálogo público. No borrar masivamente datos remotos para “limpiar la demo”. Identificar y archivar solo fixtures propios tras comprobar dependencias.

## 5. Reglas operativas y financieras

Separar estado de preparación, estado de pago y liquidación al comercio. “Entregado” no demuestra que el banco haya depositado. No crear una columna única con todas las combinaciones posibles.

| Situación | Política de producto propuesta | Condición para implementar |
| --- | --- | --- |
| Cliente cancela antes de aceptación | Cancelar y anular autorización según proveedor | Operación idempotente confirmada |
| Bar rechaza o no acepta a tiempo | No preparar; iniciar anulación/reconciliación | Timeout server-side, mensaje y estado financiero correctos |
| Pedido aceptado | Sin cancelación automática del cliente | Incidencias con permiso y motivo |
| Cliente no recoge un trago preparado | No definir automáticamente devolución total | Decisión comercial y compatibilidad bancaria pendientes |
| Captura con resultado desconocido | Consultar/reconciliar, no repetir a ciegas | Identificador estable del proveedor |
| Reserva vencida antes de entregar | No fingir que está pagado | Recuperación definida y confirmación del cliente si corresponde |

Los tiempos actuales de 2 y 20 minutos son reglas del demo reportadas en la captura, no una política ratificada para producción. No convertir “no llegó en 20 minutos” en anulación automática de un trago preparado sin revisar coste y abuso. Tampoco cambiarlos silenciosamente en una entrega visual.

BAC sigue siendo el candidato elegido. Preautorización, captura diferida, identificación del comercio, anulación, devoluciones, comisiones y liquidación requieren confirmación técnica/comercial. La arquitectura los representa mediante un adaptador de pagos; no promete soporte porque el demo lo simula. No operar con fondos reales en esta etapa.

## 6. Contrato visual y de contenido

Mantener blanco/grafito/borgoña, wordmark y símbolo del shot sin línea interior. Una sola familia tipográfica existente. Fotografía de bebida/local como identidad; evitar que todas las portadas sean el mismo gradiente con iniciales. Fallbacks honestos y discretos hasta tener fotos con derechos.

Propuesta de tokens iniciales: escala 4/8; márgenes móviles 16–20 px; cuerpo 16 px; metadatos 13–14 px; títulos contenidos 24–28 px; control primario 44–48 px de alto; área táctil objetivo 44×44 px. Son objetivos propios, no una certificación normativa. Usar roles semánticos de color y los tokens existentes antes de crear otros.

Tres composiciones distintas: cliente visual y móvil; barra densa y operativa; negocio con formularios/tablas claras. Comparten tipografía, controles y lenguaje, no necesariamente el mismo layout.

| Pantalla canónica | Composición objetivo |
| --- | --- |
| Explorar | Marca pequeña, zona/búsqueda, un destacado útil, otros abiertos, cerrados secundarios |
| Menú | Identidad compacta, categorías, productos visibles pronto; controles de lista compactos |
| Carrito | Local identificado, líneas editables, Quitar, Vaciar y total; estados lleno y vacío |
| Checkout | Resumen, total y una acción; políticas secundarias sin ocultar condiciones económicas |
| Listo | Estado, punto de retiro y ticket dominantes; resumen colapsable |
| Barra desktop | Cola legible, tiempos y acciones; navegación cliente ausente |
| Local/menú admin | Edición alineada con vista previa y guardado inequívoco |

Componentes: CustomerShell, TeamShell, VenueCard, ProductRow, AddControl, QuantityStepper, CartSummary, CheckoutSummary, OrderStatus, PickupTicket, QueueCard, Field, Dialog y ThemeChoice. Mapear a los existentes; estos nombres no exigen reescribirlos.

Microcopy preferida: “Agregar”, “Ver carrito”, “Confirmar pedido”, “Preparando”, “Listo para recoger”, “Mostrar código”, “Reintentar”. Evitar instrucciones de sesión, nombres de base de datos, párrafos tranquilizadores genéricos y pasos de QA. Mensajes junto al problema y con una acción útil. No quitar información material solo para que una pantalla se vea más vacía.

## 7. Ingeniería mínima y crecimiento

Conservar una aplicación Next.js y Supabase. Separar módulos de catálogo, identidad/membresías, pedidos/retiro, pagos y administración. UI consume contratos de dominio; no replica reglas financieras en componentes.

Entidades conceptuales: Profile, Organization, Venue, Membership, Invitation, Category, Product, Order, OrderItemSnapshot, OrderEvent, PaymentAttempt y PickupCredential. Antes de crear tablas, mapear al esquema actual. Añadir organización sin romper venue_id ni RLS. Los roles de la app no se asignan editando metadata del cliente.

Persistir importes enteros en unidades monetarias menores, moneda y snapshots. Mantener versionado/idempotencia de comandos y eventos con actor, hora y motivo. No guardar secretos o credenciales de retiro en analítica. Consultas y Realtime acotados al usuario/local autorizado. Catálogo cacheable; mutaciones y estado financiero se confirman en servidor.

Los eventos de pedidos permiten más adelante medir ventas Onza, productos, espera, aceptación y no-show. No permiten deducir todas las ventas del bar, elasticidad causal ni market sentiment sin datos adicionales y diseño de medición.

## 8. Roadmap con puertas de salida

No son promesas de horas de implementación. Cada etapa termina con evidencia y una decisión; no se abre la siguiente por haber generado código.

| Etapa | Entrega | Termina cuando |
| --- | --- | --- |
| 0. Alinear | Contrastar este plan con código actual; decisiones y dependencias | Existe un mapeo de conservar/cambiar/pendiente sin otra auditoría gigante |
| 1. Diseñar el recorrido | 5 pantallas cliente y 2 equipo en bocetos visuales coherentes | Manu aprueba composición y navegación; no solo texto “premium” |
| 2. Identidad y equipos | Layouts separados, acceso, membresías y migración de sesiones | Un empleado compra y opera sin perfiles de navegador separados; permisos se mantienen |
| 3. Pedido completo | Menú, carrito, checkout limpio, estados y retiro sobre componentes aprobados | Dos dispositivos completan un pedido sin herramientas de QA visibles |
| 4. Negocio piloto | Perfil, menú, imágenes, disponibilidad y membresías; invitaciones si hay necesidad | Propietario prepara el local sin editar SQL y personal solo ve su alcance |
| 5. Piloto operativo | Pruebas físicas, datos propios, incidencias y mediciones | Se puede operar una sesión real de prueba con resultado registrado |
| 6. Dinero real | Contrato/integración bancaria y políticas ratificadas | Pruebas de autorización, captura, anulaciones y reconciliación con proveedor |
| 7. Expansión | Más locales y después inteligencia | El piloto evidencia adopción y operación sostenible |

## 9. Cómo encargar trabajo a la IA sin desperdicio

Un solo índice de producto en el repo enlaza reglas vigentes, referencias visuales aprobadas, estado de implementación y backlog. AGENTS.md contiene instrucciones estables y breves; DIARIO.md conserva historia, sin convertirse en la única especificación.

Cada encargo incluye: objetivo, tramo del recorrido, qué reutilizar, reglas, evidencia de aceptación y exclusiones. No mandar el roadmap entero como una orden de implementar todo. Una persona/IA escribe la rama compartida a la vez. No repetir inventario, instalar herramientas nuevas o recrear infraestructura por no encontrar una clave.

Selección propuesta, no benchmark oficial: planificación arquitectónica acotada con Astra High Standard si está disponible; alternativa de menor coste Sol High Standard. Implementación de UI especificada con Sol Medium Standard; autenticación, RLS y transacciones con Sol High Standard. No usar Extra High/Ultra automáticamente ni pedir múltiples revisiones completas.

Para este primer encargo, solo planificación en el repo real, sin modificar producto, base ni despliegue:

> Lee AGENTS.md, CLAUDE.md, este Onza-Product-Blueprint-v3.md y el estado vigente. Trabaja en fix/hosted-integration, conservando cambios ajenos. Tu objetivo es concretar una especificación ejecutable, no implementar. Inspecciona solo los módulos necesarios de auth, roles, layouts, catálogo, pedidos y pagos. Mapea el estado actual a esta propuesta con tres etiquetas: conservar, modificar, pendiente de decisión. Corrige supuestos incompatibles con el código y señala conflictos, sin dar por aprobado un diseño distinto. Define rutas/layouts, identidad única, organizaciones/membresías, flujos cliente/equipo, estados, errores, migración compatible y condiciones de prueba. Usa un documento canónico y un backlog ordenado, evitando duplicar instrucciones históricas. Incluye contratos de composición para cinco pantallas de cliente —Explorar, Menú, Carrito, Checkout y Listo— y dos de equipo que sirvan para preparar bocetos visuales. No instales dependencias, no reescribas código de producto, no cambies esquema/configuración remota y no despliegues. No repitas las 81 capturas ni construyas un gateway. Investiga solo incógnitas concretas. Si no hay acceso al backend, planifica con el código y marca lo no verificado. Entrega un plan compacto con decisiones, riesgos, dependencias manuales de Google/correo/BAC y encargos pequeños con aceptación. Detente antes de implementar: el siguiente paso es ver y aprobar las pantallas. Resume en pocas líneas, sin transcribir todos los archivos.

Modelos para ese encargo: Astra High Standard una vez, o Sol High Standard para priorizar uso. Una configuración mayor no decide por Manu el gusto visual ni garantiza que no se agote el cupo.

## 10. Criterios de aceptación de producto

- El cliente ve tragos y locales sin entender roles, sesiones o simuladores.
- Un empleado puede usar la experiencia cliente y su área autorizada sin cambiar de navegador.
- Un invitado al equipo no obtiene permisos hasta aceptar con la identidad correcta; un revocado no conserva acceso efectivo.
- Carrito, pedido y ticket son objetos distintos y están nombrados de forma consistente.
- Precios, disponibilidad, permisos, cancelación y retiro se comprueban en servidor.
- QR privado y número público no son intercambiables. Reintentos no duplican cobros ni entregas.
- Menú, carrito, checkout y ticket funcionan en teléfono físico y ambos temas.
- Sin GPS, cámara, sonido o una foto, existe un recorrido claro y honesto.
- Los cambios de consentimiento o condiciones económicas no se esconden detrás de minimalismo.
- No se presenta el mock, un contador de tests o una captura como certificación bancaria o de producción.

## Referencias primarias consultadas

Aplicación de estos principios a Onza: propuesta de este documento, no mandato de las fuentes.

- Linear, Design is more than code: https://linear.app/now/design-is-more-than-code
- Linear, Scope projects down: https://linear.app/method/scope-projects
- Basecamp, Shape Up, Find the Elements: https://basecamp.com/shapeup/1.3-chapter-04
- Apple HIG, Writing: https://developer.apple.com/design/human-interface-guidelines/writing.md
- OpenAI, Build responsive front-end designs: https://learn.chatgpt.com/use-cases/frontend-designs
- OpenAI, Models: https://learn.chatgpt.com/docs/models
- Supabase, Users: https://supabase.com/docs/guides/auth/users
- Square, Fulfill orders: https://squareup.com/help/us/en/article/6923-pickup-orders-on-square-point-of-sale
