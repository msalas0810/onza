# Validación del kit

16 de noviembre de 2026.

- PDF: 31 páginas renderizadas y revisadas visualmente; ninguna caja de texto fuera de página.
- Logos: 8 archivos SVG con paths, sin raster incrustado, scripts ni referencias externas. Vaso sin línea interior. Wordmark trazado del original.
- Iconos: PNG 192/512 y apple-touch-icon 180 derivados del SVG.
- Fuente: cabecera WOFF2, hash SHA256 y licencia original incluidos.
- Tokens: JSON/CSS sincronizados y 42 pares de contraste verificados matemáticamente.
- Fixtures: 3 locales ficticios y 12 productos, montos enteros y ninguna foto de terceros.
- Revisión de arquitectura: resueltos los casos de autorización sin referencia y entrega concurrente por dos sesiones de bartender.
- Investigación BAC: cláusulas públicas y pendientes del gateway identificados; ninguna certificación afirmada.

Repetir controles reproducibles:

```sh
python3 scripts/generate-tokens.py --check
python3 scripts/check-kit.py
```

Estos controles validan el paquete de planificación. No se han ejecutado pruebas de una aplicación, cobros, RLS de una base real ni certificación bancaria: todavía no existe implementación. Los escenarios de docs/05-pruebas-y-demo.md son criterios para el código que se construya después.

MANIFEST.sha256 enumera los archivos entregados y permite comprobar integridad. Si se editan los documentos/assets después de comenzar el proyecto, es normal que cambien sus hashes.
