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
| Rama vigente de trabajo | `fix/hosted-integration`. Código activado: `d2de7de`; cierre documental local posterior en git log. Sin merge a `main` |
| `main` | En `cd0faa6`, igual que `feat/local-mvp`: conserva el MVP local anterior. Integración solo por PR, sin merge automático |
| Commit desplegado en Vercel | `d2de7de` en `fix/hosted-integration`, Preview **READY**, deployment `dpl_BvikC3oVNDNYytjyLGeBUgk374fU`; cuentas activadas y 16 controles HTTPS aprobados |
| Demo desplegada | https://onza-demo.vercel.app (alias comprobado del Preview vigente; protección existente preservada, sin SSO obligatorio) |
| Backend | Supabase alojado `onza-dev`, pagos **mock** |
| Pagos reales | Deshabilitados. `BacPaymentProvider` falla explícitamente |
| Siguiente tarea exacta | Probar cliente en teléfono físico y bartender en computadora con las cuentas locales (docs/vercel-demo.md). Migración 010 aplicada y ACCOUNTS_REQUIRED=true. Google/SMTP, borrado de cuenta, revisión legal, R5/R6, dispositivos físicos y pagos reales siguen pendientes; no implementar sin encargo. |

### Pendientes abiertos

| ID | Pendiente | Desde |
| --- | --- | --- |
| INC-001 | Vía de retiro con número público cerrada y comprobada en dos sesiones reales; código privado y recuperación de ticket implementados. La ausencia original del ticket no se reprodujo: 19 cifrados válidos se abrieron con la clave existente, sin rotación. Pendiente prueba física del dueño. Ver D-2026-11-16-04. | 2026-11-16 |
| PEN-001 | Error React `use()` de las capturas: quedó documentado como "no reproducido tras conectar Supabase", **no como corregido** | 2026-11-16 |
| PEN-002 | Pruebas en iPhone y Android físicos (cámara, audio, safe area, foreground) | 2026-11-15 |
| PEN-003 | Fotos finales con derechos de uso (hoy `photo_path=null`, fallback tipográfico) | 2026-11-15 |
| PEN-004 | CI del código `e1e8987` aprobado: jobs checks y supabase-integration, run 43937917513. Cierre documental posterior sin cambios de aplicación. | 2026-11-16 |
| PEN-005 | Scheduler durable para expiraciones; hoy el barrido corre solo cuando hay tráfico | 2026-11-15 |
| PEN-006 | Cobros reales: falta acuerdo y manual de BAC. Ver `docs/03-bac-y-pagos.md` | 2026-11-15 |
| PEN-007 | Corregido el registro: las migraciones 005–007 ya estaban aplicadas al iniciar esta sesión; 12 productos tenían imagen. Se aplicaron únicamente las nuevas 008/009. No se inventaron portadas ni coordenadas. | 2026-11-16 |
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
