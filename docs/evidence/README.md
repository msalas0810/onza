# Evidencia local

Capturas de Playwright en Chrome de escritorio con emulación de viewport; no son pruebas físicas de iPhone/Android. Las capturas de checkout usan un borrador de carrito ficticio inyectado en el navegador para probar presentación, no una orden ni una reserva persistida.

- `design-390-dark.png`, `design-1280-light.png`: componentes en móvil/escritorio.
- `checkout-390-dark.png`, `checkout-1280-light.png`: resumen, políticas, reserva simulada y CTA.
- `bundle-measurement.json`: scripts JS referenciados por HTML en build de producción, comprimidos individualmente con gzip; incluye scripts legacy referenciados aunque un navegador moderno puede no descargarlos.

Medición anterior a optimizar: `/` 292432 bytes gzip; después: 188666 bytes gzip (189 KB decimales). Se separaron VenueList/ProductMenu, se eliminó Zod del borrador de carrito usando validación pequeña explícita y se cargó Radix Dialog al abrir el cambio de local. La validación server/SQL permanece completa.

Checkout: 350020 bytes gzip y login: 257751 bytes gzip; no se afirma que todas las rutas cumplan 200 KB. El objetivo del kit se refiere al catálogo. La medición de `/` aquí es **sin Supabase configurado**, no demuestra el presupuesto del catálogo conectado, ni mide LCP/INP/CLS o condiciones de red/teléfono. Faltan fotos reales licenciadas y medidas representativas.

Smoke test de producción ejecutado: `/` /checkout /login HTTP 200, `/api/health` HTTP 200 y `/design-system` HTTP 404 sin habilitación explícita. No se desplegó.
