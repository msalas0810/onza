# Onza · Especificación de rescate y entrega
19 de noviembre de 2026

## Qué tiene que quedar

Completar todos los requisitos vigentes de la nota de voz, los puntos posteriores de Manu y el plan de pulido. Revisar primero lo que Claude ya cambió y conservar lo que se pueda demostrar que funciona. El objetivo es una app con una identidad reconocible, operable a una mano en el teléfono, con flujos de cliente, barra y administración correctos de extremo a extremo. El trabajo termina con código claro y verificable, una rama revisable y un repo que solo contiene lo necesario para construir, operar y mantener Onza.

### Insumos y precedencia

1. Esta especificación y las decisiones más recientes de Manu. Una regla específica reciente resuelve contradicciones con notas antiguas.
2. `docs/Onza-Plan-de-pulido.md`. Contiene detalles de implementación, pruebas y decisiones de piloto. Léelo completo.
3. Transcripción `Pasted text(20261119-090655).txt` y el ZIP `onza screens and logic.zip` si están en el Mac. La transcripción se volvió a revisar para redactar la matriz de este documento. La matriz permite avanzar si el original no está en el repo. Si aparece un requisito vigente en el audio que falta en la matriz, agregalo y comprobalo.
4. `onza-acceso-video.html`, `onza-acceso-video-horizontal.html`, capturas de Onza y referencias locales de Bozu. Identificá qué ilustra cada referencia. Bozu sirve para estudiar pasos, orden de acciones y navegación. Los elementos visuales y los assets de Onza conservan su propia identidad.
5. `CLAUDE.md`, `AGENTS.md`, `DIARIO.md`, blueprint vigente, código, migraciones, scripts y pruebas existentes. Descubrí rutas, contratos, comandos y convenciones antes de editar.

**Scope vigente.** Google y Apple se mantienen deshabilitados en el acceso cliente. Cliente y equipo conservan el fondo de video aprobado. Producción y el Preview que ya usa Manu permanecen en su rama de despliegue actual. El trabajo se hace en una rama local de revisión con datos de prueba, pagos mock y una base aislada. Los cambios de datos para piloto quedan preparados y probados donde haya acceso seguro. Las mejoras sociales públicas y las recomendaciones de tiempos a partir de datos reales estaban planteadas a futuro. En esta entrega se implementa el perfil editable y se dejan las mediciones listas.

## 0 · Auditar el trabajo anterior con la app abierta

- Registrá directorio, rama, SHA, worktrees y estado del índice. Compará el trabajo de anoche con la base que trae `fed5794` y los cambios de `3babdcb` y `2d3925d`. Si el historial fue reescrito, verificá cambios equivalentes en los flujos y assets. Revisá por separado commits, cambios staged, cambios unstaged y archivos sin rastrear relevantes. El código local puede estar más adelantado que lo que sirve Vercel.
- Preservá lo ya hecho por el usuario y los cambios útiles de anoche. Usá una rama de revisión separada. Si necesitás un worktree, asegurate de llevar los cambios de código relevantes que no estaban en el commit, tras identificarlos y sin mezclar referencias privadas ni secretos. No hagás reset, clean a ciegas, force-push ni destruyás el trabajo anterior.
- Levantá la rama local con las herramientas del proyecto y una base de prueba. Tomá como referencia el navegador que realmente está sirviendo esa rama. Recoré cliente, bartender y admin en sesiones separadas con fixtures. Guardá captura inicial de «Tus locales» y de cada pantalla que vayas a cambiar. Buscá las rutas reales desde el código y anotá cualquier bloqueo de entorno. Un componente aislado puede ayudarte a corregir UI si falla la base local. Eso no prueba que la pantalla integrada funcione.
- Creá `docs/Onza-Matriz-de-entrega.md` con **una fila por ID**. Campos mínimos: estado, pantalla o transición, archivo, prueba/captura, SHA y pendiente. Usá solo **verificado**, **parcial**, **pendiente** o **bloqueado**. Actualizala a medida que cerrás puntos. «Verificado» requiere que el resultado funcione en la interfaz o transición real. La existencia del código, la salida de build, una captura que nunca abriste y la aseveración del agente anterior no cuentan por sí solas.
- Corregí primero «Tus locales» (T01–T02) y usalo para validar la base visual compartida. Después cerrá los bugs de pedidos/disponibilidad (O01–O03), completá los recorridos de cliente, barra y administración, y terminá con cupos, listas de espera y automatización. Podés avanzar con piezas independientes si algún servicio se bloquea. Mantené commits pequeños por pantalla o flujo verificable y separá refactor, corrección de comportamiento y limpieza cuando puedan revisarse por separado.

## 1 · Diseño y componentes que sí se reutilizan

**Dirección Onza.** Sobre el acceso aprobado, conservá el vasito, palabra «Onza» y punto rojo oficial, Inter y la paleta existente. El vidrio esmerilado funciona en formularios y capas sobre el video, con contraste y fondo de respaldo. En barra y admin preferí superficies estables, densidad legible, espaciado claro y una acción principal por contexto. Para cliente, hacé que las fotos de locales y tragos guíen la navegación. No repitás tres veces la misma información ni uses rojo de marca para acciones cuyo significado es éxito o aceptación. Usá movimiento breve para enseñar qué cambió, con versión estática para movimiento reducido.

**Contratos compartidos.** Inspeccioná y extendé lo que ya existe antes de crear componentes con otro nombre. Centralizá tokens semánticos de texto, superficies, borde, marca, éxito, aviso y peligro. Usá escalas de tipografía, espaciado fluido, radio, ancho de contenido, foco y movimiento. Para layouts, usá `rem`, `clamp()`, grillas o flex con reflow y áreas seguras donde corresponda. Un borde de 1 px está bien. Compartí la composición cuando tenga el mismo significado a través de pantallas:

| Pieza | Usos y límites |
|---|---|
| Marca, shell y cabecera | Lockup de acceso, variante compacta y firma de equipo. Shell cliente, barra o admin comparten tokens y piezas, con navegación propia por rol. |
| Botón, botón de icono, enlace de retroceso | Variantes primaria, secundaria, neutral, éxito y peligro; estados hover, foco, cargando y deshabilitado. Etiqueta accesible en iconos. |
| Campo, hoja/modal, buscador y selector segmentado | Formulario correo/equipo, recuperación, filtros, tabs de barra, período de admin y apariencia. Shared focus/keyboard. Un tab de navegación no se transforma en botón de acción. |
| Estado, tarjeta, media y carga | Badge o texto semántico con etiqueta, portada, logo/avatar, fallback, skeleton, sin resultados y error visibles. Usá tarjeta de local compartida como composición si las variantes y la jerarquía lo permiten. |
| Productos, pedidos y retiro | Foto con fallback, nombre y precio, stepper, resumen, línea de tiempo y diálogo de retiro. Conservá componentes de dominio separados cuando cambien las interacciones entre cliente y barra. |
| Picker y métricas | Selector de fecha, subida de imagen, tiles y gráfico con estado vacío y unidades. Adaptá el control nativo donde sea conveniente. |

No uses una megatarjeta llenándola de condicionales por rol. Los componentes de UI presentan datos y emiten acciones. Los dominios de pedidos, barra, acceso y administración conservan sus propias reglas y un solo punto servidor para cada transición. Extraé piezas con contratos claros y reuso comprobado en pantallas reales. Conservá código específico donde solo tiene un consumidor. Si existe catálogo de componentes, incorporá las variantes clave ahí. Si no, un fixture o ruta de prueba existente alcanza; no hace falta introducir una dependencia solo para la auditoría.

## 2 · Matriz del audio y criterios de aceptación

Cada ID representa una fila del registro. La evidencia se toma con datos representativos y sin información personal real.

### Acceso y marca

| ID | Requisito que debe poder verse o probarse |
|---|---|
| A01 | En cliente y equipo, punto rojo distinguible junto a Onza, vasito rojo de marca con mejor presencia, proporciones balanceadas y cabeceras compactas con el mismo lockup. Conservar «Onza Equipo». Ajustar aire inferior según altura y safe area; verificar que los controles sigan visibles en pantalla baja. |
| A02 | `/acceso` y `/equipo/acceso` con video vertical en iPhone y horizontal en iPad vertical/horizontal y computadora. Un solo video por carga, tinte y degradados aprobados, loop a 0.75×, sin audio, `playsinline` y póster con autoplay bloqueado o movimiento reducido. No rehacer los assets aprobados que ya funcionan. |
| A03 | En cliente, mantener Google y Apple oscuros, de aspecto coherente, realmente deshabilitados y con «Próximamente». Correo funcional, enlaces legales y «¿Sos personal?». Revisar copy redundante; propuesta corta para cliente: «Pedí tu ronda. Retirá en la barra.» Aplicar vidrio esmerilado a los campos de cliente y equipo, con labels, foco visible y lectura clara. |
| A04 | «Continuar con correo» → correo, contraseña, recuperación y «¿No tenés cuenta? Creá una». Alta con nombre, teléfono y fecha de nacimiento en el punto apropiado del perfil, conservando autofill, gestores de contraseñas, validación de edad, perfil privado, confirmación de correo cuando corresponda y retorno al destino/carrito. Preferencia de trago opcional y salteable. Los clientes existentes conservan acceso a pedidos. |

### Cliente · Explorar, menú, compra y cuenta

| ID | Requisito que debe poder verse o probarse |
|---|---|
| C01 | Ubicación con estados distintos para obteniendo, no disponible, permiso denegado y listo, sin repetir «Sin ubicación». Buscar por local, barrio o ciudad. Sugerencias debajo del campo sin hacer desaparecer tarjetas mientras escribe; filtrar al seleccionar o confirmar. Foco y Escape funcionan. Ordenar por cercanía solo con coordenadas utilizables; respetar enlaces directos al local. |
| C02 | Tarjetas altas y fotográficas. Logo real del local más grande a la izquierda y barrio/ciudad abajo a la derecha. Badge verde «Abierto» con horario debajo en formato «Hasta las 11:00 p.m.»; quitar el encabezado «Abiertos» duplicado. Agrupar cerrados al final, atenuarlos y no permitir entrar desde la tarjeta; el encabezado del grupo da la señal textual. Pausado se distingue. Enlace directo a cerrado explica el estado y bloquea compra. Usar fotos/logos propios o con uso permitido; usar fallback útil donde falten. |
| C03 | Menú con foto cuadrada que muestra el trago, superficie más oscura debajo, nombre, descripción corta, precio y Agregar a la derecha. Reflow antes de apretar el contenido. Tap en foto o nombre abre detalle con descripción, tamaño y alérgenos disponibles. Agregar pasa a papelera/1/+ y luego −/cantidad/+; el stepper no navega. Agotado reconocible y bloqueado para agregar. |
| C04 | El dock del local es el acceso principal al carrito; eliminar acceso duplicado en la cabecera donde esté el dock. En carrito, flecha superior «Volver al menú». Quitar los controles fijos «Vaciar carrito» y «Revisar precios». Quitar bebidas con stepper. Persistencia al salir/volver al mismo local y aislamiento por cuenta/local. Al cambiar de local, explicar si hay que conservar o reemplazar carrito. |
| C05 | Checkout conserva total, productos, punto de retiro y nota de cancelación previa a aceptación. Sacar chips de demo repetidos y el texto general de menús/precios/horarios de demostración en entorno controlado. Mientras se use mock, dejar una nota corta «Sin cobro real» en checkout. Mantener una explicación veraz de importes simulados donde el admin pueda confundirlos con ventas reales. |
| C06 | Durante el envío aparece el vasito blanco que se llena con líquido rojo. En seguimiento, número de pedido, productos, precio, total, texto de cancelación claro y actualización por icono con etiqueta accesible. Mantener Realtime y los estados «Recibido», «Preparando», «Listo para retirar» y «Entregado». Pulso suave del punto activo; aviso visual siempre, sonido y vibración opcionales solo si se admiten. Pantalla o icono estático con movimiento reducido. |
| C07 | En listo para retirar, QR protagonista, lugar de retiro, candado/etiqueta «Código privado» y código fácil de copiar; no mezclarlo con el número público ni llenar la pantalla de advertencias repetidas. «¡Disfrutá!» una vez tras confirmar entrega física, con una mano levantando el shot y alternativa estática. CTA «Volver al menú» del mismo local, o Explorar si no está disponible. Historial no vuelve a disparar la animación. |
| C08 | Pedidos activos arriba e historial agrupado por noche operativa, con corte 06:00 de Costa Rica. Mostrar foto cuadrada del primer trago, número, local, estado, total y «+N más» si corresponde. Los precios y nombres históricos permanecen aunque se archive el producto. |
| C09 | Cuenta editable con avatar, nombre y @usuario. Correo separado en el perfil; cambiar, previsualizar y quitar avatar con iniciales de respaldo. Indicador visual animado entre Sistema/Claro/Oscuro, preservar Avisos y Privacidad, y «Cerrar sesión» con acento rojo suave. Sin métricas públicas de consumo en esta versión. |

### Pedidos y consistencia

| ID | Requisito que debe poder verse o probarse |
|---|---|
| O01 | Un pedido vencido, cancelado, entregado o con autorización fallida no bloquea indefinidamente un cupo. Reconciliar expiración y reservas en servidor conforme a las reglas vigentes, incluidas operaciones financieras inciertas. Si queda un pedido realmente activo, decir en qué local y ofrecer «Ver pedido activo». |
| O02 | Cinco minutos desde que se recibe el pedido en la cola del servidor. Hora de recepción y contador `mm:ss`, vencimiento visible y persistente al recargar. Elegibilidad a 4:59 y expiración a partir de 5:00 según el servidor. Aceptar, cancelar y vencer se resuelven en una sola transición válida. Mantener plazos de retiro independientes. |
| O03 | Precio, stock, estado del local y capacidad se revalidan al confirmar. Si cambió algo, identificarlo y conservar el carrito. Agotar/activar es distinto de archivar. Agotado sigue visible en Admin, y reactivar vuelve a mostrarlo donde se vende. Restaurar recupera para administración y exige habilitarlo para venta. Rollback visible si el servidor rechaza el cambio. |
| O04 | Cliente, barra y admin leen estados coherentes tras recarga y reconexión. Reintento de una operación con la misma identidad no duplica pedido, reserva, cobro mock ni entrega. El sistema registra las transiciones confirmadas y distingue sus actores. |

### Personal · selector, barra y retiro

| ID | Requisito que debe poder verse o probarse |
|---|---|
| T01 | Un local autorizado abre directo por rol después de validar cuenta y membresía. Cero muestra acceso pendiente. Varios muestran «Tus locales» con portada/logo o fallback y estado legible. Conservá destino directo autorizado y «Cambiar de local» cuando corresponda. Para admin, **Administrar** es principal y «Abrir barra» secundaria. Para bartender, solo «Abrir barra». |
| T02 | **Caso de la captura 11:33.** Nombre, rol y estado van en el bloque superior. En móvil, las acciones van debajo; pueden ocupar dos columnas si caben con etiquetas completas, o apilarse. En escritorio pueden ir al lado si hay espacio. A 320, 360 y 390 CSS px, probar Apotecario y un nombre largo como Wilk Craft Beer con Abierto, Pausado y Cerrado. Ningún rectángulo de acción intersecta el badge, ningún texto se recorta y la página no hace scroll horizontal. A 1440 el orden visual y la prioridad siguen claros. Probar ambos roles. |
| T03 | Barra operable con una mano: tabs Nuevos/Preparando/Listos con indicador animado y contadores, «Cerrados hoy» plegable y tarjetas con cantidades y miniaturas de tragos si existen. Hora de entrada y segundos restantes en nuevos. Aceptar verde, rechazar secundario con motivo, marcar listo y validar retiro visibles según el estado. Ajustes accesibles desde un icono etiquetado, con sonido, salir y control de recepción para roles ya autorizados. Pausar conserva pedidos existentes. |
| T04 | «Validar retiro» abre cámara primero desde el gesto del operador. «Ingresar código» visible como alternativa; ante permiso denegado o lector no disponible, pasar a manual con contexto intacto. Detener cámara al cerrar o validar. Mostrar código agrupado de cuatro en cuatro en la vista bartender; aceptar espacios o guiones y normalizar al formato ya establecido en el servidor. Mensaje claro de código incorrecto. |
| T05 | Escanear o introducir código → resumen de importe y productos → confirmar cobro simulado → confirmar entrega física completa. Antes de capturar hay retroceso. Mostrar la confirmación física explícita «Entregué físicamente el pedido completo». Durante cobro/entrega, no mostrar «Validar otro código». Si se interrumpe, reconciliar y retomar lo que falta. La confirmación verde de entrega devuelve al operador a la cola y habilita el cierre del cliente. |

### Administración móvil

| ID | Requisito que debe poder verse o probarse |
|---|---|
| D01 | En teléfono, fila de tabs fija arriba que puede desplazarse dentro de su propio contenedor, mantiene la selección visible y se puede enlazar directamente y no desplaza toda la página. Llegar a Resumen, Pedidos, Menú, Disponibilidad, Negocio y Equipo por dedo y teclado. Admin entra primero a su panel, con barra como acción secundaria. |
| D02 | Menú conserva alta/edición de nombre, descripción, foto y disponibilidad. Sección Archivados con restaurar. Disponibilidad muestra abierto/pausado/cerrado, capacidad editable y «Agotados ahora» con acceso a gestionar producto. Negocio tiene controles separados para portada y logo con vista previa, recorte, reemplazo/quitar y errores. La previsualización usa la misma tarjeta de Explorar y cabecera. Equipo conserva nombre, correo de trabajo, rol y permisos existentes. |
| D03 | Selector accesible estilo iOS para Día/Semana/Mes/Año y período claro, con corte operativo de Costa Rica. En «Pedidos», Activos (N)/Todos arriba a la derecha en escritorio y accesible en móvil. Mostrar pendientes e incidencias sin mezclar estados operativos y financieros. |
| D04 | Resumen compuesto por tarjetas de datos, con conteos de pedidos y entregados, reserva separada, ventas netas y tiempos de preparación. Gráfico de pedidos y ventas netas por hora para una noche y por intervalos adecuados en períodos mayores. Indicar picos de demanda. Si no hay hora de inicio de evento registrada, usar inicio operativo. Desglose de producto/unidades/monto en un panel o detalle. Ventas netas cuentan capturas y devoluciones confirmadas del período, no reservas. Probar medianoche, 06:00, devoluciones y períodos vacíos. |

### Capacidad, abuso y automatización

| ID | Requisito que debe poder verse o probarse |
|---|---|
| P01 | Límite de cancelaciones configurable y en observación o apagado por defecto: piloto de 3 cancelaciones confirmadas por cliente en 10 min → pausa de 5 min para nuevos pedidos, con hora de retorno. Excluir rechazos de barra, expiraciones, reintentos y cancelaciones técnicas. El cliente conserva el carrito y puede consultar, cancelar cuando corresponda y retirar pedidos existentes. |
| P02 | Al llenarse la barra, ofrecer lista de espera persistente con estado claro y posibilidad de salir. Un lugar por cuenta/local, asignación en orden, cupo temporal exclusivo y vencimiento. Representar una espera con animación discreta, sin ETA inventado. Usar parámetros del plan como defaults configurables: 2 min para confirmar y 10 min de espera, con opción de reintentar al vencer. |
| P03 | En espera todavía no hay pedido ni reserva de dinero. Confirmar cupo vuelve a validar stock, precio y estado del local, y consume capacidad una sola vez. Pausa/cierre suspende ofertas nuevas. Dos clientes no pueden ocupar el último lugar simultáneamente. Probar recarga, expiración, artículo agotado y reintento de confirmación. |
| P04 | Aceptación automática apagada por defecto, por local, con salida inmediata a manual. Admin configura el máximo en preparación, separado del límite total de admisión. Misma transición de servidor que aceptación manual. Verificar vigencia, recepción, autorización, stock y cupo de preparación. Los casos dudosos permanecen manuales con motivo. Registrar eventos y tiempos de espera/preparación. El proceso funciona aunque la barra cierre su navegador. Las sugerencias de intervalos dependen de medir el piloto y se quedan fuera del cálculo automático actual. |

## 3 · Definición de terminado por pantalla y por lógica

1. **Fijá el caso antes de corregir.** Para cada pantalla, anotá ruta, rol, vista, estado del dato, referencia y qué falla. Para bugs de lógica, escribí o encontrá la prueba que reproduce el fallo y verificá que falla por el motivo esperado. Para cambios cosméticos chicos alcanza la comparación visual. Para «Tus locales», fijá una comprobación de reflow en el fixture o E2E existente si el repo ya puede correrla.
2. **Capturá antes y después con el mismo estado.** Mínimo por pantalla cambiada: 390 CSS px y escritorio. Agregá 320/360 para layouts densos, iPad vertical/horizontal para acceso y verificación de claro/oscuro donde existan ambos temas. Fijá datos, hora cuando afecte y fotograma o póster de video para la comparación estática. Dejá al menos una prueba de video y de animación funcionando por separado. Incluí datos largos, loading/error/empty y otros estados que cambien la composición en los flujos tocados. Revisá foco, labels, contraste, tacto y zoom/reflow. El scroll de una fila de tabs está permitido; el de toda la pantalla no.
3. **Abrí e inspeccioná las capturas.** Mirá ambos archivos de imagen renderizados y comparalos contra referencia y requisitos. Anotá lo que todavía se ve mal, corregilo y volvé a capturar. En «Tus locales» revisá primero jerarquía y colisión a 390 px, y luego casos estrechos. No generés snapshots de referencia para aprobar un resultado defectuoso. Si no podés abrir imágenes ni usar navegador, marcá la parte visual como bloqueada y seguí con lo comprobable.
4. **Ejercitá el recorrido real en sesiones separadas.** Cliente inicia sesión y conserva destino → explora → compra con mock → bartender acepta → marca listo → cliente muestra QR → bartender valida y completa → cliente ve cierre y vuelve al menú. Repetí con código manual y permiso denegado. Con otra sesión, admin cambia stock y verifica vista de cliente. Probá transición concurrente con pruebas controladas de servidor, duplicación, aislamiento por local y que un rol no autorizado sea rechazado. Corré lint, tipos, pruebas relevantes y build según los comandos reales del repo. Distinguí unidad, integración, navegador, emulación y dispositivo físico.
5. **Revisá tu propio diff con ojos de revisor.** Contrastá cada ID con lo que se hizo, incluido acceso, estados fallidos y ramas de roles. Revisá que las pantallas consuman los componentes compartidos, que las excepciones sean intencionales y que el código se entienda sin leer el chat. Si hay cuotas, guardá progreso con evidencia y próximos pasos. Marcá «verificado» solo después de mirar el resultado, y registrá las comprobaciones físicas pendientes.

## 4 · Rendimiento y backend con evidencia

| Área | Trabajo esperado |
|---|---|
| Frontend | Identificar duplicación de CSS y componentes, dependencias redundantes o pesadas y JavaScript cliente evitable en rutas tocadas. Usar la arquitectura existente y acotar scripts interactivos a lo que los necesita. Cargar cámara, gráficos y animaciones pesadas en el momento adecuado; respetar movimiento reducido y mantener el layout estable. Consolidar helpers de precio, estado y fecha cuando tienen reglas compartidas. |
| Assets | Medir peso, dimensiones, referencias y red en login iPhone/iPad/compu. Confirmar que cada variante baja solo su MP4. Reutilizar los comprimidos integrados, poster y el comportamiento aprobado. Dar tamaños a fotos, usar formato y tamaño adecuados a tarjeta/thumbnail y diferir lo que queda fuera de vista. Verificar que el aligeramiento no cambie el recorte ni contraste. |
| Servidor y datos | Revisar las rutas de consulta de menú, pedidos, barra y reportes para evitar consultas por fila, lecturas innecesarias y cálculos masivos sin filtro de local/fecha. Verificar permisos y pertenencia del lado servidor, claves idempotentes y transiciones de inventario/capacidad con una sola autoridad. Abrir una migración aditiva solo cuando la necesidad esté demostrada; probar índices y consultas con datos de prueba y mediciones antes/después. |
| Resultados | Hacer build de producción local o medición equivalente con el mismo fixture y condiciones. Comparar al menos tamaño de video/transferencias, solicitudes relevantes, JavaScript de rutas tocadas si hay datos confiables y una consulta crítica del flujo. Documentar comandos, entorno y cifras. Si no aparece un cuello de botella, evitar refactor amplio. Separar medición local de resultados en producción. |

Estándar de mantenimiento: nombres que expresen el dominio, funciones pequeñas donde tengan una responsabilidad clara, tipos y validaciones en los límites, comentarios para invariantes que no son obvias, interfaces de UI predecibles y datos sin copiar entre capas por conveniencia. No agregar dependencias o un framework nuevo sin una necesidad medida o un requisito concreto.

## 5 · Limpieza completa del folder, sin perder producción ni referencias

Inventariá primero la raíz, cada worktree de Onza, public/static, docs, scripts, media y archivos grandes. Clasificá antes de tocar cada candidato. Comprobá referencias en imports, rutas de assets, loaders dinámicos, config, despliegue, scripts y tests. Al terminar, la ubicación canónica de los archivos queda documentada una sola vez.

| Clase | Qué queda en el repo | Qué se retira de la carpeta de desarrollo |
|---|---|---|
| Producción | Código, migraciones, pruebas, lockfile, config, fuentes/logos, MP4 y póster optimizados que realmente usan ambos accesos. Manifiesto breve de cuál se carga en iPhone, iPad y escritorio. | Copias y formatos que se demuestre que no usa el runtime, scripts ni tests. |
| Referencias y archivos fuente | Spec, plan, checklist y documentación vigente. Cualquier referencia de diseño que tenga un uso operativo documentado. | Originales MP4 de grabación, HTML de mockups, fotos/procesos de Bozu, ZIP, audio/transcripción y capturas privadas sueltas. Después de consultarlos, movelos a una carpeta local de archivo fuera del repo, con lista de rutas originales. No los subás al repo. Si siguen siendo el único insumo para cerrar un punto, guardá su ruta en notas locales. |
| Generados | Solo reglas de ignore genéricas necesarias. `.env.example` sin secretos, si el proyecto lo usa; preservá los `.env*` locales que sirven al desarrollo. | Outputs regenerables obvios, caches obsoletos y duplicados exactos confirmados. Quitalos solo cuando el build o test que los usa haya terminado. Artefactos de revisión quedan fuera del commit y fuera de la raíz de trabajo. |
| Dudosos o irreemplazables | Conservar mientras se averigua quién los usa. | Si son de referencia, archivarlos de forma reversible. Si no hay evidencia suficiente, anotar por qué quedan. |

Para media y archivos grandes, verificá contenido y referencias, no solo extensión o nombre. Archivar es mover con destino y manifiesto, conservando el archivo verificable. Borrá definitivamente solo basura regenerable o copias exactas confirmadas de las que queda un ejemplar. Conservá trabajo ajeno y archivos de usuario. No hagás `git clean -fdx`. Hacé un commit de higiene separado para los archivos versionados y reportá en el manifiesto local qué conservaste, qué archivaste y qué eliminaste, con tamaños antes/después. Los secretos y rutas privadas del usuario quedan fuera del informe versionado.

## 6 · Entrega de Claude

- Rama y SHA base identificados, commits locales listos para revisión y estado real por ID en la matriz. Para un pendiente, indicar bloqueo reproducible, requisito afectado y el paso que libera el trabajo.
- Carpeta de revisión local con capturas antes/después que abriste, condiciones de captura y recorridos por rol. Empezá el resumen por «Tus locales» y una captura móvil final.
- Cambios funcionales y de UI, componentes compartidos y consumidores, resultados de rendimiento con condiciones, y manifiesto de limpieza. Adjuntá cómo levantar la app y probar los recorridos, con migraciones locales, flags de piloto y pruebas físicas pendientes.
- Hacé `git diff --check`, inspeccioná el diff final contra la base y repetí las pruebas que cubren lo que quedó en la rama. La decisión de publicar el Preview se toma con esta entrega en la mano.

## Referencias de método

- [Claude Code · Best practices](https://code.claude.com/docs/en/best-practices): dar al agente controles que pueda ejecutar, revisar contra requisitos y mantener instrucciones concretas.
- [Anthropic Engineering · Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices): implementar, capturar, comparar, iterar y hacer commits revisables.
- [Addy Osmani · My LLM coding workflow](https://addyosmani.com/blog/ai-coding-workflow/): especificación antes de editar y entregas pequeñas que se pueden revisar de forma independiente.
- [Mitchell Hashimoto · My AI Adoption Journey](https://mitchellh.com/writing/my-ai-adoption-journey): convertir fallos repetidos del agente en instrucciones o verificaciones reutilizables.
- [Simon Willison · Agentic manual testing](https://simonwillison.net/guides/agentic-engineering-patterns/agentic-manual-testing/) y [Red/green TDD](https://simonwillison.net/guides/agentic-engineering-patterns/red-green-tdd/): probar con el producto corriendo más allá de la suite; reproducir fallos antes de corregirlos.
- [GOV.UK Design System · Contribution criteria](https://design-system.service.gov.uk/community/contribution-criteria/): usar componentes útiles, consistentes, adaptables y probados en los contextos donde se usan.
- [Playwright · Visual comparisons](https://playwright.dev/docs/test-snapshots) y [Best Practices](https://playwright.dev/docs/best-practices): comparar con las mismas condiciones de renderizado y probar comportamiento visible.
- [W3C · Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) y [Next.js · Production checklist](https://nextjs.org/docs/app/guides/production-checklist): usar anchos estrechos como caso real y medir cada optimización en la app.
