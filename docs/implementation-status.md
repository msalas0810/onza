# Estado de implementación

## Etapa 1 — verificada
- Next 16.4.6 / React 19.3.1 / TypeScript strict, Node LTS local, lockfile, assets originales y tokens en claro/oscuro.
- Componentes compartidos y `/design-system` (solo desarrollo; producción 404 salvo habilitación explícita), tema aplicado antes del render, fuente local.
- Ejecutados: `npm run typecheck`, `npm run lint`, `npm run build`: exit 0. Playwright: 11/11 a 360/390/430/768/1280 px en claro/oscuro, reduced motion, foco, targets y preferencia persistente.
- Capturas: `test-results/design-<ancho>-<tema>.png` (artefactos locales ignorados por Git).
- Corrección: el selector de targets incluía el botón de herramientas de Next; ahora mide los controles del contenido.
- Próxima tarea: cerrar catálogo/persistencia y comprobar permisos SQL.

## Etapa 2 — en integración
- Migración, RLS, seed reproducible y tipos generados desde SQL; clientes Supabase/guards en construcción.
- Ejecutadas 6 pruebas PostgreSQL embebido (PGlite): todas pasan. Incluyen RLS con roles authenticated reales y JWT simulados; NO prueban Auth/Realtime/Storage reales.
- Bloqueo externo: sin Docker ni proyecto Supabase configurado. No se usa persistencia alternativa para pedidos.

## Etapas 3–6 — en construcción
Servicios, transacciones mock y pruebas en avance; aún no se declaran completas.

## Límites de aceptación
No hay fotos finales licenciadas. No se han probado Safari/iPhone/Android físicos. Ningún pago real ni integración BAC. Sin push, repositorio remoto ni despliegue.
