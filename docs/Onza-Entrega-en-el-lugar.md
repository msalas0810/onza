# Entrega en el lugar (mesa, zona o puesto), flujo de Picnic y mejoras del administrador

Rama `feat/entrega-mesa-admin` · migración `202611260025_location_delivery.sql` · 2026-11-26.
Evidencia: `docs/evidence/entrega-lugar/` (capturas, `verificacion.json`, CSV de ejemplo). Guion: `scripts/verify-entrega-lugar.mjs`.

## 1 · Qué se revisó y qué se encontró

Referencia: repo `onza-referencia-pedidos` (solo lectura, `alopo30/pedidos-platform`). **Hallazgo importante:** su `main` **no tiene** nada de Picnic ni de entrega en el lugar. «Picnic» solo aparece como el nombre de una empresa creada en su staging. El recorrido que se pidió migrar vive en ramas sin fusionar; la más completa es `claude/map-in-settings` (55 commits por delante de `main`, contiene a las demás). Esa es la que se leyó. Nada de su código se copió: no tiene `LICENSE` y Onza es un repo público, así que todo se reimplementó con los componentes y el modelo de Onza.

### Qué hacía la referencia, según el código

| Paso | Cómo funcionaba | Estado |
| --- | --- | --- |
| Entrada | Directorio → `/locales/:slug` (iniciar sesión, registrarse o seguir como invitado) → `/m/:slug`. Los QR apuntaban directo a `/m/:slug` | Funciona |
| Menú y pedido | Menú público, carrito, cotización de servidor, checkout con total confirmado e idempotencia | Funciona |
| Dónde estoy | Modalidad «Consumir aquí» (`dine_in`) con texto libre «Mesa o ubicación (opcional)». Si el local tenía **mapa**, «Entregar donde estoy»: el cliente toca una foto/croquis y se guarda un punto (x, y) con la versión del mapa. **No hay mesas, zonas con nombre ni puestos**: el identificador es una coordenada | Funciona, pero el texto libre no se valida y el punto solo es útil si alguien lo mira en el mapa |
| Qué recibe el equipo | Pantalla «Entregas» (sondeo cada 5 s): pedidos listos, productos, «Ver en el plano» con el marcador | Funciona; el tablero principal no mostraba el lugar |
| Entrega | El cliente ve un código de 6 caracteres; el mesero lo escribe y el servidor lo valida (5 fallos bloquean 15 min). Un pedido con plano no puede cerrarse sin código | Funciona y es sólido |
| Quién configura | **Solo el superadministrador de la plataforma** (sube la imagen, dibuja zonas, publica). La empresa solo lee | Incompleto: el gerente no puede habilitarlo |
| QR por mesa o zona | No existe (su `ROADMAP` lo lista como «falta») | Faltaba |

### Qué hacía peor Onza, qué mejor

- **Mejor en Onza:** pagos y permisos más estrictos (reserva simulada, captura en la entrega, un retiro asignado a una sola sesión), tickets con QR y código privado, lista de espera, aceptación automática, resumen por noche operativa (06:00), cuentas obligatorias y matriz de permisos probada.
- **Mejor en la referencia:** entrega en el lugar, código de entrega, configuración multi-local, cierre de caja por CSV, alertas operativas y enlace/QR del local en el panel.
- **Peor en la referencia (no se trajo):** invitados con Turnstile, MFA, sondeo cada 5 s en vez de Realtime, imágenes de plano que solo sube la plataforma, orden/menú en un editor de texto pegado (útil, no esencial), inventario con reservas por unidad (cambiaría las reglas de stock de Onza).
- **No es lo mismo:** las `DeliveryZones` de la referencia son entrega **a domicilio** con tarifa y dirección, no entrega en el lugar. No se migraron.

## 2 · Qué se construyó en Onza

### Recorrido de Picnic (cliente → equipo → entrega)

1. **Entrada directa:** `/v/picnic` es el bar. El QR de cada mesa abre `/v/picnic?spot=<id>`: el cliente entra con su lugar ya elegido. Sin sesión pasa por `/acceso` y vuelve con el lugar (se corrigió el middleware: descartaba la query al redirigir).
2. **Menú y pedido:** el menú muestra «Te lo llevamos a Mesa 3 · Terraza» (o «Elegir mesa»). En el checkout, «Retirar en la barra» o «Llevarlo a mi mesa» y los lugares agrupados por zona. Reutiliza el checkout, el carrito, la reserva simulada y la idempotencia de siempre.
3. **Seguimiento:** «Entrega en Mesa 3 · Terraza» con **Cambiar** hasta la entrega. Al quedar listo: «Listo: te lo llevamos» con el mismo QR y código privado.
4. **Cola del equipo:** cada tarjeta dice **«Llevar a Mesa 7 · Jardín»** y avisa si el cliente cambió su lugar. «Listos» muestra **«Entregar en Mesa 7»** y la cabecera cuenta los listos para llevar. Chips «Todo / Barra / zona» para que cada persona atienda su zona.
5. **Entrega:** el equipo escanea el QR o escribe el código privado del cliente al llegar a su lugar; sigue cobro simulado → «Entregué el pedido completo en Mesa 7». Queda registrado **dónde, cuándo y quién**: la cola («Cerrados hoy»), el administrador, el CSV y el cliente («Entregado en Mesa 7 · Jardín a las 12:19»).

### Servidor (migración 025)

- Config por local o evento (un evento es un local con su enlace): `delivery_mode` = `bar` (por defecto: nada cambia), `both` o `location`, y `spot_noun` (Mesa, Zona, Puesto…).
- `delivery_spots`: lugares validados, no texto libre. Lectura pública solo de los habilitados (RLS). Sin escritura directa para nadie.
- `private.create_order` pasó a ser un envoltorio de la función de 019 (`create_order_base`, intacta): valida **antes de crear nada** que el lugar pertenezca al local y esté habilitado (`SPOT_INVALID`), que el local entregue en el lugar (`DELIVERY_UNAVAILABLE`) o exija elegirlo (`SPOT_REQUIRED`). Un reintento con la misma clave lo resuelve la base sin revalidar. El pedido guarda una copia del nombre del lugar: renombrar o deshabilitar no altera el historial. CHECK de base: lugar obligatorio y del mismo local.
- `order_change_spot`: solo el dueño, solo si el pedido no terminó, lugar válido; no cambia la versión del pedido (no genera conflictos al aceptar).
- Administración (solo admin del local, con registro en `platform_events`): `venue_delivery_config`, `venue_spot_save`, `venue_spot_bulk` (rangos «Mesa 1–20»), `venue_spot_delete` (solo si nunca se usó). No se puede activar la entrega sin lugares ni deshabilitar o borrar el último lugar con la entrega activa.
- `venue_orders_export`: solo admin, sin datos de quien pidió, tope de 93 días y 5 000 filas.
- Sin cambios: retiro en barra, QR y código privado, pagos mock, stock, aceptación, vencimiento, cancelación, permisos. `onza_command` no se reemplazó.

### Panel de administración (mejoras elegidas del admin de la referencia)

| Mejora | Qué ahorra | Backend |
| --- | --- | --- |
| **Entrega** (pestaña nueva): modo, palabra, lugares por zona, alta por rango, habilitar/editar/borrar, lista «Listo para operar» | Que el gerente lo configure solo (en la referencia dependía de la plataforma) | `venue_delivery_config`, `venue_spot_*` |
| **Enlace y QR** del local y de cada lugar + hoja imprimible (`/admin/<id>/qr`) | Imprimir los QR de las mesas | Solo direcciones públicas |
| **Ahora** en Resumen: pedidos esperando aceptación, listos sin entregar (y cuántos para llevar), incidencias de cobro, agotados, y **Reanudar pedidos** en un toque | Saber qué atender sin recorrer pestañas | Usa los pedidos en vivo que el panel ya recibe |
| **Exportar CSV** del período (cierre de caja) con estado, lugar, zona, horas, quién entregó y montos | Armar el cierre a mano | `venue_orders_export` + `/api/export` |
| Pedidos del administrador muestran el lugar y quién entregó | Soporte | — |

La referencia tiene además un tablero de inventario por unidad, clientes recurrentes, MFA, impuestos y editor de menú por texto. No se migraron: el inventario cambiaría las reglas de stock, los clientes tocan datos personales y MFA/impuestos no aplican a Onza hoy.

## 3 · Decisiones (con alternativas)

- **Lugares nombrados en vez de mapa con punto.** El mapa exige subir y mantener una imagen (en la referencia, la plataforma) y el punto no se valida contra nada que tenga nombre. Mesas, zonas o puestos nombrados se validan en servidor, se imprimen como QR y se leen de un vistazo en la cola. Un mapa podría sumarse después como otra forma de elegir el mismo lugar.
- **Confirmación con el QR/código privado de Onza, no un segundo código.** El cliente ya tiene un secreto por pedido; el equipo ya sabe validarlo; la reserva, la captura y la asignación del retiro a una sesión siguen intactas. Alternativa descartada: código de 6 caracteres propio de la referencia (duplicaría el secreto y sus contadores).
- **Pedido de lugar no se «retira»:** mismo flujo `resolve → capture → complete`; solo cambian los textos y se muestra el lugar.
- **Envoltorio de `create_order` en vez de copiarla otra vez:** evita una tercera copia de 60 líneas y respeta la regla de 021 (las reglas viven fuera de `onza_command`).
- **Un evento es un local.** No hay entidad evento: un puesto de festival es un local con su enlace, horario y lugares. Si más adelante hace falta agrupar locales, se diseña aparte.
- **El lugar recordado en el dispositivo dura 8 horas** y solo es una comodidad; el servidor valida al pedir.
- **Picnic en `seed.sql` es un demo ficticio** (menú y 12 lugares de ejemplo, modo «barra y lugar»). No son datos reales del local.

## 4 · Cómo probar Picnic paso a paso

Opción rápida, sin Docker (shim con las migraciones reales sobre PGlite; ver `docs/Onza-Guia-tecnica.md`):

```bash
node scripts/local-shim/index.mjs &    # :54321, datos limpios
# En otra terminal (variables como en la Guía técnica):
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-shim-publishable \
SUPABASE_SERVICE_ROLE_KEY=local-shim-service-role APP_ORIGIN=http://127.0.0.1:3100 DEMO_MODE=true \
PAYMENT_PROVIDER=mock REAL_PAYMENTS_ENABLED=false ACCOUNTS_REQUIRED=true \
PICKUP_TOKEN_ENCRYPTION_KEY=$(node -e 'process.stdout.write(Buffer.alloc(32,7).toString("base64"))') \
npx next dev --hostname 127.0.0.1 -p 3100
ONZA_APP=http://127.0.0.1:3100 node scripts/verify-entrega-lugar.mjs docs/evidence/entrega-lugar   # recorrido automático (reinicia el shim antes de repetirlo)
```

A mano (cualquier contraseña en el shim):

1. Cliente `maria@correo.demo`: abrí `http://127.0.0.1:3100/v/picnic?spot=50000000-0000-4000-8000-000000000003` (Mesa 3). Agregá un trago → **Carrito → Confirmar pedido**: elegí «Llevarlo a mi mesa» (Mesa 3 ya marcada) → **Pedir**.
2. En el seguimiento tocá **Cambiar** y elegí «Mesa 7».
3. Equipo `jorge@equipo.demo` (portal `/equipo/acceso`): **Picnic → Barra**. La tarjeta dice «Llevar a Mesa 7 · Jardín». **Aceptar → Marcar listo** y el botón pasa a «Entregar en Mesa 7».
4. En el teléfono del cliente aparece el ticket con QR y código. En la barra: **Entregar en Mesa 7 → Ingresar código** (o escanear) → Validar → Confirmar cobro simulado → «Entregué el pedido completo» → Confirmar entrega.
5. El cliente ve «Entregado en Mesa 7 · Jardín a las…». «Cerrados hoy» muestra lugar, hora y quién.
6. Administrador `ana@equipo.demo` → Admin de Picnic → **Entrega** (configurar, crear «Mesa 11–14», QR, imprimir), **Resumen** (Ahora, Exportar CSV).
7. Pedir en un local normal: `maria`/`sofia` en `/v/mil948` → checkout sin pregunta de lugar → barra → ticket «Retirá en Barra principal» → validar código.

## 5 · Qué se verificó y qué no

Verificado: `npm run check` (tipos, lint, pruebas, build); 15 pruebas de base nuevas (`tests/orders/location-delivery.test.ts`: permisos, lugar de otro local o deshabilitado, reintentos, cambio de lugar, recorrido completo, RLS, exportación), 7 de helpers/CSV, la matriz de permisos actualizada y el recorrido en navegador (43 comprobaciones, 360/390/1280 px).

No verificado: Supabase real (Auth, Realtime, Storage: el shim no los tiene; la cola refresca por consulta), Safari/iPhone y cámara real para escanear el QR a la mesa, carga con muchos lugares (300 es el tope), la migración sobre `onza-dev` ni sobre un proyecto aislado (no se aplicó nada remoto).

## 6 · Pendientes reales

1. Aplicar 013–025 en un proyecto aislado (`db push --dry-run` primero) y repetir el recorrido allí con Realtime real.
2. Probar el escaneo del QR a la mesa en Safari de iPhone y Android físicos.
3. Datos reales de Picnic (nombre exacto, menú, mesas/zonas, horario): el seed es ilustrativo.
4. Decidir si un evento necesita agrupar varios puestos (hoy cada puesto es un local).
5. Opcional: mapa/croquis como segunda forma de elegir el lugar; mostrar «por zona» en el resumen.
