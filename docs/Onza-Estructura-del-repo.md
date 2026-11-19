# Onza · Estructura del repo y ubicación canónica de archivos

Documento único de ubicaciones. Si cambia algo de lo que sigue, se cambia acá y en ningún otro lugar.

## Qué vive en el repo

| Qué | Dónde | Quién lo usa |
|---|---|---|
| Código de la app | `src/` | Next.js |
| Migraciones SQL y semillas | `supabase/migrations/`, `supabase/seed.sql` | Supabase, pruebas (PGlite), servidor de verificación |
| Pruebas | `tests/` (unidad e integración, PGlite), `tests/e2e/` (Playwright) | `npm test`, `npm run test:e2e` |
| Scripts de verificación y medición | `scripts/` (`verify-*.mjs`, `measure-*.mjs`, `local-shim/`) | A mano, contra el servidor de verificación local |
| Marca | `brand/svg/` (fuente de los SVG), `brand/fonts/` (Inter + licencia) | `scripts/check-kit.py` |
| Copia pública de marca y fuentes | `public/brand/`, `public/fonts/` | Runtime |
| Tokens de diseño | `design/tokens.json` → `design/tokens.css` (generado con `scripts/generate-tokens.py`) | Estilos |
| Maquetas vigentes de diseño | `design/maquetas-v1/` | Revisión de diseño |
| Documentación vigente | `docs/`, `DIARIO.md`, `Onza-Product-Blueprint-v3.md`, `AGENTS.md`, `CLAUDE.md` | Personas y agentes |
| Evidencia versionada | `docs/evidence/` | Referencia de verificaciones previas |

## Videos de acceso (los únicos que carga el runtime)

| Dispositivo | `/acceso` y `/equipo/acceso` cargan | Póster |
|---|---|---|
| iPhone y teléfonos Android | `public/access/access-mobile.mp4` (4,6 MB, 540×960) | `public/access/access-poster.jpg` |
| iPad (vertical y horizontal), iPadOS como Mac y escritorio | `public/access/access-horizontal.mp4` (1,5 MB, 1440×810) | `public/access/access-horizontal-poster.jpg` |
| Movimiento reducido o autoplay bloqueado | ninguno: solo el póster del dispositivo | ídem |

Un solo MP4 por carga. Ambos tienen el índice (`moov`) al inicio, así que empiezan a reproducirse sin esperar la descarga completa.

## Fuera del repo (no se versiona)

Originales de grabación, HTML de mockups aprobados, capturas de referencias de terceros, ZIP y PDF antiguos, transcripciones y capturas privadas. Se archivan en una carpeta local de archivo con un manifiesto de rutas originales, SHA-256 y motivo. Quien lo necesite lo pide al dueño del proyecto; no se suben al repo. Los bocetos antiguos de `design/bocetos/` están en el historial de git (antes del commit de higiene de noviembre de 2026).

## Generados e ignorados

`.next/`, `test-results/`, `playwright-report/`, `coverage/`, `*.tsbuildinfo` y `node_modules/` se regeneran con `npm run build`, `npm test` o `npm install`. Los archivos `.env*` locales se conservan y nunca se versionan; `.env.example` no contiene secretos.
