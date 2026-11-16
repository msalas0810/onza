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
| Rama vigente de trabajo | `fix/hosted-integration`, punta en `bdda420` (verificado con `git ls-remote` el 2026-11-16). Aún **no** se mergeó a `main` |
| `main` | En `cd0faa6`, igual que `feat/local-mvp`: conserva el MVP local anterior. Integración solo por PR, sin merge automático |
| Commit desplegado en Vercel | `bdda420` en `fix/hosted-integration`, estado **Ready** (confirmado por el dueño el 2026-11-16; no se verificó desde esta sesión). El reporte original del despliegue citaba `ee82a7b`, que es anterior |
| Demo desplegada | https://onza-demo-msalas0810.vercel.app (Preview de Vercel, protegido por login de Vercel) |
| Backend | Supabase alojado `onza-dev`, pagos **mock** |
| Pagos reales | Deshabilitados. `BacPaymentProvider` falla explícitamente |
| Siguiente tarea exacta | Resolver la incidencia abierta **INC-001** (ver "Pendientes abiertos") |

### Pendientes abiertos

| ID | Pendiente | Desde |
| --- | --- | --- |
| INC-001 | En una prueba del dueño no apareció el **código de retiro** y la **entrega no pidió validación**. La prueba terminó en "Listo" y se canceló sin capturar ni entregar. **No está resuelto ni comprobado.** | 2026-11-16 |
| PEN-001 | Error React `use()` de las capturas: quedó documentado como "no reproducido tras conectar Supabase", **no como corregido** | 2026-11-16 |
| PEN-002 | Pruebas en iPhone y Android físicos (cámara, audio, safe area, foreground) | 2026-11-15 |
| PEN-003 | Fotos finales con derechos de uso (hoy `photo_path=null`, fallback tipográfico) | 2026-11-15 |
| PEN-004 | Resultado del CI de GitHub Actions (estaba en curso al registrar) | 2026-11-16 |
| PEN-005 | Scheduler durable para expiraciones; hoy el barrido corre solo cuando hay tráfico | 2026-11-15 |
| PEN-006 | Cobros reales: falta acuerdo y manual de BAC. Ver `docs/03-bac-y-pagos.md` | 2026-11-15 |

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
- **Pendientes / siguiente paso:** retomar **INC-001**. El diario se integró por merge a `fix/hosted-integration` (sin PR) y la rama `docs/diario-de-cambios` se borró. Falta integrar `fix/hosted-integration` a `main`, solo por PR y con decisión del dueño.

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
