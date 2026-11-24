# Onza

Web móvil para pedir en la barra y retirar con QR. Cliente, barra y administración del local sobre Next.js 16, React 19, TypeScript y Supabase. **Todo el dinero es simulado** (pagos mock); no hay cobros reales.

Opcional por local: **mapa interactivo de ubicación y entrega** sobre el plano propio del local o de cada edición de evento, sin GPS ni servicios externos de mapas (guía: [`docs/Onza-Mapa-interactivo.md`](docs/Onza-Mapa-interactivo.md)).

`main` es la única fuente de trabajo. El estado vigente y las decisiones están en [`DIARIO.md`](DIARIO.md); la guía técnica extensa, en [`docs/Onza-Guia-tecnica.md`](docs/Onza-Guia-tecnica.md).

## Clonar y correr

Requisitos: Node 24 (`.nvmrc`) y Git. Docker solo si querés Supabase local completo.

```sh
git clone https://github.com/msalas0810/onza.git
cd onza
nvm use
npm ci
cp .env.example .env.local   # nunca se versiona; ver abajo
npm run dev                  # http://127.0.0.1:3000
```

Sin Supabase podés revisar `/design-system` y los temas (con `ENABLE_DESIGN_SYSTEM=true` en `.env.local`). Para el flujo completo hay tres caminos:

- **Supabase local (recomendado):** con Docker abierto, `npm run db:start && npm run demo:configure && npm run demo:seed-users`. `demo:configure` crea `.env.local` con las claves de esa instancia local; nunca sobrescribe uno existente.
- **Servidor de verificación sin Docker:** `scripts/local-shim` (migraciones reales sobre PGlite). No es Supabase: sin Realtime, Storage ni correo. Uso en [`docs/Onza-Guia-tecnica.md`](docs/Onza-Guia-tecnica.md#verificación-local-del-flujo-completo-sin-supabase-remoto).
- **Un proyecto Supabase propio y aislado:** copiá `.env.example`, completá URL y clave publicable, y aplicá las migraciones de `supabase/migrations` con `npx supabase db push --dry-run` primero. No apuntes pruebas ni resets a una base compartida sin acordarlo con el equipo.

`.env.local` contiene secretos de servidor (`SUPABASE_SERVICE_ROLE_KEY`, `PICKUP_TOKEN_ENCRYPTION_KEY`, contraseñas demo): está en `.gitignore`, no lo compartas ni lo pegues en issues o chats. `service_role` nunca va como `NEXT_PUBLIC_*`.

## Verificar antes de un PR

```sh
npm run check                         # tipos, lint, pruebas y build
node scripts/audit/scan-secrets.mjs   # que no se cuelen secretos ni NEXT_PUBLIC_* peligrosos
```

`npm test` corre PostgreSQL real en WASM (PGlite) con roles y RLS. No prueba Auth, Realtime ni Storage reales; para eso hace falta Supabase local o un proyecto aislado. Las pruebas de concurrencia, migraciones y carga están en [`docs/Onza-Auditoria-seguridad-y-escala.md`](docs/Onza-Auditoria-seguridad-y-escala.md).

## Abrir un PR

1. Partí de `main` actualizado: `git switch main && git pull`.
2. Creá una rama `feat/<tarea>` o `fix/<problema>`. No se trabaja directo en `main`.
3. Commits pequeños y coherentes. Cambios de datos o RLS = **migración nueva** (no se editan las ya aplicadas) y tipos regenerados con `npm run db:types:offline`.
4. `npm run check` en verde, y una entrada en `DIARIO.md` (ver la plantilla del PR).
5. `git push -u origin <rama> && gh pr create` y pedí revisión a la otra persona del equipo. Más detalle en [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Despliegue

Vercel construye un Preview por rama. **El despliegue automático de `main` está desactivado en [`vercel.json`](vercel.json)** porque la base alojada todavía no tiene aplicadas las migraciones 013–024 que exige este código. Cuando se apliquen (primero en un proyecto aislado, con `db push --dry-run`) y se configuren las variables de Production, se elimina ese bloque de `vercel.json`. Aplicar migraciones remotas y cambiar variables lo hace una persona autorizada, no un script.
