# Evidencia alojada · onza-dev

Proyecto verificado: `ukdjuubekpanizcmppod`, organización Onza. Datos ficticios; pagos mock.

- `security-checks.json`: 19 controles efectivos de Auth, RLS, aislamiento, administración y pausa. Scripts no imprimen claves, passwords, JWT ni cookies.
- `ui-checks.json`: 28 vistas a 390/1280 px, claro/oscuro: descubrimiento, menú, detalle, pedidos, login, barra y resumen admin. Sin overflow ni errores React observados.
- PNG: inspecciones Chrome con emulación de viewport; no teléfonos físicos. Códigos de retiro ocultos, ningún QR de autorización incluido. No representan autorización bancaria.
- E2E full-demo y pickup: 2/2 pasaron con sesiones reales independientes. Se repitieron después de la migración 004. Replays de creación/captura y un solo responsable de entrega verificados.

React/use histórico: “This library called use() to suspend in a previous render but did not call use() when it finished. This indicates an incorrect use of use().” **No reproducido después de conectar Supabase**; no se declara corregido ni se hicieron cambios especulativos.

Los montos del resumen corresponden a pedidos realmente entregados por las pruebas de demo, no métricas inventadas. Los controles restauran disponibilidad y pausa; pedidos de seguridad se cancelan sin borrar historia. Fotografías siguen siendo fallbacks hasta contar con material con derechos.

`realtime-check.json` agrega prueba directa de WebSocket y recepción de cambio PostgreSQL entre sesiones. No usa polling como sustituto de esa comprobación. El pedido de prueba se cancela sin borrar historia.
