# Mapa interactivo de ubicación y entrega

Módulo para que el cliente marque **dónde está** dentro del local (bar, restaurante, discoteca, festival) y el equipo le lleve el pedido. Usa el **plano propio de cada local o edición de evento**: sin GPS, sin Google Maps ni ningún servicio externo de mapas, y sin pedir ubicación al navegador. Es **opcional**: un local sin plano publicado sigue funcionando como siempre (retiro en la barra).

- Migraciones: `202611240025_venue_maps.sql` (modelo, funciones, vista del pedido) y `202611240026_venue_maps_storage.sql` (bucket de planos). **Aditivas y sin aplicar en remoto**: ver «Despliegue».
- Código: `src/features/maps/` (tipos, geometría, SVG/imagen, visor, selector, editor, vistas de equipo), `src/app/api/maps/route.ts`.
- No reemplaza nada del flujo de pedidos: `onza_command`, los estados, el cobro simulado y el retiro con QR/código no cambian.

## Cómo se usa

**Administración** (pestaña **Mapas**, solo administradores del local):

1. *Nuevo mapa*: permanente, o **edición de evento** (evento, sede y fecha).
2. Subir el plano (JPG, PNG, WebP o SVG seguro). Se optimiza en el navegador antes de subir.
3. Elegir una herramienta y **tocar el plano**: mesa, barra, entrada, escenario, punto de referencia, punto de entrega, zona (polígono) o rectángulo. No hay coordenadas que escribir; los marcadores y los vértices de las zonas se arrastran.
4. Cada zona tiene tipo (general o VIP) y **entrega**: normal, *solo en esta zona* o *sin entrega*; y se le puede **asignar personal**.
5. Cada mesa tiene un **QR** (enlace `/v/<local>?mesa=<id>`) para imprimir: quien lo escanea queda ubicado en esa mesa.
6. *Guardar borrador* (no afecta a los clientes) · *Probar como cliente* (el mismo selector, sin guardar nada) · *Publicar* (crea una versión nueva).
7. *Duplicar* copia imagen y plano como borrador nuevo (típico: la edición del año anterior). *Archivar/Restaurar*.

**Cliente** (checkout): «¿Dónde te entregamos?» → plano con zoom y desplazamiento táctil → tocar su lugar → marcador arrastrable → **«Estoy aquí»**. Si el local tiene mesas numeradas puede elegir la suya en una lista. Si llegó por el QR de una mesa, el checkout ya la trae resuelta y no obliga a abrir el plano. Desde «Mi pedido» puede **cambiarla o quitarla** mientras el pedido siga activo y nadie del equipo haya empezado la entrega.

**Equipo** (cola de barra): cada tarjeta muestra la zona o mesa («Marcado cerca de Mesa 2 · Zona VIP»), el personal asignado a esa zona y **«Ver ubicación»**: abre el plano de la versión exacta que usó el cliente, centrado y ampliado sobre su marcador, con los 3 puntos de referencia más cercanos, el estado del pedido y los botones de estado (aceptar, marcar listo, validar retiro).

### Entrega y código

El **código de confirmación** es el que ya existe: el QR o código privado de 12 caracteres del ticket del cliente. El equipo **no lo ve** (si lo viera, podría marcar entregas sin el cliente): el panel indica que hay que pedírselo al cliente y validarlo en «Validar retiro». Un pedido solo pasa a *entregado* después de `resolve` (QR/código válido → reclamo del retiro) → cobro simulado → «entregué físicamente» → `complete`; sin reclamo la base rechaza `capture` y `complete`. Esta regla ya estaba en `onza_command`; el módulo no la toca y la prueba (ver «Pruebas»).

## Coordenadas y modelo de datos

Todas las posiciones son **coordenadas normalizadas 0..1** sobre la imagen, origen arriba a la izquierda, independientes del tamaño de pantalla y de la resolución de la imagen. La vista vuelve a calcular dónde dibujarlas según el zoom y el desplazamiento.

| Tabla | Para qué |
| --- | --- |
| `venue_maps` | Un mapa por local (`permanent`) o por edición (`edition`: fecha + sede). Guarda el **borrador** (imagen, `draft_layout`, `draft_revision`). Estado `draft` · `published` · `archived`. |
| `venue_map_versions` | Versiones **publicadas e inmutables** (imagen, dimensiones, plano). Un trigger impide `update` y `delete`. |
| `order_locations` | Ubicación de un pedido: `map_id`, `map_version`, `x`, `y`, `delivery_method` (`location_on_map` · `table` · `table_qr`), zona, mesa y referencia más cercana (textos guardados al momento de marcar). Una fila por pedido. |
| `venue_map_zone_staff` | Personal asignado a una zona. Solo miembros del propio local (FK a `memberships`, con borrado en cascada). |
| `private.map_events` | Bitácora de auditoría: crear, publicar, archivar, duplicar, asignar, ubicar y quitar ubicación (actor, mapa, versión, pedido). |
| `orders.location_updated_at` | Cambia al marcar o corregir: dispara Realtime hacia la barra sin tocar `orders.version` (no genera conflictos con aceptar/listo). |

El plano de una versión es un `jsonb` validado en la base:

```json
{
  "elements": [{ "id": "mesa-3", "type": "table", "label": "Mesa 3", "x": 0.55, "y": 0.45 }],
  "zones": [{ "id": "vip", "name": "Zona VIP", "kind": "vip", "delivery": "default",
              "points": [{ "x": 0.62, "y": 0.58 }, { "x": 0.96, "y": 0.58 }, { "x": 0.96, "y": 0.94 }, { "x": 0.62, "y": 0.94 }] }]
}
```

Tipos de elemento: `table`, `bar`, `entrance`, `stage`, `poi`, `delivery_point`. Hasta 300 elementos y 60 zonas (3 a 40 vértices); claves ajenas, ids repetidos o coordenadas fuera de 0..1 se rechazan.

Lo que ve el cliente en la vista de su pedido (`order.location`) tiene la forma pedida:

```json
{ "order_id": "…", "map_id": "…", "map_version": 1, "location": { "x": 0.42, "y": 0.68 },
  "zone_id": "vip", "zone_name": "Zona VIP", "delivery_method": "location_on_map",
  "reference_label": "Mesa 7", "map_name": "Salón principal" }
```

### Reglas de entrega

La base **valida siempre** (el cliente repite las reglas solo para guiar al instante; una prueba exige que ambos decidan igual para 786 selecciones):

1. El punto debe estar dentro del plano (0 ≤ x, y ≤ 1; números reales).
2. No puede caer en una zona `restrict`.
3. Si el plano tiene alguna zona `allow`, solo se acepta dentro de alguna de ellas.
4. Mesa elegida (`table` / `table_qr`): se usan las coordenadas de la mesa del plano, nunca las que mande el navegador.
5. El mapa debe ser del **mismo local del pedido**, estar publicado y disponible (una edición solo la noche de su fecha, con la misma regla de «noche» de los reportes).

## Versionado e historial

*Publicar* copia el borrador a una versión nueva e inmutable. Cada pedido guarda `map_id` + `map_version`, de modo que actualizar el plano **no altera** ubicaciones anteriores: el cliente y el equipo ven el pedido sobre la versión con la que se hizo (`map_version_get`). La base impide leer una versión antigua a quien no sea del equipo del local o dueño de un pedido que la usó. Si el cliente corrige su ubicación, se valida contra el plano vigente y pasa a su versión. Las imágenes tampoco se sobrescriben (sin política de `update` en Storage) ni se borran si una versión las usa.

## Seguridad

| Regla | Dónde se cumple |
| --- | --- |
| Un local no ve ni edita mapas, versiones ni ubicaciones de otro | Funciones `SECURITY DEFINER` con `private.is_staff(local, true)`; tablas sin privilegios ni políticas para `anon`/`authenticated`. Pruebas con administrador, empleado, cliente y administrador de otro local. |
| Solo el equipo autorizado consulta la ubicación | Va dentro de `private.order_view`, que ya solo se llama tras comprobar «cliente dueño o equipo del local». |
| El cliente solo modifica la ubicación de **sus** pedidos, y mientras el estado lo permita | `order_location_set/clear`: dueño del pedido; estado `pending_authorization`/`queued`/`preparing`/`ready`; sin reclamo del retiro; el personal (incluido el administrador) no puede. |
| Sin ubicaciones de otros clientes | `order_list` y `get` ya filtran por dueño; la prueba compara las coordenadas de dos clientes. |
| Coordenadas y permisos validados en el backend | Todo en SQL; la ruta `/api/maps` además valida con zod, comprueba el origen (CSRF), limita el cuerpo y registra solo acción/local/código. |
| Referencia del mapa para auditoría | `map_id` + `map_version` en cada ubicación y `private.map_events`. |
| Límites | 40 mapas por local; 60 cambios/min por cuenta (`private.limit_action`). |

### Imágenes y SVG

- Raster: se reduce a **2400 px** como máximo y se recodifica a WebP (JPEG si el navegador no lo codifica) en el propio navegador; se verifica el contenido real (no el nombre ni el tipo declarado). Tope de 3 MB en el bucket.
- **SVG seguro**: lista cerrada de elementos y atributos (`src/features/maps/svg.ts`); se **rechaza**, no se «limpia», todo lo que contenga scripts, `foreignObject`, manejadores `on*`, entidades/XXE, `href` o `url()` a recursos externos, `data:` que no sea imagen, hojas de estilo XML. Los planos solo se muestran con `<img>` (sin ejecución de scripts), nunca en línea.
- Bucket `venue-maps`: lectura pública con nombres de objeto `<local>/<uuid>.<ext>` no adivinables; escritura solo de administradores del local dueño de la carpeta. **Compromiso asumido**: el plano en sí no es secreto (el cliente debe verlo), por lo que se prefirió caché de navegador/CDN a un bucket privado con URL firmadas; lo privado son las ubicaciones, los borradores y la lista de mapas, que solo salen por funciones con permisos. Si un local necesitara planos confidenciales, el siguiente paso es un bucket privado con URL firmadas.

## Pruebas

```bash
npm run check                         # tipos, lint, 261 pruebas (66 nuevas de este módulo) y build
npx vitest run tests/maps tests/db/venue-maps*.test.ts tests/db/maps-parity.test.ts
```

| Archivo | Cubre |
| --- | --- |
| `tests/db/venue-maps.test.ts` (16) | Permisos por rol y entre locales; tablas sin acceso directo; validación del plano e imágenes; concurrencia de edición; versiones inmutables; disponibilidad de ediciones por fecha; duplicar; coordenadas fuera del plano, tipos inválidos, zonas restringidas y de lista blanca, mesas, mapa de otro local; dueño/estado/reclamo; privacidad entre clientes; historial al republicar; personal por zona; **entrega solo con código válido**. |
| `tests/db/maps-parity.test.ts` | Cliente y base deciden igual en 786 selecciones (3 planos, puntos aleatorios, mesas). |
| `tests/db/venue-maps-storage.test.ts` | Políticas del bucket (carpeta del local, solo administradores, sin sobrescribir, sin borrar imágenes en uso). |
| `tests/maps/geometry.test.ts`, `svg.test.ts` | Normalización con 4 tamaños de pantalla, zoom con ancla, pellizco, límites, reglas de entrega; SVG peligrosos (≈30 casos), tipos de archivo, tamaños. |
| `tests/e2e/maps.spec.ts` (14, Chromium) | Plano cargado; pellizco, arrastre, doble toque y botones con gestos táctiles reales; selección precisa y mismo punto guardado en 360×640, 390×844, 820×1180 y 1440×900; zona restringida y fuera del plano; arrastre del marcador; mesa y QR de mesa; local sin plano; vista del equipo (centrado en el marcador, referencias, estado desde el plano) y entrega solo tras validar el código (código erróneo rechazado, correcto → cobro → entrega); editor (mesa, zona, guardar, publicar) con el pedido anterior conservando su versión; duplicar; subida optimizada (PNG de 3600 px → WebP de 2400 px) y rechazo de archivos falsos o con scripts. |

Pruebas de navegador (shim + `next dev`; el shim empieza con datos limpios y los pedidos se acumulan, así que **reinícialo entre ejecuciones**):

```bash
node scripts/local-shim/index.mjs &      # :54321 (incluye el plano de demostración de supabase/seed-maps.sql)
# next dev con las variables de docs/Onza-Guia-tecnica.md («Plan de pulido»), en :3100
PLAYWRIGHT_CHROMIUM=/ruta/a/chromium PLAYWRIGHT_NO_SANDBOX=1 \
  npx playwright test -c playwright.local.config.ts tests/e2e/maps.spec.ts --workers=1
```

El plano de demostración (Sala Norte, ficticio) es `public/demo-maps/sala-norte.svg` con su versión publicada en `supabase/seed-maps.sql` (se aplica después de `seed.sql`; no forma parte del seed de las pruebas de base de datos).

## Despliegue y límites de la verificación

- **Nada se aplicó en remoto.** Aplicar 025 y 026 en un proyecto Supabase **aislado** con `npx supabase db push --dry-run` primero (después de 013–024, que siguen pendientes; ver `DIARIO.md`). La app tolera una base sin 025: el selector simplemente no aparece (la lectura de mapas falla como «no disponible») y los pedidos siguen igual.
- **Sin verificar contra Supabase real**: subida y lectura reales en Storage (se probó la política en PGlite con un stub y el flujo del navegador con un Storage simulado), Realtime hacia la barra al cambiar la ubicación (se apoya en la publicación existente de `orders`), Auth real. El shim no los tiene.
- **Sin verificar en dispositivos físicos**: Safari de iPhone/iPad y Android (los gestos se probaron con eventos táctiles reales de Chromium móvil, no con un dedo; `touch-action: none` y los eventos de puntero están pensados para Safari, pero falta comprobarlo en un equipo físico).
- Decisiones: ubicación **opcional** siempre (no hay «obligatoria» por local); la ubicación se valida **antes** de crear el pedido y se guarda **después** (si falla el guardado el pedido existe y se puede corregir desde «Mi pedido»); el equipo no ve el código de entrega; las zonas con entrega «allow» activan un modo de lista blanca; el borde exacto de un polígono es indeterminado (igual en cliente y base).
