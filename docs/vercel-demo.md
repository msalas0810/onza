# Probar Onza desde teléfono y computadora

Demo: https://onza-demo-msalas0810.vercel.app

Es un Preview protegido por Vercel Authentication. Primero iniciá sesión en Vercel con tu cuenta autorizada en cada dispositivo. Eso permite abrir la web, pero no concede permisos de bartender en Onza.

Cliente en teléfono: abrí el demo, elegí Patio Central y pedí como invitado con reserva simulada. Conservá cookies y el mismo navegador para recuperar tu pedido. No ingresés tarjetas.

Bartender en computadora: abrí /login. Patio Central usa `bartender2@onza.test`; consultá la contraseña únicamente en `.env.local`, variable DEMO_BARTENDER_2_PASSWORD. Sala Norte usa DEMO_BARTENDER_EMAIL/PASSWORD. Cada bartender solo opera su local.

Código desplegado: fix/hosted-integration, ee82a7bbf153e5033ea90c540b700d50cb1e169c. Documentación posterior puede avanzar la rama sin cambiar el deployment fijado por el alias estable. Main conserva la base anterior; no se fusionó.

Backend: onza-dev, ref ukdjuubekpanizcmppod, misma base y datos. Root '.', Next.js, Node 24. Variables del runtime solo en Preview para esta rama, sin service_role ni contraseñas demo. No cambiar PICKUP_TOKEN_ENCRYPTION_KEY sin migrar tickets existentes. No se habilitaron pagos reales.

Verificaciones HTTPS: catálogo, sesión invitada, pedido/reserva mock, persistencia, acceso bartender y Realtime WebSocket pasaron. No son pruebas físicas de Safari/iPhone. Reporte: docs/evidence/vercel-verification.json.

**Pendiente del usuario:** no apareció código de retiro y la entrega no exigió validación. No se considera comprobada ni corregida esa validación. Esta ejecución no capturó ni entregó el pedido de prueba; se canceló después de Listo.


## Cuentas de cliente y portal del equipo (2026-11-17)

El código ya incluye acceso obligatorio, onboarding y portal separado, **apagados por defecto** para no romper el demo desplegado (R4). Orden obligatorio:

1. Aplicar la migración aditiva `supabase/migrations/202611170010_customer_accounts.sql` a `onza-dev` (`supabase db push` o el flujo habitual). El demo desplegado sigue funcionando antes y después.
2. Desplegar esta rama (Preview).
3. Crear la cuenta personal de prueba localmente, sin imprimir contraseñas: definir `DEMO_CUSTOMER_EMAIL` y `DEMO_CUSTOMER_PASSWORD` (correo distinto de todas las cuentas del equipo) en `.env.local` y ejecutar `npm run demo:seed-users`.
4. En Auth de Supabase agregar a Redirect URLs el origen exacto del Preview con `/auth/callback`.
5. Recién entonces definir `ACCOUNTS_REQUIRED=true` en las variables Preview de Vercel y redeplegar. Sin la variable, el demo conserva el flujo invitado.

Entrar como **cliente (teléfono)**: abrir el demo → `/acceso` → correo y contraseña de `DEMO_CUSTOMER_*` → completar el perfil (nombre, @usuario, teléfono, fecha de nacimiento 18+, aceptar condiciones) → Explorar → local → menú → carrito → confirmar.

Entrar como **bartender (computadora)**: abrir `/equipo/acceso` con `DEMO_BARTENDER_EMAIL/PASSWORD` (Sala Norte) o `DEMO_BARTENDER_2_*` (Patio Central) → Abrir barra. El bartender no puede pedir: abrir `/acceso` con su sesión muestra "Ya hay una sesión iniciada".

Dependencias manuales que siguen abiertas: Google OAuth (credenciales y proveedor en Supabase), SMTP propio para correos de confirmación y recuperación a clientes reales (el SMTP integrado de Supabase es solo para pruebas), plantillas de correo, y revisión legal de los textos borrador.
