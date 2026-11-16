# Onza · verificación del hito de funcionamiento y UI

2026-11-16 · rama `fix/hosted-integration` · base `506e3bf`. Código revisado sobre el checkout actual, sin repetir la auditoría completa. El hash publicado y el Preview se registran al cierre en DIARIO.md.

## Entorno y alcance

- Supabase CLI confirmó `onza-dev`, ref `ukdjuubekpanizcmppod`, organización Onza, ACTIVE_HEALTHY. URL local coincide. PAYMENT_PROVIDER=mock, REAL_PAYMENTS_ENABLED=false y DEMO_MODE=true. Sin banco real, base alternativa, reset ni cambios de claves.
- El dry-run inicial estaba actualizado: 005–007 ya se habían aplicado, aunque el diario indicaba lo contrario. Había 12 imágenes de productos y ninguna portada. Se conservaron esos datos y se aplicaron únicamente 008/009, revisadas y aditivas. No se editaron migraciones aplicadas.
- Dos sesiones reales reprodujeron el retiro por número público antes de corregirlo. Después se probó cliente, dos sesiones independientes de barra del mismo usuario, otro local y admin. Los pagos viven en el ledger mock de PostgreSQL existente.

## Resultados por recorrido

| Recorrido | Evidencia y resultado |
| --- | --- |
| Añadir/quitar/vaciar/refrescar/cambiar local | Navegador contra catálogo real: cantidad inline, última unidad y línea eliminables, confirmación de vaciado, storage borrado al refrescar. Conservar/reemplazar no mezcla locales. Dock solo en menú/detalle dueño; acceso discreto desde Explorar/otro local. |
| Abierto/cerrado/pausado | Cerrados al final y sin enlace/CTA; URL directa no ofrece compra. Pausa diferenciada. POST real rechazado por cerrado y pausado, restaurando el ajuste de pausa. |
| Ubicación | Catálogo real sin coordenadas; se verificó fallback manual. Permiso aceptado/denegado, timeout e imprecisión con API de navegador **emulada**. Orden/distancia probados con fixtures unitarias, sin presentar sus coordenadas como reales. Sin mapas, proveedores o persistencia/transmisión de posición del cliente. |
| Cliente → aceptar → preparando → listo | Auth real, creación desde checkout, actualización por WebSocket y persistencia tras refrescar. Un snapshot de preparando se retuvo mientras llegó ready por Realtime; el refetch pendiente recuperó el estado correcto, sin polling conectado. |
| Cancelar y carrera | Cancelación real antes de aceptar; rechazo con versión actual después de aceptar y ausencia del botón en preparación. Tres carreras HTTP reales: exactamente una transición exitosa por pedido. |
| Retiro | Código privado válido; número público, código incorrecto y otro local rechazados; segundo resolve devuelve ALREADY_DELIVERED. Staff ordinario no recibe QR/código/token/cifrado. QR generado y visible al cliente; navegador sin escáner conserva alternativa manual. **Cámara física no probada.** |
| Captura y recuperación | Timeout-after-success → consulta → captura confirmada. Replays paralelos no cambian monto ni crean una nueva entrega. Tras recargar barra se retoma el claim validado, sin precargar código, se confirma entrega física y complete repetido retorna la entrega previa. |
| Personal y aislamiento | Login por formulario real. 29 controles alojados: RLS, dueño/otro cliente, escritura directa, autoasignación de rol, local ajeno, admin propio, pausa/disponibilidad, coordenadas, Storage real, imagen guardada/restaurada y carpeta ajena denegada. Archivo de prueba eliminado. |
| Vencimiento quieto | Espera real de dos minutos con cliente conectado; pedido pasa a vencido mediante refresco puntual. En los primeros 31 segundos hubo como máximo tres lecturas iniciales, sin ciclo de polling. Sin cliente abierto ni tráfico sigue faltando scheduler durable. |

## Ticket y compatibilidad

El código anterior acoplaba toda la lectura del pedido a descifrar y generar QR: cualquier fallo rechazaba la respuesta completa. Ahora esas fallas preservan el pedido, permiten reintentar y conservan el código manual si está disponible. Las fallas de QR y descifrado se ejercitaron como pruebas controladas del servicio, **no** como una avería provocada en el despliegue real.

Lectura privada en memoria de tickets históricos: 19 cifrados válidos se reconstruyeron con la clave local existente; cuatro payloads históricos tenían formato malformado, ninguno activo; cero versiones diferentes y cero fallos de autenticación AES. Se guardaron solo conteos en `evidence/hosted-ux/ticket-compatibility.json`. No se rotó, sobrescribió o imprimió ninguna clave/ticket. No se demostró la causa exacta de la ausencia original reportada por el dueño; el error React/use histórico tampoco se reprodujo.

## Comprobaciones y evidencia

- `npm run check`: typecheck, lint, **74 pruebas / 24 archivos**, build; exit 0.
- Playwright: **11 casos únicos relevantes** en full-demo/pickup/hosted-ux, aprobados entre la ejecución general y reejecuciones específicas. La matriz de layout se corrigió para esperar hidratación/visibilidad antes de medir y pasó nuevamente. El vencimiento real se ejecutó por separado para no repetir la espera de dos minutos.
- Componentes: **7/7** pruebas de temas/foco y carrito/checkout, sin backend de reemplazo.
- `node --env-file=.env.local scripts/verify-hosted-security.mjs`: **29/29**, JSON actualizado en `evidence/hosted/security-checks.json`.
- Cliente: 7 rutas × 360/390/1440 px × claro/oscuro; 42 combinaciones sin overflow. Carrito lleno y último producto por encima del dock comprobados. Personal/admin: 12 combinaciones, cero overflow y errores de ejecución (`evidence/hosted-ux/staff-admin-layout.json`).
- Cinco PNG representativos en `evidence/hosted-ux/`, inspeccionados: Explorar 390 claro, menú 390 oscuro, menú 1440 claro, barra 1440 oscuro y ticket 390 oscuro **con QR/código redactados**. Sin video, ZIP, trazas de sesión o credenciales.
- Revisión independiente estática: se corrigieron pérdida de eventos durante fetch y vencimiento quieto; relectura final sin bloqueos, incluido el allowlist exacto de orígenes Preview.

Un servidor dev previo mezclaba HTML/JS de versiones distintas y produjo errores de hidratación; reiniciarlo en el mismo repo eliminó esa reproducción. No se atribuye eso al error histórico React/use ni se hicieron cambios especulativos de framework.

## Publicación y prueba manual

Git conectado al proyecto Vercel existente `onza-demo`; rama de producción `main`, creación automática de deployments deshabilitada. El push dispara los jobs existentes `checks` y `supabase-integration` (Supabase local descartable del CI). No se modifica esa configuración. Los alias actuales rechazaban POST por Origin; se conserva APP_ORIGIN y se permiten únicamente VERCEL_URL/VERCEL_BRANCH_URL exactos asignados por Vercel a este Preview. No hay wildcard de sitios Vercel ni ampliación en producción.

Tras el cierre: usar la URL del Preview registrada en DIARIO.md en el teléfono para cliente. En computadora, otro perfil → Ajustes → Personal → login con las credenciales existentes → barra del mismo local. Agregar, enviar, aceptar, marcar listo y presentar **el código privado del ticket**; el número público no sirve para retirar. Para probar captura pendiente, elegir la simulación de respuesta perdida, consultar el resultado y retomar la entrega sin recobrar.

Pendientes reales: prueba en Safari/iPhone y Android físicos (GPS, cámara, audio, foreground y safe areas), coordenadas reales configuradas por cada local, fotografías representativas con derechos y scheduler durable fuera de este alcance. Los locales demo son ficticios; no se inventaron ubicaciones para aparentar cercanía.


## Cierre HTTPS

Código `e1e8987` publicado en la rama solicitada. [CI del código aprobado](https://github.com/msalas0810/onza/actions/runs/43937917513), incluidos checks y supabase-integration. [Preview READY y probado](https://onza-demo-ml94rxfry-msalas0810s-projects.vercel.app): nueve controles reales cliente/barra, cero errores de ejecución. Evidencia: `evidence/hosted-ux/preview-verification.json` y `deployment-scope.json`; producción, settings y protección permanecen intactos.

El primer intento de target=staging fue rechazado automáticamente y no creó deployment; target=preview recibió 400 de la API. Se corrigió omitiendo target, que crea Preview según [documentación oficial de la API](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment). El deployment resultante tiene target=null y el SHA exacto revisado. No se eludió la protección ni se creó un entorno custom.
