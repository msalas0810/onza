# Colaborar entre dos desarrolladores

`main` es la rama de integración y la única fuente de trabajo (https://github.com/msalas0810/onza). Creá ramas `feat/<tarea>` o `fix/<problema>` desde main actualizado. Hacé PRs pequeños y pedí revisión al otro desarrollador. No desarrollen ambos en la misma rama ni compartan `.env.local`.

Antes de cada PR: `npm ci`, `npm run check` y pruebas E2E que correspondan. Agregá migración nueva al cambiar datos o RLS, regenerá tipos y documentá el resultado real en `docs/implementation-status.md`. Una vez compartidas, no editen migraciones ya aplicadas. El seed es para bases demo desechables.

Cada desarrollador usa su propio Supabase local con Docker o un proyecto demo separado. No apunten pruebas/reset a una base compartida sin acordarlo. Los resets eliminan pedidos y usuarios locales; las fotos de Storage requieren su propio respaldo. No automaticen reset desde la web.

En GitHub conviene proteger `main`, requerir PR/revisión y los jobs `checks`, `supabase-integration` y `security`.

Commits por cambio coherente. Nunca agregar claves service_role, `.env.local`, credenciales bancarias, tarjetas, logs de tokens o sesiones de Playwright. `npm run format` usa el formateador fijado. Revisá el diff antes de guardar.
