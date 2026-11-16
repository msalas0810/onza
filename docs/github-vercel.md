# GitHub y Vercel después

## Repositorio
La app vive en `onza-starter`, que es la raíz Git; el directorio padre contiene originales que se conservaron. Rama de trabajo `feat/local-mvp`. Revisá los commits locales y creá el remoto cuando lo decidas; no se creó remoto, hizo push ni abrió PR durante esta ejecución. Seguí CONTRIBUTING.md para dos desarrolladores.

## Importar después en Vercel
1. Subí el repositorio por el flujo acordado y seleccioná Import Project en Vercel. Si subís esta raíz, Root Directory es `.`; si incorporás todo el directorio padre a otro repo, será `onza-starter`.
2. Framework Next.js, Node 24, install `npm ci`, build `npm run build`; no usar export estático. No se necesita `vercel.json` ni disco persistente de Vercel.
3. Usá un proyecto Supabase **demo aislado** accesible por HTTPS. Aplicá migraciones en orden y seed SOLO a la base demo. Habilitá Anonymous Sign-ins. Provisioná staff con el script de seed en tu equipo; no incluyás credenciales de roles en el bundle.
4. Configurá NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para ese proyecto. Configurá en servidor DEMO_MODE=true, PAYMENT_PROVIDER=mock, REAL_PAYMENTS_ENABLED=false, PICKUP_TOKEN_ENCRYPTION_KEY y PICKUP_TOKEN_KEY_VERSION. APP_ORIGIN debe coincidir exactamente con el origen HTTPS del deployment; evitá barra final. En previews, configurá su origen exacto antes de probar POSTs. No es una whitelist de permisos de usuario.
5. NO copies SUPABASE_SERVICE_ROLE_KEY, DEMO_*_PASSWORD ni variables E2E a Vercel; solo las necesita el setup local. ENABLE_DESIGN_SYSTEM=false en cualquier entorno compartido. Protegé el demo compartido con acceso de deployment y contraseñas fuertes de staff.
6. En Auth de Supabase, Site URL = URL estable del demo. Agregá los redirect URLs exactos de staging/previews que uses; eliminá previews viejas. Evitá wildcards abiertos; la app actual usa invitado/password y no implementa OAuth. Cada preview debe usar datos demo o un proyecto aislado, nunca producción.
7. Pedidos/pagos mock viven en PostgreSQL; fotografías en Supabase Storage. El filesystem efímero de Vercel no guarda pedidos ni claves. Conservá la clave de cifrado entre despliegues: cambiarla sin migrar tickets impide reconstruirlos. Rotación con migración/re-cifrado previo, no cambiar solo la variable.
8. Corré todo el guion real en perfiles separados, RLS, concurrencia, reconexión y teléfonos físicos. Los jobs CI se diseñaron con Supabase local y sin secretos productivos; aún no se ejecutaron en GitHub.

## Producción con dinero
Esta versión **no** habilita producción de cobros. Cambiar flags no implementa BAC. Falta acuerdo/manual bancario, proveedor aprobado, scheduler y conciliación durables, notificaciones externas si se prometen, políticas operativas, respaldo/restauración y pruebas físicas. No conectar credenciales de producción a la base demo ni usar su seed. Ver docs/03-bac-y-pagos.md.

Fuentes oficiales consultadas: [Supabase CLI local](https://supabase.com/docs/guides/local-development/cli/getting-started), [URLs de Auth](https://supabase.com/docs/guides/auth/redirect-urls), [SSR con cookies](https://supabase.com/docs/guides/auth/server-side/creating-a-client). [Migración a Supabase CLI v3](https://supabase.com/docs/guides/local-development/cli/migrating-to-v3). El proveedor email permanece habilitado para login del staff; no confundirlo con permisos de personal. La implementación usa Next 16 (Proxy); las guías versionadas vienen también en node_modules/next/dist/docs.
