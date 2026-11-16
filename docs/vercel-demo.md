# Probar Onza desde teléfono y computadora

Demo: https://onza-demo-msalas0810.vercel.app

Es un Preview protegido por Vercel Authentication. Primero iniciá sesión en Vercel con tu cuenta autorizada en cada dispositivo. Eso permite abrir la web, pero no concede permisos de bartender en Onza.

Cliente en teléfono: abrí el demo, elegí Patio Central y pedí como invitado con reserva simulada. Conservá cookies y el mismo navegador para recuperar tu pedido. No ingresés tarjetas.

Bartender en computadora: abrí /login. Patio Central usa `bartender2@onza.test`; consultá la contraseña únicamente en `.env.local`, variable DEMO_BARTENDER_2_PASSWORD. Sala Norte usa DEMO_BARTENDER_EMAIL/PASSWORD. Cada bartender solo opera su local.

Código desplegado: fix/hosted-integration, ee82a7bbf153e5033ea90c540b700d50cb1e169c. Documentación posterior puede avanzar la rama sin cambiar el deployment fijado por el alias estable. Main conserva la base anterior; no se fusionó.

Backend: onza-dev, ref ukdjuubekpanizcmppod, misma base y datos. Root '.', Next.js, Node 24. Variables del runtime solo en Preview para esta rama, sin service_role ni contraseñas demo. No cambiar PICKUP_TOKEN_ENCRYPTION_KEY sin migrar tickets existentes. No se habilitaron pagos reales.

Verificaciones HTTPS: catálogo, sesión invitada, pedido/reserva mock, persistencia, acceso bartender y Realtime WebSocket pasaron. No son pruebas físicas de Safari/iPhone. Reporte: docs/evidence/vercel-verification.json.

**Pendiente del usuario:** no apareció código de retiro y la entrega no exigió validación. No se considera comprobada ni corregida esa validación. Esta ejecución no capturó ni entregó el pedido de prueba; se canceló después de Listo.
