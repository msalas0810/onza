# Onza: funcionamiento y composición

> Las etapas 1–6 de abajo son el plan del 2026-11-16, **completado** y ahora histórico. El plan vigente empieza en "Plan vigente 2026-11-17" al final de este archivo.

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


## Plan vigente 2026-11-17

Fuente de decisiones: sección 0 de `Onza-Product-Blueprint-v3.md`. Rama `fix/hosted-integration`. Una persona/IA escribe la rama a la vez.

| Etapa | Entrega | Estado |
| --- | --- | --- |
| E0 | Documentación consolidada (acordado / dependencias manuales / implementado / pendiente; reglas R1–R6) | Hecho 2026-11-17 |
| E1 | Bocetos HTML navegables en `design/bocetos/`, comprobados en 360/390/1440 claro y oscuro | Hecho 2026-11-17; **pendiente aprobación de Manu** |
| E2 | Cuentas de cliente: acceso, confirmación, Google, recuperación, onboarding, sesión/QR (R1, R2, R6). Migración aditiva primero (R4) | **Código listo 2026-11-17** tras `ACCOUNTS_REQUIRED`; migración 010 sin aplicar a `onza-dev`; R6 (borrador tras sesión vencida) pendiente |
| E3 | Perfil, preferencias, páginas legales (borrador), versión de condiciones (R5), borrado de cuenta (R3) | Parcial: perfil, preferencias y aceptación con fecha/versión. Pendiente: R5 (pantalla de nueva versión), R3 (borrado), páginas legales propias |
| E4 | Portal laboral `/equipo/acceso`; empleado/administrador; migración desde `bartender/admin/onza`; separación del acceso interno Onza | Parcial: `/equipo/acceso` y separación cliente/equipo en servidor. Pendiente: renombrar roles a empleado/administrador (migración contractiva) |
| E5 | Pantallas de producción según bocetos aprobados; retirar el selector de resultado simulado | Parcial: selectores de resultado simulado retirados (cliente y barra); acceso, onboarding y cuenta nuevos. Pendiente: revisión visual de menú y barra contra el boceto |
| E6 | Verificación completa, dispositivos físicos, dependencias manuales cerradas | No autorizado aún |

Cada etapa de implementación: migración aditiva → despliegue y verificación del frontend → contracción posterior (R4). Ninguna etapa activa pagos reales ni toca dominios.
