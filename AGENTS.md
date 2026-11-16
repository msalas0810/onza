# Onza — instrucciones para construir

## Orden de lectura

Leer README.md, docs/01-producto-y-diseno.md, docs/02-arquitectura.md, docs/03-bac-y-pagos.md, docs/04-plan-de-construccion.md y docs/05-pruebas-y-demo.md antes de implementar. Si una decisión está resuelta allí, no volver a preguntarla. Resolver detalles rutinarios con esos criterios y documentarlos.

## Producto

- Construir solo el MVP descrito. Priorizar un recorrido completo entre dos dispositivos.
- Cliente sin formulario de login obligatorio. Staff autenticado y autorizado por local.
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
