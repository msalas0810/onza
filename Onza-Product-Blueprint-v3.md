# Onza — Product blueprint v3

16 de noviembre de 2026 · Propuesta de dirección de producto y entrega.

## Estado y uso

Este documento organiza el producto completo, pero no autoriza implementar todas sus funciones de golpe. Distingue decisiones del founder, propuestas de este plan y dependencias todavía sin resolver. No certifica el estado actual del repositorio. El último trabajo fue reportado en los commits e1e8987 y 8ae61b5; el implementador debe comprobar el HEAD real.

La captura nueva confirma un checkout con selector de resultado simulado, párrafo extenso sobre reservas y una alerta que obliga al empleado a abrir otro perfil para comprar. No prueba que todas las pantallas estén igual ni que los controles del retiro hayan regresado.

**Lectura obligatoria primero: sección 0 (registro consolidado).** Las instrucciones actuales de Manu reemplazan dos decisiones de Onza-UX-v2.md: el acceso al personal sale de Ajustes y la elección de tema deja de tener textos explicativos redundantes. La marca, los controles de seguridad ya corregidos y el stack se conservan. Al incorporar este documento al repo, consolidar las instrucciones vigentes y marcar las anteriores como históricas; no mantener dos mandatos opuestos.

## 0. Registro consolidado · documento canónico (vigente desde 2026-11-17)

Este bloque es la fuente vigente. **Reemplaza cualquier instrucción anterior que lo contradiga**: las secciones 2, 3, C1, C3 y 7–8 de más abajo, `Onza-UX-v2.md`, las reglas de acceso de `AGENTS.md` previas a esta fecha y los guiones de demo "invitado" del `README.md` y de `docs/01-producto-y-diseno.md`. Esas partes quedan como **históricas** (ver 0.6) y no se editan una por una. El plan de trabajo vigente está en [`docs/hosted-ux-plan.md`](docs/hosted-ux-plan.md) (sección "Plan vigente 2026-11-17"). Los bocetos aprobables están en [`design/bocetos/`](design/bocetos/README.md) y **no son funciones implementadas**.

Las cuatro etiquetas de abajo no se mezclan: lo acordado no está implementado, y lo implementado no se amplía por estar acordado otra cosa.

### 0.1 Acordado

| # | Decisión |
| --- | --- |
| 1 | Onza es una web app. Sin landing por ahora. |
| 2 | Login obligatorio desde la entrada. Explorar, menús, carrito y pedidos requieren sesión. Con sesión vigente se entra directo. Un QR de local conserva su destino durante acceso y onboarding. |
| 3 | Acceso cliente: correo y contraseña con confirmación; Continuar con Google; Continuar con Apple visible, deshabilitado y con "Próximamente"; recuperación de contraseña; "¿Sos personal?" al pie. |
| 4 | Cuenta personal y cuenta laboral son distintas. La personal compra; la laboral opera y nunca compra. Sin cambio de modo, sin transferencias de invitados, sin turnos. |
| 5 | Navegación separada: área cliente y portal laboral. Hoy `/acceso` y `/equipo/acceso`. Futuro: dominio principal para clientes y `personal.<dominio>` para el equipo (sin configurar dominios ahora). |
| 6 | Solo dos permisos laborales por local: **empleado** y **administrador**. Sin organizaciones, propietario ni gestión de cadenas. El acceso interno de Onza queda separado. |
| 7 | Empleados con cuentas individuales y acceso asignado. Registrarse como cliente no concede permisos laborales. |
| 8 | Supabase Free. No se contratan servicios ni se desactiva la confirmación por correo para evitar configurarla. |
| 9 | Pagos mock. BAC e integración bancaria real quedan fuera. |
| 10 | Pedidos invitados antiguos se conservan sin reasignarlos ni borrarlos. |

**Onboarding y privacidad acordados**

- Nombre, @usuario único, teléfono internacional (+506 por defecto) y fecha de nacimiento. Google aporta nombre y correo; se completa lo restante.
- Teléfono normalizado y **explícitamente no verificado**. Sin SMS ni DNI.
- Validación 18+ en servidor para el producto futuro. Una fecha declarada no se presenta como verificación documental.
- Aceptación de condiciones y privacidad, con fecha y versión.
- Dos preferencias opcionales y desmarcadas: novedades y ofertas de discotecas favoritas. Sin WhatsApp.
- Perfil, preferencias, páginas legales (borradores) y borrado de cuenta funcional.
- El personal no recibe correo, teléfono ni fecha de nacimiento del cliente.

**Comportamiento de producto acordado (bocetos)**: Explorar con abiertos primero y destacado cercano si hay ubicación, alternativa sin ubicación, cerrados atenuados y no accionables. Menú con filas compactas y Agregar que pasa a cantidad. Carrito de un solo local con quitar, vaciar y reemplazar/conservar; dock solo en el local dueño. Checkout con resumen, total, condiciones materiales y una acción, sin selector de resultado simulado. Pedido cancelable solo antes de aceptación; Listo destaca punto de retiro, QR y código privado distinto del número público. Barra con Nuevos / Preparando / Listos y validación de retiro. Apariencia Sistema / Claro / Oscuro. Equipo fuera de Ajustes del cliente.

### 0.2 Reglas especificadas (no implementadas)

**R1 · Identidades personales y laborales no se mezclan.** Dos formularios no garantizan cuentas independientes: según la documentación de Supabase Auth, identidades con el mismo correo verificado pueden terminar vinculadas al mismo usuario (por ejemplo correo + Google). Verificar el comportamiento vigente en la documentación antes de implementar. Reglas:

1. Un correo = un usuario de Auth = un tipo de cuenta (`customer` o `staff`), guardado en el perfil, asignado **en servidor** al crear la cuenta e inmutable desde el cliente.
2. Cuentas laborales: solo correo y contraseña, creadas por alta del administrador del local (o de Onza). `/equipo/acceso` no ofrece registro abierto ni Google.
3. El correo laboral debe ser distinto del personal. Si el correo invitado ya pertenece a una cuenta `customer`, la alta se rechaza con "Usá otro correo para la cuenta laboral". Nunca se convierte ni se vincula.
4. Si alguien entra con Google en `/acceso` y el correo corresponde a una cuenta `staff`, el callback de servidor rechaza el ingreso, cierra la sesión creada y no vincula identidades.
5. Comprar exige `account_kind = customer` verificado en servidor (RPC de checkout), no solo en la interfaz. Operar exige `account_kind = staff` **y** membresía vigente del local.
6. Pruebas obligatorias antes de dar la regla por implementada: Google con correo laboral, registro por correo con correo existente, alta laboral con correo de cliente, y empleado intentando comprar vía API.

**R2 · Abrir el acceso equivocado.** Abrir `/acceso` con una sesión laboral vigente (o `/equipo/acceso` con una personal) **no cierra la sesión**. Se muestra "Ya hay una sesión iniciada" con la cuenta activa y dos acciones: **Continuar al área correcta** y **Usar otra cuenta**. Solo esta última cierra la sesión actual, y solo después de elegirla. Un QR de local abierto con sesión laboral conserva su destino y ofrece Usar otra cuenta, porque la cuenta laboral no compra.

**R3 · Borrado de cuenta sin script manual.** Flujo de producto en Cuenta → Privacidad: confirmación con reautenticación → ruta de servidor (`service_role` solo allí) que en una operación idempotente registra la solicitud, revoca sesiones, anonimiza perfil (nombre, @usuario, teléfono, nacimiento, preferencias) y elimina el usuario de Auth por la API de administración. Si algún paso falla queda `pending`, con reintento automático y estado visible ("Eliminación en curso"); nunca depende de que una persona ejecute un script. Los pedidos se conservan anonimizados, sin datos personales, por trazabilidad operativa. Pedidos activos bloquean el borrado hasta terminar o cancelarse. Cuenta laboral: el empleado no se borra solo; el administrador revoca el acceso y la eliminación de datos pasa por el mismo servicio. El plazo de retención es una decisión legal pendiente. Con pruebas automatizadas del flujo completo.

**R4 · Migraciones coordinadas con el frontend desplegado.** El Preview desplegado usa el mismo proyecto `onza-dev`. Patrón expandir → desplegar → contraer:

1. Migración **aditiva** compatible con el commit desplegado (tablas o columnas nuevas nullable, RPC nuevas, firmas existentes intactas).
2. Desplegar el frontend que usa lo nuevo, detrás de un indicador, y verificar el Preview.
3. Solo en una entrega posterior, migración de **contracción** (retirar columnas, endurecer RLS o constraints) cuando ningún frontend desplegado dependa de lo viejo.
4. Prohibido en una sola entrega: renombrar o borrar columnas usadas, cambiar firmas de RPC, o endurecer una política que el demo desplegado viole. Ejemplo: la sesión anónima de Supabase y los permisos `bartender/admin/onza` actuales siguen vigentes hasta que el frontend nuevo esté desplegado y verificado; recién entonces se retiran.
5. Cada migración registra en `DIARIO.md` con qué commit desplegado es compatible.

**R5 · Nuevas versiones de condiciones.** Publicar una versión nueva no inserta aceptaciones. Si la persona no aceptó la versión vigente, al volver a la app ve una pantalla "Actualizamos las condiciones" con enlace al texto y **Aceptar y continuar**. Solo esa acción, ejecutada en servidor, registra usuario, documento, versión y fecha. Mientras tanto no puede comprar; sí puede leer el texto, cerrar sesión o borrar su cuenta.

**R6 · Cierre de sesión y borradores.** **Logout voluntario** limpia los datos locales de Onza: carrito, destino de QR, borrador de onboarding y de formularios. La preferencia de apariencia se conserva porque es del dispositivo y no contiene datos personales. **Sesión vencida o revocada** no limpia: guarda el borrador asociado al identificador opaco de la cuenta, con caducidad (propuesta: 7 días) y sin contraseñas ni datos de pago. Al volver a entrar, el borrador se ofrece solo si es la misma cuenta; con otra cuenta se descarta sin mostrarse.

### 0.3 Dependencias manuales (no las resuelve el código)

| Dependencia | Qué falta | Quién |
| --- | --- | --- |
| Google OAuth | Pantalla de consentimiento y credenciales en Google Cloud; URI de redirección de Supabase; activar el proveedor en Supabase con el ID y el secreto. | Manu |
| Envío de correos | El SMTP integrado de Supabase está pensado para pruebas y tiene límites estrictos (confirmar los vigentes en su documentación). Para clientes reales hace falta SMTP propio. Es una decisión de costo, no se desactiva la confirmación para evitarlo. | Manu |
| URLs y plantillas de Auth | Site URL, Redirect URLs (incluido el destino QR) y plantillas en español de confirmación y recuperación. | Manu |
| Sesiones anónimas | Retirar el inicio de sesión anónimo solo tras desplegar y verificar el frontend nuevo (R4). Es un ajuste de Supabase que requiere aprobación. | Manu |
| Apple | Fuera de alcance. Botón visible y deshabilitado. | — |
| Dominio futuro | DNS y Vercel para `personal.<dominio>`. Hoy no se configura. | Manu |
| Textos legales | Condiciones y privacidad son borradores; requieren revisión legal, incluida la retención tras borrar cuenta y el criterio 18+. | Manu / asesoría |
| Altas laborales | Alta inicial de administradores por Onza (sin autoservicio de comercios). | Manu |

### 0.4 Implementado y verificado (evidencia existente, no re-verificada en esta sesión)

Según `DIARIO.md` (D-2026-11-16-03 a 05) y [`docs/hosted-ux-verification.md`](docs/hosted-ux-verification.md): aplicación Next.js + Supabase alojado `onza-dev` con pagos **mock**; catálogo con abiertos primero y ubicación efímera opcional; carrito con quitar/vaciar, cambio explícito de local y dock contextual; retiro con credencial privada de 12 caracteres distinta del número público, intentos limitados y consumo único; cola de barra con Realtime; administración de menú e imágenes en Storage; `npm run check` (typecheck, lint, 74 pruebas, build), 11 casos E2E contra `onza-dev`, 29 controles alojados, CI run 43937917513 y Preview READY (`e1e8987`) con nueve controles HTTPS. Capturas en `docs/evidence/hosted-ux/`. Límites: sin pruebas en iPhone/Android físicos, GPS/cámara/audio ni cobros reales.

**Actualización 2026-11-17 (código, sin desplegar):** cuentas de cliente, onboarding, `/acceso`, `/equipo/acceso`, `/sesion-activa`, `/cuenta` y la separación cliente/equipo en servidor están implementados detrás de `ACCOUNTS_REQUIRED` (apagado por defecto) con la migración aditiva `202611170010`. Verificado offline: typecheck, lint, 88 pruebas (incluye el recorrido SQL con dos sesiones y la política de acceso) y build. **No** aplicado a `onza-dev`, **no** desplegado y **no** probado con Supabase real ni en teléfono; ver `DIARIO.md` D-2026-11-17-02.

Hasta activar esa bandera, lo implementado en producción **no** coincide con 0.1: el cliente entra como invitado anónimo de Supabase, los roles laborales son `bartender`, `admin` y `onza` en `memberships`, y el checkout conserva el simulador de resultado.

### 0.5 Pendiente

1. Aprobación visual de los bocetos (`design/bocetos/`).
2. Cuentas de cliente: acceso, confirmación, Google, recuperación y onboarding (con R1, R2, R4–R6).
3. Perfil, preferencias, páginas legales y borrado de cuenta (R3).
4. Portal laboral separado, dos permisos (empleado/administrador) y migración desde `bartender/admin/onza` según R4.
5. Rediseño de pantallas de producción según los bocetos aprobados; retiro del selector de resultado simulado de la experiencia cliente.
6. Dependencias manuales de 0.3.
7. Pruebas físicas, fotos con derechos, scheduler durable (PEN-002, PEN-003, PEN-005) y cobros reales (PEN-006, fuera de alcance).

### 0.6 Instrucciones anteriores que pasan a ser históricas

- Sección 2 de este documento (organizaciones, tabla de áreas con "organización/local") y sección 3 (organizaciones, propietario, plataforma como rol de la matriz, "navegar sin cuenta") y C1/C3 en lo que dependen de compra sin cuenta o invitado.
- Sección 7 en lo relativo a organizaciones; sección 8, etapa 2 ("empleado compra y opera sin perfiles separados"): ahora la cuenta laboral nunca compra.
- `Onza-UX-v2.md`: acceso del personal en Ajustes y subtítulos del tema (ya reemplazados antes), y el cliente invitado.
- `AGENTS.md`: "Cliente sin formulario de login obligatorio" (reemplazada).
- `README.md` y `docs/01-producto-y-diseno.md`: guiones de demo con cliente invitado sin login; describen el estado implementado, no el objetivo.

## 1. Producto y límite del primer lanzamiento

Promesa: encontrar el local correcto, pedir una ronda, conocer su estado y recogerla con una credencial válida. El bar recibe una cola operable y puede administrar menú y disponibilidad.

Primer piloto: un local colaborador, una barra de retiro y menú corto. Varias personas reales prueban como clientes mientras una persona opera la barra. El modelo admite varias organizaciones y locales, pero no exige construir todas las herramientas de una cadena para el piloto.

Dentro del primer alcance: catálogo, búsqueda, carrito, acceso del cliente, pedido, seguimiento, retiro, cola, menú, imágenes, disponibilidad, miembros y resumen de operaciones Onza. Pagos simulados hasta confirmar integración bancaria.

Fuera: tiquetera, bundles previos a eventos, fidelidad, promociones complejas, elasticidad de precios, predicciones de consumo, app nativa, múltiples monedas por pedido y entregas parciales. Conservar datos ordenados para inteligencia futura sin fabricar un dashboard de predicciones ahora.

No prometer eliminar las filas si la barra no tiene capacidad de preparación o un punto de retiro definido. La demanda digital también puede saturar el servicio: pausar pedidos debe ser una operación visible y rápida.

## 2. Arquitectura de experiencia
> **HISTÓRICO desde 2026-11-17** — contradice el registro consolidado de la sección 0; no seguir donde difieran.



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
> **HISTÓRICO desde 2026-11-17** — contradice el registro consolidado de la sección 0; no seguir donde difieran.



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

> **Parcialmente histórico:** Explorar y el QR requieren sesión; el QR conserva su destino durante acceso y onboarding (sección 0).


QR del establecimiento → menú de ese local. No interponer Explorar ni redirigir al vecino por GPS.

Entrada general → Explorar → local elegido. Búsqueda y selección manual siempre disponibles. “Usar ubicación” es opcional y contextual. Con posición útil y coordenadas fiables, destacar el abierto más cercano sin duplicarlo; después otros abiertos cercanos. No afirmar que alguien está dentro de un bar ni llamar cercano a uno arbitrariamente lejano. No guardar tracking preciso del cliente.

Cerrados al final, portada atenuada, badge Cerrado, sin CTA de compra. Pausado es distinto de cerrado. Una URL directa conserva información y pedidos previos, pero no permite comprar. Estados de carga, error y ningún abierto tienen mensajes distintos.

### C2. Armar la ronda

Menú → Agregar → cantidad → carrito. Foto/título abren detalle; el control de cantidad no obliga a abrir otra pantalla. Filas con nombre, descripción breve, precio, imagen y control unidos visualmente. Agotados no se añaden.

Un carrito por local y moneda. Quitar línea, bajar cantidad a cero y Vaciar deben ser descubribles. Navegar no borra el carrito. Añadir de otro local solicita reemplazarlo o conservarlo. El dock grande solo aparece en el local dueño; otros contextos tienen acceso discreto al carrito guardado con nombre del local.

### C3. Identificarse y confirmar

> **Parcialmente histórico:** el login ya es obligatorio desde la entrada (sección 0); el resto del flujo de checkout sigue vigente.


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
