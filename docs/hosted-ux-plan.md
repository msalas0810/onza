# Onza: funcionamiento y composición

Plan del 2026-11-16. Especificación: encargo de Manu y criterios AC01–AC12 de `Onza-UX-v2.md`. Ejecución autónoma en `fix/hosted-integration`, conservando Next, Supabase, RLS, Auth y pagos mock. Sin dependencias nuevas ni ramas.

Dirección visual: blanco/grafito/borgoña, Inter y marca actuales; composición compacta para elegir local, agregar tragos y recoger. Sin hero ni movimiento ornamental. Reutilizar Button, QuantityStepper, TextField, VenueCard, ProductImage y tokens.

## Etapas

- [x] 1. Reproducir INC-001 en sesiones reales; separar número público y credencial privada en SQL/servicio/ticket. Migración nueva compatible, intentos limitados, consumo único, recuperación del claim/captura. Pruebas SQL y criptográficas antes del cambio; conservar cifrado existente.
- [x] 2. Carrito: quitar/vaciar con confirmación, cantidad inline, persistencia, cambio explícito de local, dock contextual y acceso discreto. Pruebas de store y navegador.
- [x] 3. Catálogo: abiertos antes de pausados/cerrados; ubicación efímera opcional y orden sin recorte alfabético. Coordenadas nullable y edición admin validada. Pruebas de distancia, permisos y fallback.
- [x] 4. Composición compartida: ajustes/tema, navegación por contexto, cabeceras/filas compactas, seguimiento y barra. Realtime principal; fallback solo desconectado y acotado. Errores diferenciados y refresco ante conflicto.
- [x] 5. Aplicar solo migraciones revisadas en onza-dev; verificar flujos reales, carrera, aislamiento y recuperación. Typecheck, lint, tests, build; 360/390/1440, claro/oscuro; pocas capturas saneadas e inspeccionadas.
- [x] 6. Documentar evidencia y límites, comprobar automatizaciones demo, commits coherentes y push sin merge.

## Foco de revisión

Credenciales no visibles a staff; pedidos previos sin rotación de clave; QR fallido no oculta código; aceptar/cancelar con un ganador; captura pendiente recuperable sin segunda operación; carrito de otro local conservado; ubicación imprecisa no inventa cercanía; controles finales por encima de barras y safe areas.

## Registro

- Inicio: checkout limpio `506e3bf`; proyecto onza-dev confirmado por CLI (organización Onza, ACTIVE_HEALTHY), URL local coincide y flags mock confirmados. GitHub ADMIN. No se imprimieron secretos.
- Decisión: implementación incremental sobre componentes/RPC existentes. Se omite una nueva auditoría y aprobación de diseño por instrucción explícita de ejecución autónoma.

- Verificación de etapas 1–5: `docs/hosted-ux-verification.md`. Dos revisiones estáticas del retiro/Realtime y revisión final de allowlist sin bloqueos. No hubo cambios de configuración de Vercel ni rotación de claves.

- Cierre: código e1e8987 publicado, GitHub Actions 43937917513 exitoso y Preview READY con nueve controles HTTPS reales aprobados. Evidencia y límites en el informe; main/producción/settings sin cambios.
