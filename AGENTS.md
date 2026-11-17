# Onza — instrucciones para construir

## Primer paso obligatorio: leer el diario

Antes de escribir código, leer **`DIARIO.md`** (raíz): "Estado actual", "Pendientes abiertos" y las últimas entradas. Dice qué se hizo, quién lo hizo, con qué IA, en qué rama y cuál es la siguiente tarea.

Al terminar, agregar una entrada nueva en `DIARIO.md` (fecha, persona, IA y modelo, rama y commits, qué cambió, qué se verificó y qué no) y actualizar "Estado actual". No borrar entradas previas. Si no se hizo, el trabajo no está terminado. Sin secretos ni afirmaciones sin evidencia.

## Documento canónico de producto

Las decisiones vigentes (acceso obligatorio, cuenta personal vs. laboral, dos permisos laborales, onboarding y privacidad, reglas R1–R6) están en la **sección 0 de `Onza-Product-Blueprint-v3.md`**. Ahí manda lo más reciente; donde otro documento (incluido `Onza-UX-v2.md`, `README.md` y `docs/01…`) lo contradiga, es histórico. Los bocetos de `design/bocetos/` son propuestas visuales, no funciones implementadas.

## Orden de lectura

Después del diario, leer README.md, docs/01-producto-y-diseno.md, docs/02-arquitectura.md, docs/03-bac-y-pagos.md, docs/04-plan-de-construccion.md y docs/05-pruebas-y-demo.md antes de implementar. Si una decisión está resuelta allí, no volver a preguntarla. Resolver detalles rutinarios con esos criterios y documentarlos.

## Producto

- Construir solo el MVP descrito. Priorizar un recorrido completo entre dos dispositivos.
- ~~Cliente sin login~~ (histórico). Vigente: login obligatorio para clientes; cuenta laboral distinta que nunca compra; empleado y administrador por local. Ver blueprint, sección 0. El código actual todavía usa sesión invitada: no cambiarlo sin una etapa autorizada y la regla R4 de migraciones.
- Next.js/React/TypeScript propuestos; si hay un repositorio existente, inspeccionarlo antes de cambiar stack.
- Supabase para persistencia, Auth, Storage y Realtime. SQL versionado y tipos generados.
- Monolito modular. No microservicios, Redis, Kubernetes, GraphQL ni agentes AI en el MVP.

## Diseño

- Usar design/tokens.json y design/tokens.css como contrato visual. Nada de colores o espaciados sueltos por pantalla.
- Usar SVG de brand/svg y fuente local Inter. No reemplazar el logo con texto de una fuente ni con un emoji.
- Construir /design-system con estados y temas antes de multiplicar pantallas.
- Lucide estático por defecto. Animaciones cortas para cambios relevantes; respetar reduced motion.
- Formularios con labels, foco visible, teclado y lector de pantalla. Controles principales de al menos 44x44 CSS px; barra, 48 px.
- No gradientes decorativos, fondos aurora, landing hero, carousels automáticos, métricas ficticias ni brillo excesivo.
- No esconder fallos con toasts efímeros. Los estados críticos viven en la pantalla.

## Seguridad y dinero

- PAYMENT_PROVIDER=mock por defecto. REAL_PAYMENTS_ENABLED=false. BacPaymentProvider debe fallar explícitamente como no configurado hasta contar con el manual y acuerdo aplicables.
- No inventar endpoints, payloads, firma, hash, webhooks, idempotencia o certificaciones de BAC.
- Nunca almacenar PAN, CVV, expiración o capturas de formularios de tarjeta. Formulario/tokenización del proveedor cuando se habilite.
- Nunca exponer service_role, claves bancarias o secretos como NEXT_PUBLIC_*.
- Precio, autorización por local y estado se verifican en backend; no confiar en totales, role, venue_id o estado que envíe el navegador.
- RLS y comprobaciones de backend son complementarias. Authenticated no equivale a staff: un invitado Supabase también es authenticated.
- Multi-tenant desde el esquema. No reutilizar una afiliación bancaria para otros negocios sin aprobación.
- Comandos de pedido y pago idempotentes. En un timeout de captura consultar estado, no cobrar de nuevo a ciegas.
- El QR identifica una autorización de entrega; no contiene PII ni credenciales bancarias. Nunca sirve como autorización de pago por sí solo.

## Código y mantenimiento

- TypeScript strict, sin any para evadir tipos. Funciones pequeñas y nombres del dominio en inglés; UI en español.
- Páginas orquestan; servicios contienen lógica. UI no llama directamente a adaptadores bancarios.
- Un solo componente por patrón visual, variantes tipadas, sin duplicar botones o tarjetas por rol.
- No instalar dependencias para cosas simples que ya resuelve la plataforma. Versiones estables compatibles al implementar; lockfile comprometido.
- No pasar toda la app a use client. Aislar cámara, carrito, Realtime y audio como islas interactivas.
- Consultas paginadas e indexadas; limpieza de suscripciones al desmontar; reconexión con refetch.
- SQL de cambios y semillas en control de versiones. Ningún cambio esencial solo en Dashboard.
- README actualizado, .env.example sin secretos, THIRD_PARTY_NOTICES y pruebas relevantes.

## Verificación

- Cerrar cada etapa con evidencia verificable: comandos ejecutados, resultados y capturas de temas/tamaños relevantes.
- Dar prioridad a invariantes: aislamiento, montos, concurrencia, reserva/cancelación/captura, pedido único y QR único.
- Probar Safari de iPhone real antes de prometer cámara, push, audio o vibración. Playwright no prueba hápticos físicos.
- Nunca afirmar que está certificado por BAC, listo para cobrar o que el pago se completó sin evidencia del proveedor.
- Prohibido lanzar producción con accesos públicos de demo, bypasses de roles o simuladores habilitados como pagos reales.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
