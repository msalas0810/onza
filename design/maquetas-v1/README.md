# Maquetas Onza V1 (F1)

> **Propuesta para revisión visual. No son funciones implementadas.** No tocan la app, Supabase ni Vercel. Decisiones de producto: sección 0 de `Onza-Product-Blueprint-v3.md`; plan y estado: `docs/plan-v1.md`; especificación para implementar: [`GUIA.md`](GUIA.md).

## Abrir

```bash
python3 -m http.server 8080 --directory design/maquetas-v1
```

Entrá a `http://localhost:8080`. También funciona con doble clic en `index.html`, pero la sincronización entre marcos de `flujo.html` necesita el servidor.

## Verificar

```bash
node scripts/verify-maquetas.mjs
```

Recorre los flujos principales en Chromium (Playwright preinstalado), comprueba desbordes en 360/390/1440 claro/oscuro y errores de consola, y guarda `verificacion.json` y `capturas/`. `--no-shots` omite las capturas.

## Limitaciones

- Reglas del servidor simuladas en el navegador (`assets/store.js`); datos en `localStorage` de este navegador. Botón Revisión › Reiniciar vuelve al estado inicial.
- Sin autenticación, red ni pagos. Cuentas ficticias con dominio `.demo`; cualquier contraseña entra.
- Locales reales con datos de demo: menús, precios, horarios, estados, distancias y pedidos simulados. Coordenadas, fotos y logos pendientes (no se inventaron). Sin relación comercial ni autorización de los locales.
- El QR del ticket es ilustrativo; el fondo del acceso en la app es Particle Wave original (aquí, negro liso con nota).
- Los bocetos antiguos (`design/bocetos/`) se retiraron del repo; quedan en el historial de git.
