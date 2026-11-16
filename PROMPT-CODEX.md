# Prompt de inicio

Vas a construir el MVP de Onza usando esta carpeta como especificación. Lee AGENTS.md y todos los docs antes de escribir código. El resultado buscado es una web app móvil premium y funcional, con Supabase, cliente invitado, panel de barra y administración de ventas, y pagos exclusivamente simulados.

No construyas una landing page. No intentes conectar BAC todavía: docs/03-bac-y-pagos.md contiene una restricción contractual importante y los requisitos que siguen pendientes. No solicites credenciales reales ni inventes APIs.

Inspecciona primero el repositorio y el entorno. Si esta carpeta todavía no tiene aplicación, crea una app mínima con las decisiones propuestas en los docs. Conserva estos documentos y assets; copia las fuentes y SVG necesarios a public. El plan es incremental: no intentes todas las etapas en un único cambio gigante.

Primera entrega: etapa 1 del plan, sistema de diseño navegable en claro y oscuro con assets reales, botones, tipografía, foto con fallback, tarjetas, estados y layouts móviles. Usa la composición editorial indicada y muestra estados vacíos, loading y error. Luego continúa con Supabase y el recorrido completo según las etapas. Resuelve elecciones rutinarias con el documento; pregunta solo por bloqueos que cambien materialmente el alcance.

El demo final debe funcionar en dos sesiones distintas: cliente ordena y reserva monto ficticio; bartender acepta y pasa a preparando; marca listo; cliente recibe aviso visible y sonido si el dispositivo lo permite; bartender valida QR/código, captura ficticia y confirma entrega; administrador ve ventas derivadas de esos datos. Refrescar no pierde el pedido. Escanear dos veces no cobra dos veces. Un bar no ve datos de otro.

No uses datos locales como sustituto silencioso de una persistencia real. Si falta configurar Supabase, explica el paso exacto y ofrece la vista de diseño, sin afirmar que el demo multiusuario funciona. No crees infraestructura pagada ni publiques producción automáticamente.

Mantén actualizados docs/implementation-status.md y README con setup, comandos, decisiones y resultados de pruebas. Entrega una etapa verificable antes de pasar a la siguiente.
