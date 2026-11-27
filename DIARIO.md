# Diario de cambios de Onza

> **Antes de tocar nada:** leé este archivo completo, de arriba hacia abajo hasta la sección "Estado actual", y después las últimas entradas. Es la fuente de verdad sobre **qué se hizo, quién lo hizo, con qué IA y qué sigue**. Si lo que ves en el código contradice este diario, no asumas nada: verificá y dejá constancia en una entrada nueva.

Este diario lo leen y escriben **personas y agentes de IA** (Claude Code, Codex u otros). Las reglas de abajo aplican a todos por igual.

---

## Protocolo obligatorio

### 1. Al empezar una sesión (antes de escribir código)

1. Leé **este archivo**: "Estado actual" y las entradas más recientes.
2. Leé `AGENTS.md` (reglas del producto, seguridad y dinero) y `docs/implementation-status.md` (pruebas y pendientes por etapa).
3. Confirmá en qué rama estás y cuál es la rama vigente (ver "Estado actual"). No trabajes sobre `main` ni la despliegues sin que el dueño lo pida.
4. Si el pedido del usuario choca con un pendiente o una decisión registrada acá, decíselo antes de empezar.

### 2. Al terminar (antes de cerrar o hacer commit final)

1. Agregá **una entrada nueva arriba** de "Entradas" con la plantilla de abajo. Una entrada por sesión o por hito coherente.
2. Actualizá "Estado actual" (rama vigente, último commit, siguiente tarea exacta).
3. Incluí la entrada en el mismo commit que el cambio, o en uno inmediatamente posterior en la misma rama.
4. No borres ni reescribas entradas anteriores. Si una era incorrecta, agregá una entrada de **corrección** que la referencie por ID.

### 3. Reglas de contenido

- **Verdad antes que optimismo.** Escribí solo lo que comprobaste. Si no ejecutaste una prueba, ponelo en "No verificado". Nunca "funciona" sin evidencia.
- **Sin secretos.** Nada de claves, contraseñas, tokens, URLs con credenciales ni valores de `.env.local`. Podés nombrar la variable, no su valor.
- **Identificá a la IA con precisión**: nombre de la herramienta y el modelo si lo conocés. Si no lo conocés, escribí `no registrado`; no lo adivines.
- **Fecha y hora** en `America/Costa_Rica` (UTC-6). Si no sabés la hora, escribí solo la fecha.
- **Commits**: listá los hashes cortos reales. Sin hash, escribí `sin commit`.
- Entradas cortas y concretas. Los detalles largos van en `docs/`, con enlace desde la entrada.

---

## Estado actual

> Actualizar en cada entrada. Si dice "sin confirmar", verificalo con `git` antes de confiar en el dato.

| Campo | Valor |
| --- | --- |
| Rama en revisión | `feat/noche-picnic-social` (base `d8a596d` de `feat/entrega-mapa`/`feat/entrega-mesa-admin`): mapa de Picnic con pin (026), barra con el pin en la tarjeta, admin por momentos, actividad y amigos (027). Solo commits locales; 025–027 sin aplicar en remoto. Ver D-2026-11-27-01 |
| Rama vigente de trabajo | `main` (consolidada el 2026-11-23: contiene la auditoría `audit/seguridad-escala`, el rescate `1090b4e` y los cambios de Codex). Se trabaja con ramas `feat/*` o `fix/*` y PR. Migraciones 021–024 sin aplicar en remoto |
| `main` | Fuente única de trabajo en GitHub (`msalas0810/onza`). **Despliegue automático de `main` desactivado en `vercel.json`** hasta aplicar 013–024 en la base alojada |
| Commit desplegado en Vercel | `fed579403d75da1d49cc54f0af9239b55c125706`, Preview READY `dpl_8emjFDVbshCsg5xBBsiaKNFSpEqT`. Video e ingreso laboral comprobados por HTTPS. |
| Demo desplegada | https://onza-demo.vercel.app (alias comprobado del Preview vigente; protección existente preservada, sin SSO obligatorio) |
| Backend | Supabase alojado `onza-dev`, pagos **mock** |
| Pagos reales | Deshabilitados. `BacPaymentProvider` falla explícitamente |
| Siguiente tarea exacta | Revisar `feat/noche-picnic-social` con `npm run demo:local` (README, «Probar en cinco minutos») y `docs/Onza-Noche-decisiones.md`. Después, en un proyecto Supabase **aislado**: `npx supabase db push --dry-run` (013–027), aplicar y repetir los tres recorridos de la guía técnica con Realtime real. Prueba física en iPhone/Android del plano de Picnic. |

### Pendientes abiertos

| ID | Pendiente | Desde |
| --- | --- | --- |
| INC-001 | Vía de retiro con número público cerrada y comprobada en dos sesiones reales; código privado y recuperación de ticket implementados. La ausencia original del ticket no se reprodujo: 19 cifrados válidos se abrieron con la clave existente, sin rotación. Pendiente prueba física del dueño. Ver D-2026-11-16-04. | 2026-11-16 |
| PEN-001 | Error React `use()` de las capturas: quedó documentado como "no reproducido tras conectar Supabase", **no como corregido** | 2026-11-16 |
| PEN-002 | Pruebas en iPhone y Android físicos (cámara, audio, safe area, foreground) | 2026-11-15 |
| PEN-003 | Fotos finales con derechos de uso (hoy `photo_path=null`, fallback tipográfico) | 2026-11-15 |
| PEN-004 | CI del código `e1e8987` aprobado: jobs checks y supabase-integration, run 43937917513. Cierre documental posterior sin cambios de aplicación. | 2026-11-16 |
| PEN-005 | Scheduler durable para expiraciones; hoy el barrido corre solo cuando hay tráfico. Configuración lista en `supabase/ops/pg_cron_auto_accept.sql` (no aplicada: cambio remoto) | 2026-11-15 |
| PEN-006 | Cobros reales: falta acuerdo y manual de BAC. Ver `docs/03-bac-y-pagos.md` | 2026-11-15 |
| PEN-007 | Corregido el registro: las migraciones 005–007 ya estaban aplicadas al iniciar esta sesión; 12 productos tenían imagen. Se aplicaron únicamente las nuevas 008/009. No se inventaron portadas ni coordenadas. | 2026-11-16 |
| PEN-009 | Auditoría 2026-11-21: la CI ya prueba login y Realtime reales (2026-11-23); sigue sin probarse contra Supabase real: Storage, cookies/refresh, expiración, revocación y cierre por dispositivo. Pasos exactos en `docs/Onza-Auditoria-seguridad-y-escala.md` §10 | 2026-11-21 |
| PEN-010 | Confirmar el límite de 60 validaciones de retiro por minuto (migración 024) y aplicar 021–024 en un proyecto aislado | 2026-11-21 |
| PEN-011 | Entrega en el lugar: aplicar la migración 025 con 013–024 en un proyecto aislado, probar Realtime real y el escaneo del QR en iPhone/Android físicos, y cargar los datos reales de Picnic (el seed es ilustrativo). Ver `docs/Onza-Entrega-en-el-lugar.md` §6 | 2026-11-26 |
| PEN-012 | Actividad y amigos (027): aplicar en un proyecto aislado; cargar coordenadas verificadas de locales reales (hoy ninguno tiene); elegir proveedor de mapa base si se quiere calles; revisar con volumen real si el mínimo de 5 personas sube a 10. Ver `docs/Onza-Noche-decisiones.md` §4 | 2026-11-27 |
| PEN-008 | Subida real a Storage, guardado/restauración de imagen y rechazo entre locales comprobados; script ampliado a 29 controles. La cámara y el guardado desde teléfono físico siguen pendientes. | 2026-11-16 |

---

## Plantilla de entrada

Copiá este bloque, completalo y pegalo **encima** de la entrada más reciente.

```md
### D-AAAA-MM-DD-NN · Título corto en imperativo o pasado

- **Fecha y hora:** AAAA-MM-DD HH:MM (America/Costa_Rica)
- **Persona:** quién pidió o dirigió el trabajo (nombre o usuario de GitHub)
- **IA:** herramienta + modelo (ej. `Claude Code · claude-sonnet-5-5`), o `no registrado`
- **Rama y commits:** `rama` · `abc1234`, `def5678` (o `sin commit`)
- **Qué cambió:** 2–6 líneas, en términos de comportamiento, no de líneas de código.
- **Archivos clave:** rutas principales.
- **Verificado:** comandos o pruebas que SÍ se ejecutaron y su resultado.
- **No verificado:** lo que no se pudo probar o se omitió.
- **Decisiones:** por qué se hizo así (y alternativas descartadas), si importa.
- **Pendientes / siguiente paso:** qué debe hacer la próxima persona o IA.
```

IDs: `D-<fecha>-<NN>`, con `NN` consecutivo dentro del día (01, 02, …).

---

## Entradas

> Más recientes arriba.

### D-2026-11-27-04 · Actividad y amigos: mínimo de 5 personas, «Estoy acá» desde el local y amigos dentro de Actividad

- **Fecha y hora:** 2026-11-27 02:20–02:50 (America/Costa_Rica)
- **Persona:** Manu (encargo «Continuá… luego Heatmap y Find Friends»).
- **IA:** Claude Code · claude-opus-5-5
- **Rama y commits:** `feat/noche-picnic-social` · commit de este bloque (ver `git log`), sobre `eebe593`.
- **Research:** búsqueda web disponible. Supresión de conteos chicos: [SharedStreets](https://medium.com/sharedstreets/aggregating-trip-data-using-k-anonymization-727d5a6413f3) usa un mínimo de 5; [un estudio sobre series de ubicación agregadas](https://arxiv.org/pdf/1902.07456) muestra que suprimir bajo 10 protege poco ante inferencia de pertenencia; [Transport for NSW](https://arxiv.org/pdf/1704.08547) advierte que un valor suprimido se recalcula si se publica el total. Detalle en `docs/Onza-Noche-decisiones.md` §2.
- **Qué cambió:** el mapa de actividad muestra un local recién desde **5** personas activas (antes 3). Se corrigió dentro de la migración 027 porque nunca se aplicó fuera de shims efímeros; si ya se hubiera aplicado en alguna base, iría en una migración nueva. Nunca se publica un total, así que no hay de dónde restar. El local tiene un enlace discreto «Estoy acá» → `/amigos?local=<slug>` con el local ya elegido, sin tocar el camino QR → pedir. `/actividad` suma «Tus amigos»: quién comparte su local y hasta qué hora, solo amistades aceptadas (misma regla de `social_overview`). Shim con un quinto cliente ficticio, `diego@correo.demo`.
- **Archivos clave:** `supabase/migrations/202611270027_social_activity.sql`, `src/app/actividad/page.tsx`, `src/app/v/[slug]/page.tsx`, `tests/db/social.test.ts`, `scripts/verify-amigos-actividad.mjs`, `scripts/local-shim/index.mjs`.
- **Verificado:** `tests/db/social.test.ts` 8/8 con el umbral nuevo (4 personas ocultas, 5 visibles; vencido, cerrado y sin coordenadas no cuentan). `npm run check` en verde (52 archivos / 257 pruebas, build). Regresión completa en instancia separada (:54322/:3200, shim recién iniciado en cada uno): `verify-entrega-mapa` 51/51, `verify-entrega-lugar` 43/43, `verify-admin-noche` 17/17 y `verify-amigos-actividad` **26/26** (nuevas: «Estoy acá» desde el local; en Actividad la amiga ve «María… Picnic, hasta las…» y un tercero no; 4 personas ocultas y 5 visibles). `scan-secrets` sin hallazgos; detector de Impeccable sin hallazgos. Capturas «después» regeneradas.
- **No verificado:** Supabase real y la 027 en una base remota; coordenadas verificadas de locales reales (ninguno las tiene, así que la actividad real muestra el estado vacío); mapa base con calles (sin proveedor elegido); vencimiento con reloj real en navegador (cubierto en la base).
- **Pendientes / siguiente paso:** revisar con volumen real si el mínimo sube a 10 (PEN-012); cargar coordenadas con fuente y fecha; elegir proveedor de mapa base si se quieren calles.

### D-2026-11-27-03 · Administración: «Antes de abrir», retrasos en preparación y un cierre que se lee solo

- **Fecha y hora:** 2026-11-27 01:50–02:20 (America/Costa_Rica)
- **Persona:** Manu (encargo «Continuá… después seguí con el admin»).
- **IA:** Claude Code · claude-opus-5-5
- **Rama y commits:** `feat/noche-picnic-social` · commit de este bloque (ver `git log`), sobre `3c2e982`.
- **Research:** la búsqueda web **volvió a funcionar** en esta parte. Listas de apertura y cierre de bar ([Toast](https://pos.toasttab.com/blog/on-the-line/bar-opening-and-closing-checklists), [Clover](https://blog.clover.com/free-bar-opening-and-closing-checklists), [WebstaurantStore](https://www.webstaurantstore.com/article/131/bar-closing-checklist.html)): antes de abrir se revisa el stock y lo que falta, y al cerrar se cuadra y se registran diferencias. Temporizadores de cocina ([Shift4 SkyTab](https://shift4.zendesk.com/hc/en-us/articles/4940115080083), [MenuTiger](https://menutiger.helpscoutdocs.com/article/383-how-do-i-change-the-appearance-and-preparation-times-for-my-kitchen-display-system-kds), [GoTab](https://docs.gotab.io/operator/kds-printers-additional-display-setup/kds-ticket-timer/), [Toast KDS](https://doc.toasttab.com/doc/platformguide/platformKDSOverview.html)): dos umbrales, aviso y alerta, en minutos y configurables; no hay un valor estándar.
- **Qué cambió:** «Ahora» suma (1) **«Antes de abrir»** mientras el local está cerrado: productos disponibles, agotados, horario, entrega en el lugar si aplica y capacidad, cada uno con su atajo, más «Abrir el local»; (2) **retraso en preparación**: aviso desde 10 min y alerta desde 15 (fijos por ahora, marcado como `shortcut` en `src/features/admin/attention.ts`). «Al cerrar» muestra **No entregados** (cancelados, vencidos o sin retirar), **Ventas netas (simuladas)** y la mediana de aceptación junto a la de preparación; «Pedidos activos» salió de ahí porque vive en «Ahora». La lista de Entrega y la de «Antes de abrir» usan un solo componente `Checklist` (`primitives.tsx`). Arreglado: las horas del gráfico se veían corridas y desvanecidas porque heredaban la animación global `.tick` del carrito (ahora `.chart-tick`).
- **Archivos clave:** `src/features/admin/{attention.ts,components/now-panel.tsx,components/admin-panel.tsx}`, `src/features/analytics/components/{admin-summary,summary-chart}.tsx`, `src/components/ui/primitives.tsx`, `scripts/verify-admin-noche.mjs`, `tests/admin/attention.test.ts`.
- **Verificado:** `npm run check` en verde (52 archivos / 257 pruebas; nuevas: umbrales de retraso; build). Instancia separada (:54322/:3200, shim recién iniciado): `verify-admin-noche` **17/17**. Cubre: entrada en «Ahora» y navegación agrupada; cerrar → «Antes de abrir» → abrir; pedido nuevo y en preparación en el pulso; pausar y reanudar; teléfono sin desplazamiento horizontal y pestañas bajo la cabecera; precio editado que el cliente ve; agotar en Menú y reactivar desde «Ahora»; pedido cancelado que cuenta en «No entregados»; montos rotulados como simulados. Detector de Impeccable sin hallazgos. Capturas en `docs/evidence/noche/admin/`.
- **No verificado:** el aviso de retraso en navegador (el shim no adelanta el reloj; está cubierto por la prueba unitaria). `verify-pulido-e4` completo (necesita `verify-pulido-all`, que reinicia el shim de :54321, que no es de esta sesión). Realtime real.
- **Pendientes / siguiente paso:** umbrales de retraso por local si un dueño los pide; bloque de actividad y amigos.

### D-2026-11-27-02 · Picnic y barra: el punto marcado se nombra bien y el seguimiento muestra las mesas

- **Fecha y hora:** 2026-11-27 01:30–01:50 (America/Costa_Rica)
- **Persona:** Manu (encargo «Continuá… cerrá y probá Picnic y barra»).
- **IA:** Claude Code · claude-opus-5-5
- **Rama y commits:** `feat/noche-picnic-social` · commit de este bloque (ver `git log`), sobre `b54178c`.
- **Qué cambió:** Un pin entre mesas ya no se lee «Llevar a Punto en el mapa»: la barra dice «Llevar al punto marcado · Jardín», el retiro «Entregar en el punto marcado» y el cliente «Entrega en el punto marcado» (`placePhrase` en `src/features/delivery/types.ts`, una sola regla). El plano del seguimiento del cliente muestra las mesas numeradas, igual que en la barra (antes solo la imagen). El recorte del pin en la tarjeta de la barra se amplió menos (200 %) para ubicar la mesa de un vistazo.
- **Archivos clave:** `src/features/delivery/types.ts`, `src/features/orders/components/order-detail.tsx`, `src/features/staff/components/queue.tsx`, `src/features/pickup/components/pickup-panel.tsx`, `scripts/verify-entrega-mapa.mjs`.
- **Verificado:** instancia local separada (shim propio en :54322 y build servido en :3200; los servidores de :3100/:54321 tienen datos viejos y no se tocaron), cada recorrido con el shim recién iniciado: `verify-entrega-mapa` **51/51** (nueva: el seguimiento muestra ≥10 mesas numeradas) y `verify-entrega-lugar` **43/43**. `npm run check` en verde (51 archivos / 255 pruebas, con 3 casos nuevos de `placePhrase`; build). Capturas en `docs/evidence/noche/{verificacion-mapa,verificacion-lugar,despues}`.
- **No verificado:** Realtime real, Safari e iPhone/Android físicos.
- **Pendientes / siguiente paso:** el título del plano ampliado en la barra todavía dice «Punto en el mapa» (es el valor guardado en la base); bloque de administración.

### D-2026-11-27-01 · Picnic de punta a punta, administración por momentos de la noche, actividad y amigos

- **Fecha y hora:** 2026-11-27 00:13–01:10 (America/Costa_Rica)
- **Persona:** Manu (encargo «ONZA — Rediseño de producto, implementación y orden del código», sesión nocturna sin confirmaciones).
- **IA:** Claude Code · claude-opus-5-5
- **Rama y commits:** `feat/noche-picnic-social` desde `d8a596d` (`feat/entrega-mapa`). Commits: `920be7c` (trabajo previo del mapa que estaba **sin commit**, guardado tal cual), `31bd6f3` (Picnic y barra), `2185a2b` (admin), `5f0d128` (actividad y amigos), `05184e8` (pulido), `f33eba7` (demo local, entorno, limpieza) y el cierre documental. Sin push, sin deploy, sin migraciones remotas.
- **Qué cambió:** (1) La barra ve el pin del cliente **en la tarjeta**: un recorte del mismo plano, centrado en el punto, sin abrir nada. El checkout ya no repite el lugar: se confirma junto a «Pedir». (2) Admin por momento: *Durante la noche* (Ahora, Pedidos), *Antes de abrir* (Menú y precios, Capacidad, Entrega y QR, Perfil y horario, Equipo) y *Al cerrar* (Resumen y CSV). «Ahora» es la entrada, con nuevos, preparando, listos y activos frente a la capacidad, pausa y agotados. (3) Migración **027**: check-in voluntario «Estoy acá» con vencimiento, `/actividad` con niveles por local (nunca conteos, mínimo 3 personas), ejemplo simulado aparte, y `/amigos` con solicitud por @usuario o enlace, compartir apagado por defecto y corte inmediato. Pedir no hace check-in. (4) Pulido con Hallmark e Impeccable: tokens `--onza-fixed-*`, sin etiquetas en mayúsculas espaciadas, deshabilitados legibles, barra inferior de 4 destinos. (5) `npm run demo:local`, `.env.example` documentado por variable, README «Probar en cinco minutos»; fuera `pickup-service.ts` y `findEnabledSpot` (sin usos).
- **Archivos clave:** `docs/Onza-Noche-decisiones.md` (referencias, crítica, decisiones, qué falta), `supabase/migrations/202611270027_social_activity.sql`, `src/features/social/*`, `src/app/{amigos,actividad}`, `src/app/api/social`, `src/features/delivery/components/order-map-button.tsx`, `src/features/admin/{admin-tabs.ts,components/now-panel.tsx}`, `scripts/{demo-local,shots-noche,verify-amigos-actividad}.mjs`, evidencia en `docs/evidence/noche/` (antes, después, verificaciones).
- **Verificado:** antes de tomarlo como base, el trabajo sin commit del mapa pasaba tipos, lint y 245 pruebas. Al cerrar, `npm run check` en verde: tipos, lint, 51 archivos / 255 pruebas (8 nuevas de base para lo social: alcance, conteos chicos, vencimiento, revocación, terceros, «pedir no hace check-in»; 2 de proyección) y build. En navegador (Chromium vía Playwright, contra un shim propio en :54322 y un build en :3200, cada recorrido con el shim recién iniciado): `verify-entrega-mapa` **50/50** (QR de mesa → login → pin → pedido → el mismo pin en la barra → entrega con código; retiro en barra; mapa en admin), `verify-entrega-lugar` **43/43** (incluye pausar y reanudar desde «Ahora», CSV y lugares), `verify-amigos-actividad` **23/23** (solicitud, aceptación, compartir, dejar de compartir, tercero sin acceso, cuenta del equipo rechazada, 2 personas ocultas y 3 visibles como nivel). Menú en teléfono (360 px, recorrido aislado contra el mismo shim): editar el precio de Gin tonic persiste y el cliente lo ve (₡5 400); agotar desde Menú aparece en «Ahora» y se reactiva desde ahí. `verify-pulido-e4` quedó al día con las etiquetas nuevas y con Ana admin de dos locales, pero no vale suelto: necesita los pedidos que dejan los grupos anteriores de `verify-pulido-all`, que no se corrió porque reinicia el shim en :54321, que es de otra sesión. Detector de Impeccable sin hallazgos; Hallmark sin fallos salvo cinco excepciones documentadas. `scan-secrets`: sin claves versionadas y `.env.local` ignorado.
- **No verificado:** Supabase real (Auth, Realtime, Storage) y migraciones 025–027 en cualquier base remota. Safari, iPhone y Android físicos (toque del plano, QR real). Vencimiento con el reloj real en navegador (sí en la base, `tests/db/social.test.ts`). El arranque completo de `npm run demo:local`: hay un `next dev` de la sesión anterior en :3100 (PID 23281) que no se detuvo, y Next permite uno por carpeta. Sí se comprobaron sus mensajes de falla (puerto ocupado y `next dev` duplicado). La búsqueda web general quedó bloqueada; las referencias salen de páginas abiertas una por una (ver la nota).
- **Decisiones:** se partió del trabajo sin commit del mapa porque era lo más reciente y completo. Se guardó en su propio commit y con respaldo en `~/Documents/Onza/Onza-respaldo-ramas/2026-11-27-wip-entrega-mapa/`. No se detuvieron procesos ajenos (:3100 y :54321). Lo social vive en `src/features/social` y su propia API (`/api/social`), no en los comandos de pedidos. Las tablas no tienen permisos directos. Mapa de actividad esquemático, sin dependencia nueva: no hay coordenadas verificadas ni proveedor de mapa base. Detalle y alternativas en `docs/Onza-Noche-decisiones.md`.
- **Pendientes / siguiente paso:** revisar la rama. Aplicar 013–027 en un proyecto aislado y repetir los tres recorridos con Realtime real. Cargar coordenadas verificadas (PEN-012). Probar en teléfono físico el plano de Picnic y el recorte del pin en la barra. Opcional: tiempos de aceptación y preparación por producto en «Al cerrar», que hoy son por noche.

### D-2026-11-26-01 · Entrega en el lugar (mesa, zona o puesto), flujo de Picnic y mejoras del administrador

- **Fecha y hora:** 2026-11-26 (America/Costa_Rica)
- **Persona:** Manu (encargo «Revisá la plataforma de Alberto y usala como referencia para mejorar Onza»).
- **IA:** Claude Code · claude-sonnet-5-5
- **Rama y commits:** `feat/entrega-mesa-admin` desde `main` (`e415735`), solo commits locales (sin push, sin deploy, sin migraciones remotas): ver `git log main..feat/entrega-mesa-admin`.
- **Qué cambió:** Migración **025**: cada local (o evento) elige si entrega solo en la barra (por defecto, nada cambia), en el lugar del cliente o ambas, con lugares nombrados y validados (mesas, zonas, puestos). El servidor valida el lugar al pedir y al cambiarlo; el cliente puede corregirlo hasta la entrega; la cola del equipo muestra «Llevar a Mesa 7 · Jardín» y «Entregar en…»; la entrega se confirma con el mismo QR/código privado del retiro y queda dónde, cuándo y quién. Admin: pestaña **Entrega** (configuración, lugares, alta por rango, QR y hoja imprimible), panel **Ahora** con reanudar en un toque y **Exportar CSV**. Picnic como demo ficticio en `seed.sql`. Se corrigió el middleware: al pasar por el acceso descartaba la query y el QR de una mesa perdía su lugar.
- **Archivos clave:** `supabase/migrations/202611260025_location_delivery.sql`, `src/features/delivery/*`, `src/features/orders/components/{checkout,order-detail}.tsx`, `src/features/staff/components/queue.tsx`, `src/features/admin/components/{admin-panel,now-panel}.tsx`, `src/app/admin/[venueId]/qr`, `src/app/api/{delivery,export}`, `scripts/verify-entrega-lugar.mjs`, `docs/Onza-Entrega-en-el-lugar.md` (comparación, decisiones, cómo probar, pendientes).
- **Verificado:** `npm run check` en verde (46 archivos / 218 pruebas, antes 44 / 195; build correcto). 15 pruebas de base nuevas sobre PGlite con roles y RLS, matriz de permisos actualizada, y recorrido en navegador contra el shim local con Chromium (43 comprobaciones a 360/390/1280 px): Picnic de punta a punta, local normal con retiro por código, y administración. Evidencia en `docs/evidence/entrega-lugar/`.
- **No verificado:** Supabase real (Auth, Realtime, Storage: el shim no los tiene), Safari/iPhone y escaneo real del QR, migración sobre `onza-dev` o un proyecto aislado (no se aplicó nada remoto), datos reales de Picnic.
- **Decisiones:** hallazgo: en la referencia, el flujo de Picnic no está en `main` sino en la rama `claude/map-in-settings` y usa un mapa con punto, no mesas; se implementaron lugares nombrados validados. Confirmación con el QR/código privado de Onza (sin segundo código). `create_order` se envuelve (`create_order_base` queda intacta) en vez de copiarse de nuevo. Un evento es un local. No se copió código de la referencia (sin licencia). Detalle y alternativas en `docs/Onza-Entrega-en-el-lugar.md`.
- **Pendientes / siguiente paso:** aplicar 013–025 en un proyecto aislado y repetir el recorrido con Realtime real; probar en iPhone y Android; cargar los datos reales de Picnic desde Administración → Entrega.

### D-2026-11-23-01 · Consolidar Onza en `main` y preparar el repo público

- **Fecha y hora:** 2026-11-23 (America/Costa_Rica)
- **Persona:** Manu (encargo «Consolidá Onza y publicá la versión más actual en main… repo público, única fuente de trabajo»).
- **IA:** Claude Code · claude-sonnet-5-5
- **Rama y commits:** `main` por fast-forward desde `00a29b8`, sin force-push: `1f26065` (consolidación), `1dbe72a`, `22c28d5`, `850ebf9`, `aaa882b` (ajustes de CI y de pruebas e2e descritos abajo). Repo `msalas0810/onza` pasado a **público**.
- **Qué cambió:** `audit/seguridad-escala` ya contenía `main`, `fix/hosted-integration` (incluye los cambios de Codex), `review/rescate-entrega` (`1090b4e`), `feat/plan-pulido` y `feat/local-mvp`: ninguna rama tenía trabajo único. README nuevo y mínimo (clonar, correr, abrir un PR); el README anterior se conserva en `docs/Onza-Guia-tecnica.md`. `vercel.json` desactiva el despliegue automático de `main` mientras la base alojada no tenga 013–024. CONTRIBUTING actualizado (ya hay remoto).
- **Archivos clave:** `README.md`, `docs/Onza-Guia-tecnica.md`, `vercel.json`, `CONTRIBUTING.md`.
- **Verificado:** `npm run check` (tipos, lint, 195 pruebas, build) en verde antes del commit de consolidación. Revisión de secretos: patrones de claves/JWT/PEM/URLs con credenciales sobre todo el historial (0 coincidencias), los 3 valores secretos de `.env.local` buscados en árbol, historial y bundle (ausentes), `.env.local` ignorado.
- **Verificado además (CI de GitHub, Supabase local real con Docker, datos ficticios):** el job `supabase-integration` quedó en verde en `aaa882b`: login real de cliente, barra y administrador, pedido, aceptación y «listo» recibidos por Realtime, retiro concurrente con un solo ganador, cobro simulado `unknown` → conciliado, entrega, rechazo del código consumido, resumen del administrador y alternativa manual sin cámara. Antes de esos ajustes fallaba por dos regresiones de pruebas (no de la app): los escenarios de pago quedaron cerrados por defecto desde la migración 021 (la CI ahora los habilita solo en su base efímera) y las pruebas seguían los textos de antes del rescate. Tras el push de `main` Vercel no creó ningún despliegue (sin estado «Vercel» en el commit; el demo siguió respondiendo 200).
- **No verificado:** Storage real (portada/avatar), expiración y revocación de sesión con Auth real, cierre solo en este dispositivo con Auth real (siguen en PEN-009); el efecto de `vercel.json` se infiere de la ausencia de despliegue, no se vio el panel de Vercel.
- **Decisiones:** el guardia de `vercel.json` vive en el repo y no toca la configuración del proyecto Vercel. Se retira cuando 013–024 estén aplicadas y las variables de Production configuradas. Ramas remotas `fix/hosted-integration` y `review/rescate-entrega` conservadas (alimentan el demo y el Preview ya compartidos); están integradas en `main` y se pueden borrar después. Respaldo de todas las ramas (bundle) y del plan sin versionar en `~/Documents/Onza/Onza-respaldo-ramas`. `docs/Onza-Plan-seguridad-y-escala.md` queda fuera del repo (respaldado en `~/Documents/Onza`).
- **Pendientes / siguiente paso:** aplicar 013–024 en un proyecto aislado y luego en el remoto elegido; retirar el bloque de `vercel.json`; revisar la licencia de Particle Wave y definir una `LICENSE` del repo.

### D-2026-11-21-01 · Auditoría defensiva de seguridad y escala, con correcciones

- **Fecha y hora:** 2026-11-21 00:00–02:00 (America/Costa_Rica)
- **Persona:** Manu (encargo «Hacé el audit defensivo de seguridad y escala de Onza e implementá las correcciones»).
- **IA:** Claude Code · claude-sonnet-5-5
- **Rama y commits:** `audit/seguridad-escala` desde `1090b4e` (local, **sin push, sin deploy, sin migraciones remotas**) · `2b7d769`, `9d240ab`, `08062f2`, `cc70ba5`, `8f15892`, `a4abec0` y el cierre documental.
- **Qué cambió:** Sesiones: cerrar sesión ya no cierra todas las sesiones de la cuenta (solo este dispositivo; «en todos» es explícito), una pestaña se entera si otra cierra sesión o cambia de cuenta, y un fallo transitorio de Auth o de la base muestra «reintentá» (503) en vez de tratar a la persona como sin sesión o como cuenta personal. Permisos: migraciones **021** (la cuenta del equipo, la sesión invitada y el perfil incompleto no compran ni llamando a la RPC directo; pagos simulados cerrados por defecto; el cliente no lee `actor_id` ni `metadata` de los eventos), **022** (sin escritura directa en tablas públicas pese a los permisos por defecto de Supabase), CSP parcial y cabeceras anti-clickjacking, imágenes solo del Storage propio, registro estructurado con ID de correlación. Escala: migración **023** (`order_list(venue)` de ~3,3 s a ~0,1 s con 20 000 pedidos del local, índice del barrido, informes sin desborde de `integer`) y **024** (límite de validación de retiros de 10 a 60 por minuto: decisión de seguridad a confirmar).
- **Archivos clave:** `docs/Onza-Auditoria-seguridad-y-escala.md` (informe, matriz de roles, hallazgos, pendientes), `docs/Onza-Runbook-operacion.md`, `supabase/migrations/202611210021…24`, `supabase/ops/pg_cron_auto_accept.sql` (no aplicada), `supabase/hosted-auth-hardening.toml` (propuesta), `scripts/audit/*`, `scripts/verify-audit-sesiones.mjs`, `tests/db/audit-permissions.test.ts`, `src/proxy.ts`, `src/components/ui/auth-sync.tsx`, `src/lib/{audit-log,storage-url}.ts`, `docs/evidence/audit/`.
- **Verificado:** `npm run check`: tipos y lint sin errores, 44 archivos / 195 pruebas (antes 41 / 157), `next build` correcto. Matriz de permisos (30 pruebas; 8 de ellas fallan sin 021 y 4 sin 022). Postgres 17 real y aislado (embedded-postgres): `concurrency.mjs` 31/31 (12 escenarios, sin duplicados ni deadlocks), `migrations.mjs` 14/14 (base vacía vs salto desde 012 con 100 000 pedidos: mismo esquema final, datos intactos). Navegador contra el servidor local simulado: `verify-audit-sesiones` 44/44 y `verify-pulido-all` sin regresiones. Carga sintética en la capa de base de datos (100 sesiones, 30 checkouts/min por 15 min, 60/min por 3 min): sin errores inesperados ni duplicados; antes/después de 023 en `docs/evidence/audit/`. `npm audit` 0 vulnerabilidades; `scan-secrets` sin hallazgos.
- **No verificado:** Supabase Auth real (cookies, refresh y expiración reales; revocación de sesión), PostgREST, Realtime (latencia y plazo de revocación), Storage real, correo, `onza-dev` (no se tocó), Safari/iPhone/iPad/Android físicos, carga de Next/PostgREST/Realtime, hardware de Supabase, MFA. `scripts/verify-local-flow.mjs` está desactualizado frente a la interfaz del rescate (no se comprobó si ya fallaba antes).
- **Decisiones:** `Cliente` y `Equipo` siguen siendo cuentas distintas (el plan suponía una sola identidad); cierre por dispositivo; el SQL 001–020 no se modificó (todo cambio es una migración posterior); no se reemplazó `onza_command` (las reglas viven en triggers). `docs/Onza-Plan-seguridad-y-escala.md` sigue sin versionar y sin cambios; los ajustes al plan están en el informe, §2.
- **Pendientes / siguiente paso:** (1) revisar la rama; (2) en un **proyecto Supabase aislado** (no `onza-dev`): `npx supabase db push --dry-run` debe listar 013–024 → aplicar → `update private.configuration set accounts_required=true` si la app usa `ACCOUNTS_REQUIRED=true`; (3) probar sesiones, Storage y Realtime reales ahí (hace falta Docker para el entorno local completo); (4) decidir el programador (`pg_cron`), el endurecimiento de Auth y el límite de 60 retiros/min; (5) recomendado: `order_list(venue)` que devuelva solo activos + últimos 20 cerrados (siguiente cuello medido).


### D-2026-11-19-05 · Rescate: auditoría con la app abierta, brechas cerradas y limpieza

- **Fecha y hora:** 2026-11-19 12:45–13:30 (America/Costa_Rica)
- **Persona:** Manu (encargo «Auditá y completá Onza»).
- **IA:** Claude Code · claude-sonnet-5-5
- **Rama y commits:** `review/rescate-entrega` desde `feat/plan-pulido` `83ba141` · `41505e1`, `22c698b`, `d10c97a`, `be18740`, `bde956f`, `13d369b`, `4c2a848` y el cierre documental. Sin push, sin tocar producción ni el Preview.
- **Qué cambió:** «Tus locales» ya no tapa badges ni parte nombres (acciones debajo, al lado en escritorio). Cuenta: nombre, @usuario y trago favorito (opcional) editables (migración aditiva 020). Acceso: título corto y «Próximamente» dentro del botón a 320 px. Se retiró `three`/ParticleWave sin uso. Higiene: fuentes y referencias archivadas fuera del repo, `design/bocetos` retirado.
- **Archivos clave:** `docs/Onza-Matriz-de-entrega.md`, `docs/Onza-Estructura-del-repo.md`, `docs/evidence/rescate-mediciones.md`, `src/app/equipo/locales/page.tsx`, `src/features/account/components/profile-editor.tsx`, `supabase/migrations/202611190020_profile_details.sql`, `scripts/verify-tus-locales.mjs`, `scripts/verify-rescate-*.mjs`.
- **Verificado:** `npm test` 41 archivos/157 pruebas, typecheck, lint y build; `node scripts/verify-pulido-all.mjs` (E1–E6, video, acceso estrecho, cuenta, Tus locales 143/143) y e2e `venue-card` 14/14, todo en Chromium contra el servidor local aislado. Capturas antes/después abiertas e inspeccionadas.
- **No verificado:** dispositivos físicos y Safari, cámara real, Realtime, Storage, correo, migraciones 013–020 en Supabase real. La transcripción y el ZIP de capturas no estaban en el Mac. Matriz: 23 verificados, 7 parciales.
- **Decisiones:** se mantiene la línea «sin relación comercial con el local» (decisión de Manu pendiente, C05). No se recodificó el video móvil (ffmpeg local roto). No se agregó índice: la medición no mostró cuello de botella.
- **Pendientes / siguiente paso:** instalar `jsqr@1.4.0` (denegado dos veces por el entorno), probar Storage/Realtime/correo en un proyecto Supabase aislado, programar `auto_accept_tick`, pruebas físicas.


### D-2026-11-19-04 · Implementar las seis entregas del plan de pulido en rama local

- **Fecha y hora:** 2026-11-19 03:20–05:10 (America/Costa_Rica)
- **Persona:** Manu (encargo nocturno sin confirmaciones intermedias).
- **IA:** Claude Code · claude-opus-5-5
- **Rama y commits:** `feat/plan-pulido` desde `fed5794` · `47c3bf1`, `7bfb779`, `4c24f05`, `0250975`, `dd21af8`, `d1dc154`, `f785f01` y el cierre documental. Sin push.
- **Qué cambió:** E1 plazo de 5:00 desde la cola, cupos sin pedidos vencidos ni inciertos fuera de plazo, intento de checkout por cuenta (sin bloqueo tras rechazos), agotar/archivar/restaurar sin perder productos. E2 lockup único con punto rojo, accesos con vidrio y alta sin tabs, Explorar con sugerencias, pedidos por noche operativa, Cuenta con avatar privado. E3 entrada por rol, barra con una mano, retiro QR primero con código agrupado, «¡Disfrutá!». E4 Admin en teléfono, resumen por período, portada/logo con punto focal. E5 límite por cancelaciones en observación y lista de espera. E6 aceptación automática apagada por defecto.
- **Archivos clave:** `supabase/migrations/202611190013…19`, `src/features/orders/components/checkout.tsx`, `src/features/staff/components/queue.tsx`, `src/features/pickup/components/pickup-panel.tsx`, `src/features/admin/components/admin-panel.tsx`, `src/features/analytics/components/*`, `src/components/ui/brand.tsx`, `docs/plan-pulido-registro.md`.
- **Verificado:** `npm test` 40 archivos/155 pruebas (PGlite, migraciones reales), typecheck, lint, build y `check-kit`. Regresión final con `node scripts/verify-pulido-all.mjs` (Chromium contra `scripts/local-shim`, datos limpios por grupo): E1 10/10, E2 27/27, E3 21/21, E4 21/21, video por dispositivo 11/11, E5 9/9, E6 9/9; video también 11/11 en WebKit (emulación); e2e de tarjeta 14/14.
- **No verificado:** Safari y dispositivos físicos (solo emulación), cámara real, subida real a Storage (avatar, portada, logo), Realtime y correo (el shim no los tiene), migraciones en Supabase real. Nada se aplicó a `onza-dev` ni a producción.
- **Decisiones:** ver secciones de decisiones en `docs/plan-pulido-registro.md`. Se conserva una línea «sin relación comercial con el local» en la cabecera del local (locales reales sin acuerdo). Este commit también incluye las entradas D-2026-11-19-01..03 que Codex dejó solo en local.
- **Pendientes / siguiente paso:** bloqueos con comando exacto en el registro: decodificador QR alternativo (instalar `jsqr@1.4.0` fue denegado), cron para `auto_accept_tick`, Storage real, fotos con permiso, prueba física.


### D-2026-11-19-03 · Compartir el fondo de video con el acceso de personal

- **Fecha** 2026-11-19 (America/Costa_Rica).
- **Persona** Manu. **IA** Codex · GPT-6.2-sol.
- **Rama y commit** `fix/hosted-integration` · `fed5794`.
- **Qué cambió** `/equipo/acceso` comparte el fondo y los assets del acceso de clientes. Video horizontal en computadora e iPad y vertical en iPhone. Conserva el formulario laboral y su composición.
- **Verificado** Build y ESLint. En Chromium, capturas de escritorio e iPhone y comprobación local y por HTTPS de ambos accesos en escritorio, iPhone e iPad emulados. Solo se descarga el MP4 correspondiente. Fallback al póster y login laboral real hasta barra de Mil948 aprobados. Preview READY `dpl_8emjFDVbshCsg5xBBsiaKNFSpEqT`.
- **Pendiente** Safari en dispositivos físicos. Diario actualizado localmente.


### D-2026-11-19-02 · Llevar el video horizontal a iPad y computadora

- **Fecha** 2026-11-19 (America/Costa_Rica).
- **Persona** Manu. **IA** Codex · GPT-6.2-sol.
- **Rama y commit** `fix/hosted-integration` · `2d3925d`.
- **Qué cambió** `/acceso` usa video horizontal 1440×810 en computadora y ambas orientaciones de iPad. iPhone usa el video vertical existente. Google y Apple figuran como “Próximamente” y están deshabilitados. Correo, personal y enlaces legales conservan sus destinos. El iPad usa su pantalla completa con el sombreado de la referencia.
- **Verificado** Build y ESLint aprobados. Capturas de Chromium comparadas con el HTML. En local y por HTTPS se comprobaron cuatro vistas, rotación del iPad, una sola variante de video por dispositivo, 0.75×, fallback a póster, ausencia de solicitudes OAuth y login real por correo hasta Mil948. MP4 H.264 de 24 fps con una única pista de video.
- **Preview** READY `dpl_DfAUM4t1974yiWxj81PeDgQbr2u3`. Alias https://onza-demo.vercel.app/acceso confirmado.
- **Pendiente** Safari en iPad e iPhone físicos. Diario local excluido del commit de la app.


### D-2026-11-19-01 · Portar el acceso móvil con video aprobado

- **Fecha:** 2026-11-19 (America/Costa_Rica).
- **Persona:** Manu. **IA:** Codex · GPT-6.
- **Rama:** `fix/hosted-integration`; commit del cambio consultable en git log.
- **Qué cambió:** solo `/acceso` móvil hasta 600 px, según HTML local aprobado. MP4 y póster extraídos del HTML; original y referencia fuera del repositorio. Duotono, sombras, medidas, botones y ajuste bajo preservados; escritorio Particle Wave y equipo conservados. Autenticación existente sin modificaciones.
- **Verificado:** build y ESLint de TSX aprobados; captura 390×844 comparada con HTML; once controles puntuales locales, incluidos login correo real con destino, invocación OAuth interceptada, personal, video inline/muted/loop 0.75×, fallback por autoplay bloqueado, movimiento reducido y cero MP4 en escritorio. MP4 avc1/H.264, 540×960, 993 cuadros, escala 12288 y delta 512 (24 fps), única pista de video sin audio.
- **No verificado:** iPhone físico y Google completo; Preview READY `dpl_EaMpDDEUmjZx2NiUWu3pypsgQXqu` y alias confirmados; once controles anteriores también aprobados por HTTPS. URL inmutable: https://onza-demo-o3skldnzv-msalas0810s-projects.vercel.app. Commit `3babdcb`.
- **Decisión:** diario conservado solo localmente; el usuario exige que el nuevo commit contenga exclusivamente `/acceso` y assets de producción.


### D-2026-11-17-07 · Preparar accesos del demo en onza-dev

- **Fecha y hora:** 2026-11-17 (America/Costa_Rica)
- **Persona:** Manu
- **IA:** Codex · GPT-6
- **Rama y commits:** `fix/hosted-integration` · base `af932d3`; ajuste en el commit de esta entrada.
- **Qué cambió:** actualización por fast-forward desde árbol limpio. Identidad onza-dev confirmada por CLI, ref `ukdjuubekpanizcmppod`. Contraseñas de las cuatro cuentas demo existentes solicitadas actualizadas en Auth y sincronizadas solo en el entorno local; cuenta Onza intacta. Migraciones aditivas 011/012 revisadas con dry-run y aplicadas sin reset. Seed real ejecutado: cinco locales, 24 productos, tres locales ficticios ocultos y 15 asignaciones laborales. Cliente sin membresías; los dos bartenders y admin comparten Mil948 abierto.
- **Corrección necesaria:** el login cliente rechazaba una contraseña aceptada por Auth con “Usá al menos 8 caracteres.”. Se reprodujo en Preview; el mínimo se aplica ahora solo al registro. No se versionan credenciales ni scripts temporales.
- **Verificado:** typecheck, ESLint del formulario y diff-check; login por Auth y formulario, acceso al mismo local y roles en cuatro sesiones independientes contra servidor local con Supabase real. Preview existente READY y alias confirmados para `af932d3` antes del ajuste.
- **No verificado:** no se repitió suite completa ni pedidos, alta laboral, cambios temporales, cámara, audio ni teléfonos físicos.
- **Cierre HTTPS:** `bea7907` publicado, Preview READY `dpl_E2CuD4eFbPYKrjrQwNAxZDp6aSVd`; alias `https://onza-demo.vercel.app` confirmado. Los cuatro logins por Auth y formulario, roles, cliente sin membresías y acceso a Mil948 pasaron en sesiones independientes. Evidencia sin credenciales: `docs/evidence/demo-access-ready.json`. Configuración local sincronizada con cuentas obligatorias y escenarios de pago apagados; archivo ignorado, modo 0600. Scripts temporales eliminados.
- **Pendientes / siguiente paso:** prueba física de Manu; sin credenciales locales faltantes para el alcance solicitado.


### D-2026-11-17-06 · Implementar F2–F6 del rediseño V1 y verificar el recorrido real en local

- **Fecha y hora:** 2026-11-17 09:00 (America/Costa_Rica)
- **Persona:** Manu
- **IA:** Claude Code (identificador de modelo no se registra en el repo por política de la sesión)
- **Rama y commits:** `fix/hosted-integration` · commits de F2, F3, F4–F5 y F6–F7 (ver `git log`); F1 `8cb0b41` intacta.
- **Qué cambió:** tokens negro/ivory/oxblood y hoja global portada de las maquetas; primitivas (Button, Field, Toggle, SegmentedControl, QuantityStepper con papelera, Notice, Sheet, ConnectionBanner). Cliente: Explorar con portada protagonista y sin distancias inventadas, menú compacto, carrito por cuenta con revisión de agotados y precios, checkout con errores por código y confirmación con vasito, pedido con línea de tiempo y ticket, hoja de sesión vencida. Equipo: marco propio, acceso directo al local, `/equipo/locales`, `/equipo/clave`, barra densa con rechazo en hoja y validar retiro en hoja. Administración con pestañas por URL (Resumen, Pedidos, Menú, Disponibilidad, Negocio, Equipo). Migración **011** (staff_accounts, clave temporal en base de datos, equipo por local) y **012** (`demo_listed`), ambas aditivas. Seed de cinco locales reales con menús y precios simulados. Sin dependencias nuevas; el acceso con Particle Wave conserva su composición.
- **Archivos clave:** `src/styles/globals.css`, `src/components/ui/*`, `src/features/{catalog,orders,staff,admin,team,pickup}`, `src/app/{equipo,staff,admin,v,cart,checkout,orders,cuenta}`, `supabase/migrations/20261117001{1,2}_*.sql`, `fixtures/real-venues.json`, `scripts/{local-shim,seed-real-venues.mjs,verify-local-flow.mjs}`.
- **Verificado (local):** `tsc`, `eslint`, `vitest` (107 pruebas, incluidas 9 de SQL del equipo en PGlite, política de acceso y seed), `next build`; Playwright de `design-system`, `venue-card`, `product-image` y `local-ui` contra la app; `scripts/verify-local-flow.mjs`: **65 controles** del recorrido real (cliente pide → barra acepta → listo → ticket → validar → entregar; cancelar antes de aceptar y carrera aceptar/cancelar; rechazo con motivo; aislamiento entre cuentas y locales; alta con contraseña temporal, cambio obligatorio también por API, quitar acceso a un solo local y rechazo posterior; agotado y precio nuevo; sesión vencida; sin conexión; 14 pedidos en la barra). Capturas en `docs/evidence/v1/`.
- **Verificado en CI (GitHub Actions, commit `709b42e`):** jobs `checks` (typecheck, lint, 107 pruebas, build, `design-system` y `local-ui`) y `supabase-integration` (Supabase local real en Docker: pruebas SQL y los E2E en vivo `full-demo` —cliente → barra → ticket → retiro concurrente → administrador— y `pickup`) en verde. Vercel construyó el Preview del mismo commit (estado `success`); **no se abrió ni se probó** desde la sesión.
- **No verificado:** **nada contra `onza-dev`; el Preview solo está construido, no recorrido** (la red del entorno bloqueó Vercel y `*.supabase.co`; el conector de Supabase ve otra organización). El servidor local es PGlite con las migraciones reales, **no Supabase**: sin Realtime, Storage, correo, Google ni límites de tasa. Teléfonos físicos, lector de pantalla, sonido/vibración/Wake Lock. Las pruebas E2E en vivo (`full-demo`, `hosted-ux`, `pickup`) y `scripts/verify-*.mjs` se ajustaron a la interfaz nueva pero no se ejecutaron.
- **Decisiones:** coordenadas, fotos y logos de los locales quedan vacíos (no se inventan; la carpeta `public/demo-venues/real/` documenta cómo agregarlos con procedencia); el frontend nuevo no depende de la migración 012 (si falta la columna lista todos); Explorar y el resto conservan el comportamiento existente donde P-1–P-7 siguen pendientes; el rechazo, la clave temporal y el quitar acceso se resuelven en SQL y en la API, no solo en la interfaz.
- **Pendientes / siguiente paso:** ver "Siguiente tarea exacta". Sin resolver: R3 y R5 (P-4), `onza_command` no impide a una cuenta del equipo crear pedidos llamando el RPC directo (la ruta de la app sí lo impide), PEN-001.

### D-2026-11-17-05 · Plan V1 y maquetas navegables F1 (sin tocar la app)

- **Fecha y hora:** 2026-11-17 02:10 (America/Costa_Rica)
- **Persona:** Manu
- **IA:** Claude Code (identificador de modelo no se registra en el repo por política de la sesión)
- **Rama y commits:** `fix/hosted-integration` · commit de esta entrada (hash en git log)
- **Qué cambió:** plan ejecutable V1 con fases F1–F7, estado, instrucciones consolidadas, propuestas P-1–P-7, bloqueos y criterios pendientes (`docs/plan-v1.md`). F1 ejecutada: maquetas HTML navegables de cliente, empleado y administrador con plantillas compartidas, tokens negro/ivory/oxblood con contrastes medidos, catálogo de componentes con procedencia, reglas de movimiento y estados, lógica del servidor simulada (permisos, versiones, idempotencia, stock, sesión vencida, revocación por local, clave temporal) y vista de flujo cruzado. Guía de implementación `design/maquetas-v1/GUIA.md`. Bocetos anteriores marcados históricos; AGENTS y hosted-ux-plan apuntan al plan nuevo. **No se tocó la app, Supabase ni Vercel.**
- **Archivos clave:** `docs/plan-v1.md`, `design/maquetas-v1/` (`index.html`, `app.html`, `flujo.html`, `componentes.html`, `GUIA.md`, `assets/`, `data/venues.js`, `verificacion.json`, `capturas/`), `scripts/verify-maquetas.mjs`.
- **Verificado:** `node scripts/verify-maquetas.mjs` en Chromium: 51/51 controles (recorridos entre dos y tres marcos, desbordes en 360/390/1440 claro y oscuro, cero errores de consola); 9 capturas inspeccionadas.
- **No verificado:** la app real (la red del contenedor bloqueó `onza-demo.vercel.app` y `*.supabase.co`; el conector de Supabase ve otra organización); teléfonos físicos, lector de pantalla real, sonido/vibración/Wake Lock en dispositivo; coordenadas, fotos y logos de los bares (OSM, Wikimedia y sitios bloqueados; quedaron `null`, sin inventar). El "hero adjunto" no llegó a la sesión; referencia: acceso actual del repo. No se ejecutó `npm run check` porque no cambió código de la app.
- **Decisiones:** diseño F1 delegado por Manu y sujeto a su revisión; propuestas P-1–P-7 sin aprobar; sin dependencias nuevas (NumberFlow queda como P-7). Bares reales con fuentes, sin relación comercial ni autorización; permisos pendientes antes del lanzamiento.
- **Pendientes / siguiente paso:** revisión visual de Manu; decidir P-1–P-7 y `GUIA.md` §9; luego F2. Bloqueos para F5–F7 en `docs/plan-v1.md` §9 (red, acceso a `onza-dev`, `SUPABASE_SERVICE_ROLE_KEY` de servidor en Vercel, fotos/logos).

### D-2026-11-17-04 · Publicar y comprobar el acceso visual

- **Fecha y hora:** 2026-11-17 00:27 (America/Costa_Rica)
- **Persona:** Manu
- **IA:** Codex · GPT-6 (identificador exacto no expuesto)
- **Rama y commits:** `fix/hosted-integration` · `346df98` código publicado; cierre documental en el commit de esta entrada (hash en git log).
- **Qué cambió:** push del hito y del cierre local previo preservado. Vercel generó automáticamente el Preview `dpl_DKAJXz6f2NgWYEPjHdMnc7DvpcFS`, READY, SHA exacto `346df9830520821bb0951385bcedf577bca6fc54`, target=null, source=git. Alias habitual actualizado automáticamente. Sin despliegue manual, cambios de configuración, Supabase, main ni recursos nuevos.
- **Verificado:** 28 controles puntuales HTTPS contra `https://onza-demo.vercel.app`, iguales al alcance visual local; capturas de escritorio/móvil inspeccionadas. Login real por correo de la cuenta demo existente hasta `/v/sala-norte`, destino QR conservado; limpieza de WebGL al navegar al portal laboral; teclado, scroll, Apple deshabilitado, invocación OAuth interceptada, reduced motion, visibilidad simulada y fallos WebGL. Cero errores de ejecución. JSON en `docs/evidence/access/hosted-*.json`.
- **No verificado:** Google completo, correo real de confirmación/recuperación, teléfonos físicos. No se ejecutaron flujos de pedido ni suites ajenas al cambio.
- **Pendientes / siguiente paso:** prueba física de Manu; ningún bloqueo de publicación pendiente.

### D-2026-11-17-03 · Rediseñar el acceso con Particle Wave original

- **Fecha y hora:** 2026-11-17 00:23 (America/Costa_Rica)
- **Persona:** Manu
- **IA:** Codex · GPT-6 (identificador exacto no expuesto)
- **Rama y commits:** `fix/hosted-integration` · commit de esta entrada, hash en git log; `dde9764` previo conservado.
- **Qué cambió:** solo acceso cliente y fondo reutilizable. Component.tsx original de Hossain Jahed suministrado por Manu: mismas ecuaciones, puntos cuadrados, cámara y grilla de escritorio; oxblood, velocidad 60% con delta time, fade ligado al alto del titular. SVG originales del vaso y wordmark, ivory sobre negro; Google, Apple deshabilitado y correo desplegable con registro/recuperación; portal laboral conservado. Densidad/DPR móvil limitados, pausa oculta, reduced motion estático, liberación de WebGL y fallback negro. Sin cambios de Supabase, banderas, permisos, pedidos ni main.
- **Archivos clave:** `src/components/backgrounds/particle-wave.tsx`, `src/app/acceso/`, `src/features/account/components/auth-form.tsx`, tokens de acceso, dependencias y atribución en `THIRD_PARTY_NOTICES.md`. Verificador existente adaptado para abrir correo; sin suites nuevas.
- **Verificado:** `npm run typecheck`, `npm run build`, ESLint de los TSX modificados y del verificador, Prettier y `git diff --check`. Chromium contra build local: 28 controles puntuales, capturas 1440×900 y 390×844 inspeccionadas, 320 px sin desborde, scroll al abrir correo, foco de teclado, registro/validación/recuperación, OAuth con destino conservado (navegación interceptada), reduced motion, visibilidad simulada, pérdida/fallo WebGL y cero errores de ejecución. Limpieza de buffers/programa/contexto al navegar y login real con cuenta demo existente hasta el menú de destino. Evidencia en `docs/evidence/access/`.
- **No verificado:** todavía publicación de este cambio; Google completo y correos reales, teléfonos físicos. No se repitieron auditorías de pedidos ni la suite global, por alcance explícito.
- **Decisiones:** código de 21st.dev bloqueado en la consulta inicial; no se fabricó sustituto. Se retomó únicamente tras recibir el original. Revisión estática independiente: se corrigió ubicación del error de correo para que quede junto al envío en móvil.
- **Pendientes / siguiente paso:** push y verificación del despliegue existente, con Preview manual del mismo proyecto solo si el automático no aparece. Sin recursos nuevos ni pagos.

### D-2026-11-16-06 · Activar cuentas en el demo existente y verificar retiro

- **Fecha y hora:** 2026-11-16 22:00 (America/Costa_Rica)
- **Persona:** Manu
- **IA:** Codex · GPT-6 (identificador exacto no expuesto)
- **Rama y commits:** `fix/hosted-integration` · `d2de7de` desplegado; cierre documental local posterior (hash en git log).
- **Qué cambió:** fetch/pull --ff-only desde árbol limpio; migración aditiva 010 aplicada únicamente a onza-dev tras dry-run. Cliente demo con correo separado preparado mediante seed existente. Auth callbacks y variables Preview configurados conservando secretos y propiedades previas. Cuentas obligatorias activadas después de migración/cuentas; pagos mock, escenarios de prueba apagados. Nuevo Preview READY; alias onza-demo.vercel.app confirmado. Sin cambios al código de aplicación ni a main.
- **Archivos clave:** `docs/vercel-demo.md`, `scripts/verify-accounts-demo.mjs`, `docs/evidence/accounts-demo-verification.json`.
- **Verificado:** identidad onza-dev ukdjuubekpanizcmppod; dry-run posterior sin pendientes; build Vercel READY dpl_BvikC3oVNDNYytjyLGeBUgk374fU para SHA d2de7de55c821a50c761d997f7c57d30c31631d7. Dieciséis controles HTTPS reales en dos contextos independientes, login por formularios, onboarding con datos ficticios, pedido/refresco, preparar/listo, número público rechazado, retiro privado, entrega y código consumido rechazado; separación cliente/equipo; cero errores de navegador. Script revisado con node --check y ESLint. No se repitieron las 88 pruebas ni se generaron galerías.
- **No verificado:** teléfonos físicos, cámara/audio/GPS, correos reales y Google. La confirmación de entrega fue simulada en navegador, sin bebida física.
- **Decisiones:** conector Vercel devolvió 403 para variables; CLI local autorizada permitió configurarlas sin imprimir secretos. Se conservaron confirmación por correo, contraseñas previas, clave de tickets y controles de protección. El primer intento del verificador se detuvo por dos botones Ingresar; se acotó el selector al formulario, sin cambiar la aplicación.
- **Pendientes / siguiente paso:** prueba física de Manu. Google/SMTP, borrado de cuenta, textos legales, R5/R6 y otros pendientes permanecen explícitos; fuera de este encargo.

### D-2026-11-17-02 · Integrar el diseño aprobado: cuentas, onboarding y portal del equipo (detrás de bandera)

- **Fecha y hora:** 2026-11-17 (America/Costa_Rica)
- **Persona:** Manu
- **IA:** Claude Code · `claude-sonnet-5-5`
- **Rama y commits:** `fix/hosted-integration` · hash en `git log` (commit de esta entrada)
- **Qué cambió:** acceso `/acceso` (correo+contraseña con confirmación, Google, Apple deshabilitado "Próximamente", recuperación, "¿Sos personal?"), `/onboarding` (nombre, @usuario único, teléfono +506 no verificado, nacimiento con 18+ validado en SQL, condiciones con fecha y versión, dos preferencias desmarcadas), `/cuenta` (apariencia, preferencias, privacidad), `/equipo/acceso` (portal laboral; `/login` y `/settings` redirigen), `/sesion-activa` (sesión del tipo equivocado: continuar o usar otra cuenta, sin cierre automático). Política de acceso en `src/proxy.ts` + `src/lib/access-policy.ts`; QR conserva destino con `next`. Servidor: las cuentas con membresía nunca crean pedidos; con la bandera, hace falta sesión no anónima y perfil. Retirados los selectores de "resultado simulado" (cliente y barra); el servidor fuerza `approved` salvo `ENABLE_PAYMENT_SCENARIOS=true` (solo pruebas). Migración **aditiva** `202611170010_customer_accounts.sql` (tabla `profiles`, RPC `current_account`, `complete_onboarding`, `update_preferences`). Todo detrás de `ACCOUNTS_REQUIRED` (apagado por defecto): sin la variable el demo desplegado conserva el flujo invitado (R4). Reutilizados backend de pedidos, Realtime, retiro con código privado, cancelación antes de aceptación e idempotencia, sin cambios.
- **Archivos clave:** `supabase/migrations/202611170010_customer_accounts.sql`, `src/proxy.ts`, `src/lib/access-policy.ts`, `src/lib/account.ts`, `src/features/account/`, `src/app/{acceso,onboarding,cuenta,sesion-activa,equipo,auth,confirmar,recuperar,restablecer}`, `src/features/orders/server/order-service.ts`, `tests/db/accounts.test.ts`, `tests/lib/access-policy.test.ts`, `docs/vercel-demo.md`.
- **Verificado (offline, en este entorno):** `tsc --noEmit`, `eslint`, `vitest` completo (26 archivos, 88 pruebas: +6 SQL de cuentas y recorrido con dos sesiones registradas independientes —cliente→barra acepta→listo→número público no retira→código privado entrega una sola vez; cancelación solo antes de aceptar; otra cuenta no ve el pedido—, +8 de política de acceso), `next build`. Pantallas `/acceso`, `/recuperar`, `/equipo/acceso` renderizadas en 360/390/1440, claro/oscuro, sin desborde.
- **No verificado:** este entorno no alcanza `*.supabase.co` ni Vercel y no tiene credenciales; el Supabase MCP conectado pertenece a otros proyectos y no se tocó. Por eso: la migración **no está aplicada** a `onza-dev`, **no hay deploy nuevo**, no se corrió el recorrido E2E con dos navegadores contra Supabase real, ni confirmación por correo, Google, `/auth/callback` ni onboarding en vivo; tampoco la revisión visual de menú y barra con datos reales ni pruebas en teléfono. Las pruebas SQL (PGlite) no sustituyen a Supabase real.
- **Decisiones:** el tipo de cuenta lo decide la base (membresía), no el navegador ni metadatos. Staff creado fuera del autoservicio. Google solo en el acceso de clientes. Borrado de cuenta (R3), nueva versión de condiciones (R5) y borrador tras sesión vencida (R6) quedan sin implementar.
- **Pendientes / siguiente paso:** ver `docs/vercel-demo.md` ("Cuentas de cliente y portal del equipo"): aplicar migración 010, desplegar, `npm run demo:seed-users` con `DEMO_CUSTOMER_*`, Redirect URLs de Auth, luego `ACCOUNTS_REQUIRED=true` y redeploy; después ejecutar el recorrido real en teléfono + computadora y ajustar menú/barra al boceto; R3, R5, R6; Google y SMTP propio.


### D-2026-11-17-01 · Consolidar decisiones y bocetos navegables (sin tocar la app)

- **Fecha y hora:** 2026-11-17 (America/Costa_Rica)
- **Persona:** Manu
- **IA:** Claude Code · `claude-sonnet-5-5`
- **Rama y commits:** `fix/hosted-integration` sobre `820faec` · sin commit ni push (cambios en el árbol de trabajo; ZIP entregado aparte)
- **Qué cambió:** **Documentación (E0):** sección 0 nueva en `Onza-Product-Blueprint-v3.md` con lo acordado, dependencias manuales, lo implementado/verificado (con la evidencia existente) y lo pendiente, más las reglas R1–R6 (identidades personal/laboral y linking de Auth, acceso equivocado, borrado de cuenta, migraciones expandir→desplegar→contraer, nuevas condiciones, logout vs. sesión vencida). Secciones contradictorias marcadas como históricas; `AGENTS.md` apunta al blueprint; `Onza-UX-v2.md` y `docs/hosted-ux-plan.md` con aviso/plan vigente. **Bocetos (E1):** prototipo estático en `design/bocetos/` (cliente, cuenta, equipo, barra y administración) con datos ficticios en memoria. **Son bocetos para aprobar, no funciones implementadas**; la app no cambió.
- **Archivos clave:** `Onza-Product-Blueprint-v3.md` (sección 0), `AGENTS.md`, `docs/hosted-ux-plan.md`, `design/bocetos/` (README, `index.html`, `assets/`, `capturas/`).
- **Verificado:** en Chromium (Playwright) recorrido cliente completo con guardas de sesión, carrito de un local con reemplazar/conservar, dock solo en el local dueño, ciclo Recibido→Preparando→Listo→Entregado con la barra, validación de retiro (número público rechazado, código inválido, código correcto), cancelación solo antes de aceptación, sesión equivocada sin cierre automático, empleado sin acceso a compra ni a administración. Sin desbordes horizontales en 360, 390 y 1440 px, claro y oscuro, en las 24 pantallas; sin errores de consola. Capturas inspeccionadas.
- **No verificado:** no se ejecutó la suite de la app (no se tocó código de producto). Los bocetos no se probaron en teléfonos físicos ni con lector de pantalla. Lo descrito como "implementado" en el blueprint se tomó de entradas y evidencia previas; no se re-ejecutó. Comportamiento exacto del linking de Supabase: a confirmar en su documentación antes de implementar R1.
- **Decisiones:** el plan canónico es `docs/hosted-ux-plan.md` (nueva sección "Plan vigente 2026-11-17"). Las reglas R1–R6 se especifican, no se implementan. Los textos legales del boceto son de ejemplo.
- **Pendientes / siguiente paso:** Manu aprueba o ajusta los bocetos. Después, etapas E2–E6 del plan solo con autorización expresa, empezando por una migración aditiva (R4). Dependencias manuales en la sección 0.3 (Google OAuth, SMTP propio, URLs de Auth, textos legales).


### D-2026-11-16-05 · Publicar y comprobar el Preview del hito

- **Fecha y hora:** 2026-11-16 13:23 (America/Costa_Rica)
- **Persona:** Manu
- **IA:** Codex · modelo exacto no registrado
- **Rama y commits:** `fix/hosted-integration` · `e1e8987` publicado; esta entrada/evidencia se incorpora en el cierre documental posterior (hash en git log).
- **Qué cambió:** Preview actualizado en el proyecto existente onza-demo desde el código revisado. No se modificaron settings, variables, automatizaciones, protección o recursos. README e informe enlazan la URL probada y distinguen las limitaciones físicas.
- **Verificado:** GitHub Actions [43937917513](https://github.com/msalas0810/onza/actions/runs/43937917513): checks y supabase-integration exitosos. Vercel `dpl_3m1TeU5CtKXozzjJKtBDmYDFtjn4` READY y target=null (Preview), commit exacto e1e8987. Nueve controles HTTPS entre dos sesiones reales: checkout mock, aceptar/preparar/listo, ticket privado, número público rechazado, campo de personal vacío, validación manual, cobro mock/entrega y código consumido rechazado; cero errores de ejecución. Evidencia `docs/evidence/hosted-ux/preview-verification.json`. Comparación administrativa confirma proyecto, deployment de producción, rama production, automatizaciones y protección intactos. Escaneo exacto de credenciales locales sobre los 75 archivos del hito: cero coincidencias; .env.local ignorado.
- **No verificado:** GPS/cámara/audio/safe areas de dispositivos físicos. No se promete funcionamiento en segundo plano ni cobros reales. No se reprodujo la ausencia original del ticket ni React/use.
- **Decisiones:** la auto-revisión rechazó inicialmente target=staging; no creó despliegue. La API rechazó también el literal preview. Se consultó la documentación oficial: omitir target crea Preview. Esa solicitud explícitamente corregida creó solo el Preview autorizado, sin personalizaciones de entorno ni producción.
- **Pendientes / siguiente paso:** abrir el Preview en teléfono como cliente y en otro perfil de computadora como personal; probar QR/código presentado por el cliente. Los locales demo no tienen coordenadas reales: buscar por nombre es el comportamiento inmediato correcto.


### D-2026-11-16-04 · Corregir retiro, carrito y flujos compartidos

- **Fecha y hora:** 2026-11-16 13:13 (America/Costa_Rica)
- **Persona:** Manu
- **IA:** Codex · modelo exacto no registrado
- **Rama y commits:** `fix/hosted-integration` · sin commit al redactar; el cierre posterior registra el hash real del hito.
- **Qué cambió:** retiro con credencial privada de 12 caracteres, distinta del número público, sin precarga en barra; validación SQL con límite de intentos y consumo único. Ticket recuperable y fallback de QR sin cambiar claves. Carrito editable, dock contextual, cambio explícito de local. Explorar ordenado por disponibilidad, ubicación efímera opcional y coordenadas administrables. Ajustes de tema, navegación por contexto y menú/seguimiento compactos. Realtime principal con recuperación acotada y vencimiento puntual.
- **Archivos clave:** `docs/hosted-ux-plan.md`, `docs/hosted-ux-verification.md`, migraciones 008/009, `src/features/{orders,pickup,catalog}`, componentes UI compartidos.
- **Verificado:** `npm run check` (typecheck/lint/74 pruebas/build); 11 casos E2E relevantes aprobados contra onza-dev (con reejecución específica del caso de layout corregido), 7 controles de componentes. Carrera real de tres pedidos con un ganador por pedido; captura repetida/conciliación/recuperación UI; consumo de código, permisos y 29 controles alojados, incluyendo Storage real y restauración. Cliente 360/390/1440 y personal/admin en ambos temas, sin overflow. Cinco capturas, ticket redactado. Revisión independiente estática sin bloqueos.
- **No verificado:** GPS, cámara, audio y safe areas de teléfonos físicos. Geolocalización del navegador emulada para permisos/timeout/imprecisión; ranking con coordenadas solo en fixtures unitarias, porque los locales demo no tienen coordenadas reales. No se reprodujo el error histórico React/use. Publicación/CI/Preview pendientes del cierre.
- **Decisiones:** proyecto real confirmado `onza-dev`; 005–007 ya aplicadas, distinto del diario anterior. Solo nuevas migraciones 008/009, sin reset. 19 tickets cifrados válidos legibles, cuatro payloads históricos malformados, ninguno activo; sin fallos de autenticación AES y sin rotar clave. El número público ya no reclama retiros, pero complete/capture conservan replays idempotentes del responsable validado. Detectado rechazo de Origin en alias actuales: allowlist exacta de URLs asignadas por Vercel al Preview, conservando APP_ORIGIN y sin cambiar configuración.
- **Pendientes / siguiente paso:** cierre de publicación, CI y Preview. Después validación en dispositivos físicos y datos reales de locales. Ver informe para límites exactos.


### D-2026-11-16-03 · Imagen editable para cada trago, en la lista de tragos de cada bar

- **Fecha y hora:** 2026-11-16 ~02:45 (America/Costa_Rica)
- **Persona:** dueño del proyecto
- **IA:** Claude Code · `claude-sonnet-5-5`
- **Rama y commits:** `fix/hosted-integration` · `5b6acc7` (código, migración, pruebas, ilustraciones); el commit siguiente trae esta entrada, el README, `docs/implementation-status.md` y las capturas
- **Qué cambió:** `products.image_url` y la función `update_product_image` (solo admin del local dueño del trago; solo acepta `product-*` en la carpeta del propio local del bucket `venue-images`, con los mismos límites y políticas que las imágenes de bares). El editor de trago de la administración sube, cambia y quita la imagen; la lista de tragos de cada bar y la página del trago la muestran en marco fijo con bordes redondeados y marcador de posición. Seis ilustraciones originales por tipo de trago y un seed idempotente que asigna una a cada trago demo.
- **Archivos clave:** `supabase/migrations/202611160007_product_images.sql`, `src/features/catalog/components/product-image.tsx`, `src/features/admin/components/product-editor.tsx`, `scripts/seed-product-images.mjs`, `public/demo-products/`.
- **Verificado:** `tsc`, `eslint` y `next build` sin errores; `vitest`: 62 pruebas pasan (16 nuevas); Playwright: 61 pasan y 2 se omiten como antes. Permisos: un admin no puede cambiar tragos de otro local (en ambos sentidos), ni bartender, invitado o anon; probado con mutaciones que fallan si se debilita la migración. Marco de 88 × 110 px con radio ≥ 12 px con y sin imagen en 5 anchos, claro y oscuro; imagen rota y ausente; capturas de la lista y el detalle reales con datos ficticios en `docs/evidence/product-*.png`.
- **No verificado:** nada contra `onza-dev`: las pantallas reales se renderizaron contra un servidor REST falso. No se probó la subida real a Storage ni el guardado desde una sesión de admin, ni los límites de tamaño y MIME del bucket. La rama "el trago se guardó pero la imagen falló" está implementada y sin probar de extremo a extremo. Dispositivos físicos.
- **Decisiones:** se reutilizó el bucket y las políticas de Storage existentes (sin migración de Storage nueva). La imagen no sube `products.version` para no invalidar carritos. El campo antiguo de foto de 5 MB (`photo_path`) salió del editor, pero se sigue mostrando como respaldo hasta que el admin suba una imagen nueva. El conector de Supabase de esta sesión sigue viendo otra organización, así que no se aplicó nada a `onza-dev`.
- **Pendientes / siguiente paso:** PEN-007 y PEN-008. Desde la computadora con la CLI autenticada: `npm exec supabase -- db push --remote=ukdjuubekpanizcmppod --dry-run --skip-vault` (revisar el listado), luego sin `--dry-run` y con `--yes`, y `npm run demo:seed-product-images` (y `demo:seed-venue-images` si no se corrió).

### D-2026-11-16-02 · Portada y logo editables por cada bar, con tarjeta nueva

- **Fecha y hora:** 2026-11-16 ~02:30 (America/Costa_Rica)
- **Persona:** dueño del proyecto
- **IA:** Claude Code · `claude-sonnet-5-5`
- **Rama y commits:** `fix/hosted-integration` · `3f58c54` (código, migraciones, pruebas, arte demo); el commit siguiente trae esta entrada, el README, `docs/implementation-status.md` y las capturas
- **Qué cambió:** tarjeta de local con portada y fade a oscuro, logo cuadrado redondeado en la esquina inferior izquierda y, a su derecha, nombre, ubicación opcional y "Ver tragos →"; se quitó el badge Abierto/Cerrado. Nueva pestaña Perfil en la administración (portada, logo, nombre y ubicación, con vista previa). Placeholders si falta la imagen o no carga. Migraciones aditivas: columnas `cover_url`/`logo_url`, función `update_venue_branding` y bucket público `venue-images` (2 MB, jpg/png/webp) con escritura solo para admins del local dueño de la carpeta. Arte demo original y seed idempotente.
- **Archivos clave:** `supabase/migrations/202611160005_venue_images.sql`, `...0006_venue_images_storage.sql`, `src/features/catalog/components/venue-card.tsx`, `src/features/admin/components/venue-profile.tsx`, `src/features/admin/venue-image.ts`, `scripts/seed-venue-images.mjs`, `public/demo-venues/`.
- **Verificado:** `tsc`, `eslint` y `next build` sin errores; `vitest`: 46 pruebas pasan (23 nuevas); Playwright: 41 pasan y 2 se omiten como antes. Incluye aislamiento (un admin no toca nombre, ubicación ni imágenes de otro local; bartender, invitado y anon tampoco), políticas de Storage sobre un esquema `storage` simulado, validación de archivos, contraste medido y capturas de la home en móvil y escritorio, claro y oscuro (`docs/evidence/venue-list-*.png`). Las pruebas de aislamiento se comprobaron con mutaciones: fallan si se debilita la migración.
- **No verificado:** nada contra `onza-dev`. La home real se renderizó contra un servidor REST falso, no contra Supabase. No se probó la subida real a Storage ni el guardado con una sesión de admin, ni los límites de tamaño y MIME del bucket (los aplica el servicio Storage). Dispositivos físicos.
- **Decisiones:** el conector de Supabase de esta sesión ve otra organización (proyectos "Pedidos SaaS" y "pedidos-staging", no `onza-dev`), así que no se aplicó nada a ciegas. Nombre y ubicación se editan solo en Perfil (salieron de Ajustes). Se guarda la URL pública y la función SQL solo acepta URLs del bucket y de la carpeta del propio local. SVG excluido por poder contener scripts. El seed no pisa imágenes que un admin haya subido.
- **Pendientes / siguiente paso:** PEN-007 y PEN-008. Para `onza-dev`, desde la computadora con la CLI autenticada: `npm exec supabase -- db push --remote=ukdjuubekpanizcmppod --dry-run --skip-vault` (debe listar solo `0005` y `0006`), luego sin `--dry-run` y con `--yes`, y `npm run demo:seed-venue-images`.

### D-2026-11-16-01 · Crear el diario de cambios y el protocolo de lectura para IA

- **Fecha y hora:** 2026-11-16 (hora no registrada)
- **Persona:** dueño del proyecto (colaborador de `msalas0810/onza`)
- **IA:** Claude Code · `claude-sonnet-5-5` (sesión en la nube, repo clonado de `main`)
- **Rama y commits:** `docs/diario-de-cambios`, creada desde `fix/hosted-integration` (`bdda420`) · el hash de este commit lo da `git log` (no se puede escribir dentro del propio commit)
- **Qué cambió:** se creó este diario y se hizo obligatorio leerlo antes de programar. `AGENTS.md` (Codex y otros) y `CLAUDE.md` (Claude Code) ahora mandan a leerlo primero. La plantilla de PR pide registrar la entrada.
- **Archivos clave:** `DIARIO.md`, `AGENTS.md`, `CLAUDE.md`, `.github/pull_request_template.md`.
- **Verificado:** se leyó la documentación completa del repo (`README`, `AGENTS`, `CONTRIBUTING`, `docs/01` a `05`, `implementation-status`, `github-vercel`, `review-notes`, `local-execution-plan`, `VALIDACION`) y la estructura de `src/`, `supabase/`, `scripts/`.
- **No verificado:** no se corrió ninguna prueba ni la app; este cambio es solo documentación. Sí se comprobó con `git ls-remote` que `fix/hosted-integration` está en `bdda420` y que `main` sigue en `cd0faa6`. No se comprobó el estado de CI. El dueño confirmó que el demo desplegado es `bdda420` (Ready en Vercel); eso no se verificó desde esta sesión.
- **Decisiones:** un solo archivo en la raíz para que sea imposible no verlo. El historial previo se reconstruyó **solo** de lo que el dueño pegó en el chat, y está marcado como tal.
- **Pendientes / siguiente paso:** retomar **INC-001**. El diario se integró a `fix/hosted-integration` por squash merge (sin PR). La rama remota `docs/diario-de-cambios` **no se pudo borrar desde la sesión** (el proxy bloquea el borrado) y debe borrarla el dueño en GitHub. Falta integrar `fix/hosted-integration` a `main`, solo por PR y con decisión del dueño.

### D-2026-11-16-00 · Desplegar el demo en Vercel *(reconstruida)*

- **Fecha y hora:** 2026-11-16 ~00:23 (America/Costa_Rica)
- **Persona:** dueño del proyecto
- **IA:** no registrado (sesión en el entorno local del dueño)
- **Rama y commits:** `fix/hosted-integration` · `ee82a7b` según el reporte original. El dueño luego confirmó que el demo desplegado es `bdda420` (Ready en Vercel)
- **Qué cambió:** demo desplegado en Vercel contra el mismo Supabase `onza-dev`, pagos mock. Sin merge a `main`, sin base nueva, sin recursos pagados.
- **Archivos clave:** `docs/github-vercel.md`, `docs/implementation-status.md`.
- **Verificado (según el reporte de la sesión):** catálogo, sesión invitada, pedido, reserva mock, persistencia al refrescar, login del bartender y Realtime por WebSocket sobre HTTPS.
- **No verificado:** retiro con código y validación de entrega. El dueño reportó que no apareció el código y que la entrega no pidió validación (**INC-001**).
- **Decisiones:** el Preview conserva la protección de acceso de Vercel.
- **Pendientes / siguiente paso:** INC-001.
- *Fuente: texto pegado por el dueño en el chat. No se verificó contra el repo.*

### D-2026-11-15-02 · Conectar Supabase `onza-dev` y verificar el flujo real *(reconstruida)*

- **Fecha y hora:** 2026-11-15, noche (America/Costa_Rica)
- **Persona:** dueño del proyecto
- **IA:** no registrado
- **Rama y commits:** `fix/hosted-integration` (publicada en GitHub; sin hashes registrados)
- **Qué cambió:** migraciones aplicadas al proyecto alojado, Auth anónimo, Realtime y permisos explícitos con RLS, datos ficticios y usuarios demo idempotentes.
- **Verificado (según el reporte):** flujo completo entre sesiones, persistencia, dobles envíos y dobles capturas; Realtime por WebSocket; 19 controles de permisos y aislamiento; 28 vistas móvil/escritorio en claro y oscuro; 23 pruebas de dominio y 2 E2E reales; typecheck, lint y build.
- **No verificado:** dispositivos físicos, fotos finales, CI. El error React `use()` quedó como "no reproducido" (**PEN-001**).
- **Pendientes / siguiente paso:** ver "Pendientes abiertos".
- *Fuente: texto pegado por el dueño en el chat.*

### D-2026-11-15-01 · Construir las seis etapas del MVP local *(reconstruida)*

- **Fecha y hora:** 2026-11-15 ~21:41 a 22:32 (America/Costa_Rica); duración informada 50 min
- **Persona:** dueño del proyecto
- **IA:** no registrado (el prompt se llama `PROMPT-CODEX-MVP-LOCAL.md`)
- **Rama y commits:** `feat/local-mvp` · cuatro commits locales, `2fc5335` es el último de código; el último de `main` clonado es `cd0faa6`
- **Qué cambió:** cliente, checkout mock, seguimiento, barra, retiro por QR o código y administración. Migraciones con RLS, seeds, CI y documentación para GitHub y Vercel.
- **Archivos clave:** `src/`, `supabase/migrations/202611150001_core.sql` a `...0003_platform.sql`, `supabase/seed.sql`, `docs/implementation-status.md`.
- **Verificado (según el reporte):** typecheck, lint y build; 23 pruebas de dominio y SQL; 16 pruebas de navegador.
- **No verificado:** aceptación multiusuario con Supabase real (no había Docker ni proyecto). 2 pruebas E2E omitidas a propósito.
- *Fuente: texto pegado por el dueño y `docs/implementation-status.md`.*

### D-2026-11-14-00 · Kit de planificación y especificación *(reconstruida)*

- **Fecha y hora:** anterior al 2026-11-15; `VALIDACION.md` está fechado el 2026-11-16 (sin concordancia confirmada)
- **Persona:** dueño del proyecto
- **IA:** no registrado
- **Rama y commits:** `main` · sin hash registrado
- **Qué cambió:** especificación `docs/01` a `docs/06`, marca SVG, tokens de diseño, fuente Inter, fixtures, contratos TypeScript y prompts de ejecución.
- **Verificado:** según `VALIDACION.md`, 42 pares de contraste, 8 SVG y fixtures; todo es del paquete de planificación, no de una app.
- *Fuente: `VALIDACION.md` y `README.md`.*
