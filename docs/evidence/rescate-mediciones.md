# Mediciones de la entrega de rescate

Entorno: macOS, Node v25.5.0 para los scripts directos (el proyecto declara `^22.12 || ^24`), Chromium de Playwright con emulación, `next build` + `next start` local, servidor de verificación local (`scripts/local-shim`) y PGlite en memoria. Sin límite de red y sin hardware de teléfono. **No son cifras de producción.** Datos crudos: `docs/evidence/rescate-medicion-acceso.json`.

## Acceso: video y solicitudes (`scripts/measure-access.mjs`)

| Ruta | Dispositivo | Solicitudes | Bytes recibidos | MP4 que baja |
|---|---|---:|---:|---|
| `/acceso` | iPhone 14 | 24 | 5 955 KB | `access-mobile.mp4` (4 730 KB) |
| `/acceso` | iPad vertical y horizontal | 24 | 2 710 KB | `access-horizontal.mp4` (1 488 KB) |
| `/acceso` | Escritorio 1440 | 24 | 2 710 KB | `access-horizontal.mp4` (1 488 KB) |
| `/equipo/acceso` | iPhone 14 | 20 | 5 949 KB | `access-mobile.mp4` |
| `/equipo/acceso` | iPad / escritorio | 20 | 2 705 KB | `access-horizontal.mp4` |

- Cada variante descarga **solo su MP4**. Ambos tienen el índice (`moov`) antes de los datos: arrancan sin esperar la descarga completa. Pósteres: 23 KB (vertical) y 21 KB (horizontal).
- Lo que más pesa es el video móvil (4,6 MB). No se recodificó: es un asset aprobado y el `ffmpeg` local está roto (falta `libx265`), así que no se pudo comparar recorte ni contraste antes/después. Si se quiere aligerar, hay que reinstalar `ffmpeg` y revisar la imagen resultante.
- JavaScript inicial del HTML (gzip): `/acceso` 256 KB (11 archivos, 861 KB sin comprimir), igual en `/equipo/acceso` y `/login`. Los dos chunks mayores son React/Next y el cliente de Supabase; ningún chunk contiene Three.js.

## Código muerto retirado (`d10c97a`)

`src/components/backgrounds/particle-wave.tsx` y las dependencias `three` y `@types/three` no tenían ningún consumidor (`grep` sobre `src`, `tests`, `scripts`). Antes y después, el JS inicial es el mismo porque nunca entraban en un bundle; lo que cambia es la superficie de dependencias y de avisos de licencia.

## Consulta crítica: `venue_summary_range` (`scripts/measure-summary-query.mjs`)

20 000 pedidos entregados por local × 3 locales repartidos en 60 días, con pago y captura; cinco corridas, mediana.

| Período | Mediana | Rango |
|---|---:|---|
| Noche (1 día) | 23 ms | 23–39 |
| Semana | 43 ms | 42–44 |
| Mes | 108 ms | 105–110 |

Experimento con un índice `orders(venue_id, coalesce(queued_at, created_at))` (`MEASURE_INDEX=1`, **no se agregó migración**): noche 29 ms, semana 37 ms, mes 98 ms. El filtro por hora de entrada pasa de 5,4 ms a 0,26 ms, pero la función completa casi no cambia porque el resto del costo está en las otras partes (preparación, espera, pagos). **Conclusión: no hay un cuello de botella demostrado a este volumen, así que no se abre migración ni se refactoriza.** Conviene repetir con Postgres real y volumen de piloto.
