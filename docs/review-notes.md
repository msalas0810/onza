# Revisión del MVP local

Revisión del mismo autor, por instrucción de trabajar con un solo agente. No equivale a revisión independiente ni aceptación integral del producto.

## Invariantes revisadas

- No service_role ni secretos bancarios en src; lecturas con sesión/RLS y RPC con verificación de actor/local. Un anónimo autenticado no adquiere membership.
- Montos enteros/snapshots; creación bloquea local y productos, capacidad atómica y clave vinculada a actor/payload. Permisos/valores/versiones también se validan en SQL para acceso directo al RPC.
- Operaciones financieras mock con ledger transaccional y clave única durable. Timeout no crea otra autorización/captura. Claim por sesión de Auth, no solo por UID. Complete exige captura y entrega física explícita.
- Código inválido consume rate limit durable; QR con hash de búsqueda y copia AES-GCM. Repetición de refund/complete devuelve resultado previo.
- Vencimiento ignora unknown y capturas/claims financieros. El barrido puede ejecutarse por un usuario autenticado y solo aplica reglas automáticas fijas de vencimiento; no concede lectura de pedidos ajenos.
- Catálogo y shell de servidor; islas interactivas para carrito, operación y cámara. Suscripciones filtradas con cleanup y refetch. Audio opt-in, eventos deduplicados; no se afirma aviso en segundo plano.
- Resumen no suma reservas como ventas; corte 06:00 Costa Rica y snapshots históricos. Staff otro local no consulta resumen ni pedido ajeno. Onza global exige permiso provisionado.

## Hallazgos corregidos con pruebas

- Campos null/omitidos al llamar directamente a RPC: validación SQL, no solo Zod.
- Rate limit que se revertía al lanzar error: resultados de intento inválido se confirman en DB antes de traducirlos a error HTTP.
- Captura rechazada con claim: cancelación supervisada segura y anulación de reserva.
- Autorización unknown sin referencia: conciliación supervisada de evidencia **simulada**, sin nuevo intento authorize.
- Refund repetido: mismo resultado y una sola operación durable.
- Seguimiento de pedidos fuera de los últimos 100: consulta directa por ID autorizada; listas acotadas con cursor backend y activos primero.
- ThemeControl conserva el valor mostrado después del refresco; objetivos táctiles excluyen herramientas internas de Next.
- CLI v3: email.enabled permanece true para no deshabilitar el login del staff; los permisos siguen en memberships. Fuentes en docs/github-vercel.md.

## Decisiones de implementación

El kit es la especificación aprobada por la orden de ejecución. No se repitió diseño ni se pidió aprobación entre etapas. Se construyó dentro de onza-starter preservando el kit en el commit inicial.

El adaptador mock se implementa como ledger SQL, para que reservar/capturar y guardar su resultado sea una sola transacción en esta simulación. La integración bancaria posterior debe seguir el contrato TypeScript y separar la operación durable de la llamada externa; este código no mantiene una transacción abierta esperando un banco ni pretende implementar BAC.

El endpoint compacto /api/commands valida una unión tipada y delega al servicio y funciones transaccionales; evita duplicar autorización por cada verbo. No es un protocolo bancario.

PGlite se usa solo como motor de pruebas. Auth y claims se simulan en ese harness y la ejecución se serializa en una conexión. La aplicación real requiere Supabase; no hay sustitución por PGlite, SQLite o localStorage para guardar pedidos.

## Carga inicial

La medición de producción encontró exceso de JavaScript en `/`. Se separaron las islas de descubrimiento/menú, se sustituyó el validador general del borrador por un parser pequeño probado y se cargó el diálogo al abrirlo. `/` bajó de 292432 a 188666 bytes gzip en el shell sin DB. El catálogo conectado permanece sin medir; checkout/login todavía cargan más de 200 KB. Ver docs/evidence.

## Pendientes de aceptación

Supabase Auth/Realtime/Storage, pgTAP, peticiones en conexiones concurrentes reales y pantallas operativas con datos reales del demo; ejecución de CI en GitHub; cámara/audio, VoiceOver y reconexión en iPhone/Android físicos. Fotos finales con derechos. Métricas de rendimiento con catálogo conectado y condiciones representativas. Los límites se detallan por etapa en implementation-status.md.

No se encontraron motivos para activar pagos reales; el adaptador BAC falla explícitamente. No se creó remoto, hizo push ni desplegó.
