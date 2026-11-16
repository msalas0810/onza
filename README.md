# Onza · Product & build kit

Web app móvil para pedir y recoger tragos. Cliente, barra y administración en un mismo sistema. El recorrido completo se construye primero con dinero simulado.

## Abrir primero

1. `docs/01-producto-y-diseno.md`: alcance, experiencia y dirección visual.
2. `docs/02-arquitectura.md`: datos, permisos, estados y límites entre módulos.
3. `docs/03-bac-y-pagos.md`: evidencia pública, restricciones y contrato de integración.
4. `docs/04-plan-de-construccion.md`: entregables y condiciones de cierre.
5. `docs/05-pruebas-y-demo.md`: escenarios de aceptación y recorrido de demostración.
6. `docs/06-fuentes.md`: referencias primarias y fecha de consulta.

`Onza-documento-maestro.pdf` reúne la dirección de producto y los criterios principales en formato de lectura. Los Markdown son la especificación editable y la fuente que debe leer Codex.

## Empezar en Codex

Abrir esta carpeta y pegar `PROMPT-CODEX.md`. `AGENTS.md` fija las reglas del proyecto. No hay una aplicación ya construida ni una integración BAC certificada en este kit.

## Assets incluidos

- `brand/svg/`: vaso sin línea interior, wordmark trazado del original, lockups e icono de app. SVG reales, sin imágenes incrustadas.
- `brand/fonts/`: Inter Variable 4.1 WOFF2 y su licencia SIL OFL.
- `design/tokens.json`: valores semánticos de luz, oscuridad, tamaños y movimiento.
- `design/tokens.css`: variables CSS listas para importar.
- `design/fonts.css`: declaración de fuente local; copiar el WOFF2 a `/public/fonts/` al crear la app.
- `fixtures/demo-data.json`: locales y productos ficticios; las fotografías finales no están incluidas.
- `contracts/payment-provider.ts`: interfaz de pagos, no implementación del banco.
- `.env.example`: nombres de configuración sin secretos.
- `scripts/generate-tokens.py`: regenera CSS y audita contraste desde tokens.json, sin dependencias externas.
- `scripts/check-kit.py`: valida los assets y contratos de este paquete; no ejecuta pruebas de una aplicación todavía inexistente.

## Decisiones de esta versión

Confirmado por Manu: web primero, iPhone después; estética premium; modo claro/oscuro; catálogo fotográfico; flujo cliente/barra; panel de ventas; BAC como primera entidad a evaluar; pago reservado al pedir y capturado al entregar.

Propuesta de diseño: cliente invitado con Supabase Anonymous Auth; personal con sesión; Next.js + TypeScript + Supabase; Inter; componentes propios sobre primitivas accesibles. No se presenta esta propuesta como una preferencia ya aprobada del fundador.

## Hallazgo crítico de BAC

El contrato público F-CRI-0006171 V5, cláusula 3.11, lista Licores, Market Place y Facilitadores de Pago como prohibidos para ese producto. No se asume autorización del ecommerce estándar para Onza. Confirmar por escrito el producto/acuerdo aplicable antes de implementar cobros reales. Esto no impide construir el demo simulado.

## Entorno de demostración

`PAYMENT_PROVIDER=mock`, `REAL_PAYMENTS_ENABLED=false`, `DEMO_MODE=true`. No introducir tarjetas reales ni credenciales bancarias. No provisionar recursos pagados ni desplegar producción automáticamente.

Preparado el 16 de noviembre de 2026. La revisión bancaria usa fuentes públicas; los manuales técnicos específicos deben entregarlos BAC y el gateway asignado.
