# Juego, economía y social de ONZA

Estado: migraciones **028–032 aplicadas en `onza-dev`** (D-2026-11-27-09). Los visuales son **provisionales**: los diseños definitivos entran por CSV sin tocar la lógica.

## Tres sistemas independientes

Cada uno tiene saldo, libro y reglas propias. Ninguno se convierte en otro.

| Sistema | Qué es | Libro | Quién lo financia |
| --- | --- | --- | --- |
| **Cashback** (028) | Puntos con valor monetario: 1 punto = ₡1. Canje parcial o total en compras futuras (el canje en checkout **no está hecho**) | `private.loyalty_ledger` (append-only) | Cada local (o patrocinador / ONZA) |
| **Avatar Coins** (029) | Moneda virtual solo para artículos digitales. No convertible a efectivo ni a cashback | `private.coin_ledger` + `coin_balances` | ONZA (se ganan o se compran) |
| **XP** (029) | Experiencia para niveles, logros y rankings. Sin valor monetario | `private.xp_ledger` + `xp_totals` | — |

Todos los libros son append-only (un trigger bloquea `update` y `delete`), con saldo posterior y clave de idempotencia por persona.

## Cómo se gana (todo al ENTREGAR el pedido, no al pagarlo)

- **Pedido entregado** → monedas (`floor(importe / ₡por moneda)`, con tope de importe) y XP. Es también la **visita verificada** que desbloquea el bar.
- **Eventos**: primera visita a un bar, check-in, amistad aceptada, historia publicada, trago enviado/recibido (reglas editables, con tope diario).
- **Logros** (métricas: pedidos, bares, check-ins, amistades, historias, nivel) → monedas, XP y, opcionalmente, un artículo exclusivo.
- **Campañas** de ONZA con multiplicadores de monedas y XP.
- **Reembolso** del pedido → se revierten monedas y XP (hasta donde alcance el saldo; si no alcanza, queda una señal de revisión).

### Anti-exceso de alcohol

Valores por defecto en `economy_settings`, editables por ONZA: máximo **2 pedidos premiados por día**, **90 min** entre pedidos premiados, tope de importe que cuenta (₡20.000), tope diario de **40 monedas** y **100 XP**. Cuando se limita, queda una señal en `economy_flags` (visible en el panel). Los premios nunca dependen de la cantidad de tragos.

## Compra de paquetes de monedas (dinero real)

- Apagada por defecto (`coin_purchases_enabled=false`) y sin paquetes cargados.
- La compra nace `pending`; **solo la ruta de servidor** (`service_role`) la liquida (`coins_purchase_settle`), nunca el navegador.
- Hoy solo con pago **simulado**: `assertMockPayments()` exige `PAYMENT_PROVIDER=mock`, `REAL_PAYMENTS_ENABLED=false` y `DEMO_MODE=true`. `BacPaymentProvider` sigue fallando como no configurado. **No hay cobro real** hasta contar con el manual y el acuerdo de BAC (PEN-006).

## Avatar, tienda y catálogo

- 12 ranuras (sombrero, lentes, peinado, camisa, chaqueta, pantalón, zapatos, accesorio, expresión, animación, fondo, efecto): un artículo por ranura. `compat.bodies` limita por cuerpo y `compat.conflicts` quita otras ranuras.
- Artículos: `sku` único, nombre, categoría, precio en monedas, rareza, estado (`draft|active|retired`), temporada, exclusivo, nivel mínimo, ventana de venta, `compat`, `asset_ref` y `preview_ref` (ruta relativa o URL https). No se borran: se retiran.
- Comprar gasta monedas de forma atómica con el alta en el inventario; sin saldo, nivel o disponibilidad, falla. Los exclusivos no se venden (se otorgan por logro o por ONZA).
- Hay 13 artículos **provisionales** (`prov_*`). Se reemplazan por CSV con el mismo `sku`.

### Importador CSV (`/onza/catalogo`)

Columnas: `sku,name,category,price_coins,rarity,status,season,exclusive,min_level,available_from,available_until,compat,asset_ref,preview_ref,sort` (hay plantilla descargable). Acepta `,` o `;`, BOM y comillas.

1. **Vista previa**: se valida todo en una transacción de prueba (nada se escribe) y se muestra qué se crea, qué se actualiza y qué campos cambian, con los errores por línea.
2. **Aplicar**: crea y actualiza por `sku`; las filas con error se omiten y quedan en el historial.
3. Una **columna ausente conserva el valor actual**; una celda vacía borra solo los opcionales (temporada, fechas, referencias).
4. El `id` es estable: **las compras, el inventario y lo equipado se conservan**. No se puede cambiar la categoría de un artículo existente.

Los archivos gráficos se suben aparte: carpeta pública de la app (`public/avatars/…`), Storage de Supabase o un CDN. Para un CDN, agregar su origen a `AVATAR_ASSET_ORIGINS` (se aplica al compilar) para que el CSP lo permita.

## Social

| Función | Regla de privacidad |
| --- | --- |
| Ranking entre amigos | Solo amistades aceptadas entre sí |
| Ranking por bar | Solo quien activó «Aparecer en el ranking» (apagado por defecto); por visitas verificadas |
| Mapa de bares | Un bar se desbloquea con un pedido entregado ahí; los bloqueados no muestran el nombre |
| Quién está en el bar | Check-in activo + «compartir» encendido (027) + privacidad del avatar (`friends` por defecto, `everyone`, `nobody`). El total solo se muestra con 5 o más personas |
| Drink Stories | Bucket privado, 24 h, fotos/videos, etiqueta de bar y producto (enlace al menú), 3 reportes las ocultan, moderación de ONZA, solo adultos |
| Enviar un trago | **Apagado.** Modelo y reglas listos (solo amistades, ambas partes adultas, local habilitado, código de entrega), pero sin pago ni pedido |

### Enviar un trago: lo que falta

`gift_propose` deja el regalo en `awaiting_payment`. Cobrarle al remitente y crear el pedido exige tocar `onza_command` (montos y estados de pedido), que `AGENTS.md` reserva a una etapa autorizada con pruebas de concurrencia. Por eso `economy_settings.social_gifts_available` está en `false` y la interfaz no lo ofrece. Pasos pendientes: (1) diseño del pedido regalado y de su retiro por el destinatario, (2) `gift_mark_paid` desde el servidor tras el cobro, (3) activar la bandera y la interfaz.

## Seguridad

- Sin permisos directos de `anon`/`authenticated` sobre ninguna tabla nueva; todo pasa por funciones `security definer` que validan cuenta, rol, edad y saldo.
- Las funciones internas (`private.*`) no son ejecutables desde el cliente (excepto los predicados de RLS).
- **Los triggers de economía nunca bloquean un pedido**: ante un error dejan una señal `trigger_error` y el pedido sigue. (El cashback sí es transaccional con el cobro, por diseño: ver `docs/loyalty.md`.)
- Cuentas laborales y de equipo no participan; invitados tampoco.

## Pantallas

- Cliente: `/juego` (resumen), `/avatar`, `/tienda`, `/ranking`, `/bares`, `/historias`, y «Quién está acá» en la página de cada bar.
- Local: pestaña «Fidelización y social» del administrador.
- ONZA: `/onza/economia`, `/onza/catalogo`, `/onza/moderacion`.
