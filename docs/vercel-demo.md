# Probar Onza desde teléfono y computadora

Demo vigente: https://onza-demo.vercel.app

Código desplegado: `bea79075dfb74a6fae5a8d5f25ceca3f1814aaa2`, rama `fix/hosted-integration`. Preview automático READY `dpl_E2CuD4eFbPYKrjrQwNAxZDp6aSVd`; URL inmutable: https://onza-demo-dusmaiku2-msalas0810s-projects.vercel.app. El alias `onza-demo.vercel.app` se comprobó contra ese deployment. Acceso con Particle Wave original de Hossain Jahed, SVG de Onza, fondo negro, ivory y oxblood. `main` no se modificó, fusionó ni desplegó. El proyecto existente `onza-demo` conserva sus controles de protección, actualmente sin SSO obligatorio.

## Credenciales y recorrido

Consultar **solo localmente** `.env.local` en la raíz del repo. No copiar el archivo al chat ni compartirlo: contiene también secretos de servidor.

- Cliente en teléfono: `/acceso` → **Continuar con correo**, variables `DEMO_CUSTOMER_EMAIL` y `DEMO_CUSTOMER_PASSWORD`. Correo distinto de todas las cuentas laborales. La cuenta de prueba tiene un perfil ficticio (Cliente Demo), no datos personales de Manu.
- Bartender en computadora: `/equipo/acceso`, variables `DEMO_BARTENDER_EMAIL` y `DEMO_BARTENDER_PASSWORD` para **Mil948**, el local común preparado y verificado el 2026-11-17. Después pulsar **Abrir barra**.
- Bartender alternativo: `DEMO_BARTENDER_2_EMAIL` y `DEMO_BARTENDER_2_PASSWORD`; también tiene acceso a Mil948. Administrador: `DEMO_ADMIN_EMAIL` y `DEMO_ADMIN_PASSWORD`, mismo local.

Usar sesiones independientes. Cliente: local → agregar producto → carrito → confirmar reserva mock. Bartender: Aceptar y preparar → Marcar listo → Validar retiro → introducir el código privado de 12 caracteres presentado por el cliente → confirmar cobro simulado → confirmar entrega. El número público del pedido no autoriza el retiro; el código privado consumido se rechaza.

## Activación realizada (2026-11-16, America/Costa_Rica)

- Identidad confirmada por CLI: Supabase **onza-dev**, ref `ukdjuubekpanizcmppod`, organización `uczkkbsouopgwhqpvzyw`. No se usaron Pedidos SaaS ni pedidos-staging.
- `supabase db push --remote=ukdjuubekpanizcmppod --dry-run --skip-vault` mostró solo `202611170010_customer_accounts.sql`. Se revisó y aplicó únicamente esa migración aditiva, sin reset, roles ni seeds. Dry-run posterior: ninguna migración pendiente.
- Cuenta cliente confirmada preparada con `npm run demo:seed-users`; contraseñas laborales y clave de tickets existentes conservadas. Perfil ficticio completado mediante el onboarding real para probar el flujo.
- Auth Site URL: `https://onza-demo.vercel.app`. Se conservaron los redirect URLs anteriores y se agregaron `/auth/callback` y `/auth/callback**` para ese origen y para el Preview inmutable. `config diff` precedió a cada `config push`; diez propiedades remotas no declaradas se conservaron, incluida la confirmación por correo.
- Variables **solo Preview de fix/hosted-integration**: `ACCOUNTS_REQUIRED=true` activada después de migración/cuentas; `ENABLE_PAYMENT_SCENARIOS=false`; `DEMO_MODE=true`, `PAYMENT_PROVIDER=mock`, `REAL_PAYMENTS_ENABLED=false`, `ENABLE_DESIGN_SYSTEM=false`, `APP_ORIGIN=https://onza-demo.vercel.app`, URL/clave pública de onza-dev y clave/versión existentes de tickets. Sin service_role ni contraseñas demo en Vercel.
- Build nuevo desde el SHA exacto, READY. No se creó proyecto ni recurso pagado.

## Evidencia y pendientes

Acceso visual (2026-11-17): `docs/evidence/access/` contiene capturas locales y 28 controles puntuales locales/HTTPS: diseño a 1440/390/320 px, botones, foco/scroll, login real con destino conservado, invocación OAuth interceptada (sin prometer Google configurado), movimiento reducido, visibilidad simulada, fallos y limpieza WebGL. `npm run typecheck`, `npm run build` y ESLint de los archivos modificados aprobados. Sin nuevas suites ni repetición del flujo de pedidos. No sustituye pruebas físicas.

`docs/evidence/accounts-demo-verification.json`: **16 controles HTTPS aprobados**, dos contextos de Chromium independientes (390×844 cliente, 1440×900 barra), login por formularios, onboarding ficticio, pedido persistente al refrescar, preparación/listo, código público rechazado, validación privada, captura mock y entrega, código consumido rechazado, separación cliente/equipo y cero errores de ejecución. Sin galerías ni repetición de las 88 pruebas.

Reproducción local (crea y entrega un pedido ficticio con pago mock):

```sh
node --env-file=.env.local scripts/verify-accounts-demo.mjs https://onza-demo.vercel.app
```

**Pendientes explícitos, fuera de este encargo:** Google OAuth, SMTP propio y correo real de confirmación/recuperación, plantillas de correo, borrado de cuenta, revisión legal, nueva aceptación de condiciones y borrador tras sesión vencida. No se implementaron ni se prometen. Las cuentas sembradas están confirmadas para este demo. Cámara, audio, GPS y funcionamiento en Safari/iPhone/Android físicos siguen pendientes; Chromium con tamaño móvil no sustituye esos dispositivos. Pagos reales deshabilitados.

## V1 · pasos manuales para activar el rediseño en el demo desplegado

El código V1 ya está en `fix/hosted-integration`, pero **no se aplicó nada a `onza-dev` ni a Vercel desde la sesión que lo escribió** (sin acceso al proyecto remoto). Orden recomendado (expandir → desplegar → verificar, regla R4). Las dos migraciones son aditivas y compatibles con el commit desplegado `346df98`:

```bash
# 1. Comprobar que el proyecto es onza-dev (identificador ukdjuubekpanizcmppod) y aplicar solo las migraciones nuevas
npx supabase db push --dry-run
npx supabase db push        # aplica 202611170011_team_management.sql y 202611170012_demo_listing.sql
```

2. En Vercel (variables de **Preview**, solo servidor): `SUPABASE_SERVICE_ROLE_KEY`. La ruta `/api/team` la usa únicamente para dar de alta cuentas laborales y cerrar el cambio de contraseña temporal. Sin ella, esas dos acciones responden "Agregar personas no está configurado en este entorno"; todo lo demás funciona.
3. El Preview se genera solo al hacer push a `fix/hosted-integration`.
4. Datos del demo (locales reales con menús y precios simulados; oculta los locales ficticios sin borrarlos):

```bash
npm run demo:seed-real-venues
```

5. Fotos y logos: agregarlos en `public/demo-venues/real/` con su entrada en `SOURCES.json` (ver el README de esa carpeta) y volver a ejecutar el seed. Coordenadas: agregarlas en `fixtures/real-venues.json` solo con `source` y `verified_on`; sin ellas la app no muestra distancias para ese local.
6. Verificación contra el Preview: `scripts/verify-hosted-ux-preview.mjs` y `scripts/verify-accounts-demo.mjs` se ajustaron a la interfaz nueva pero **no se re-ejecutaron**.

Reversible: para volver a listar los locales ficticios, `update public.venues set demo_listed = true where slug in ('sala-norte','patio-central','club-cero');`.

## Preparación puntual · 2026-11-17

Rama actualizada a `af932d3`. Proyecto onza-dev confirmado; migraciones 011 y 012 aplicadas tras dry-run y dry-run posterior sin pendientes. `demo:seed-real-venues` ejecutado: cinco locales, menús simulados, membresías del equipo existente. Usar **Mil948** (`/v/mil948`) en el teléfono y el mismo local en barra/admin; sus dos bartenders y administrador tienen acceso. Cliente sin membresía laboral. Credenciales sincronizadas únicamente en `.env.local`.

El formulario cliente aplicaba el mínimo de registro también al login; corregido para permitir credenciales existentes aceptadas por Auth. Comprobación local: cuatro logins independientes y acceso común; publicación de este ajuste y comprobación HTTPS registradas en el cierre del diario. No se ejecutaron pedidos ni suites completas.

Cierre HTTPS: Preview `bea7907` READY y alias confirmado. Cuatro logins y acceso a Mil948 aprobados en sesiones independientes (cliente 390×844, personal 1440×900), sin crear pedidos. Evidencia: `docs/evidence/demo-access-ready.json`. No faltan credenciales locales para este alcance; prueba física pendiente.
