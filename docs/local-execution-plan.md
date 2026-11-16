# Ejecución local del MVP

Especificación: documentos 01–05 y PROMPT-CODEX-MVP-LOCAL.md del directorio padre. Ejecución por un solo agente, sin push/despliegue. El diseño y las seis etapas ya están definidos y autorizados; no requieren otra ronda de aprobación.

1. Base Next/TypeScript, tokens, marca, componentes, catálogo /design-system. Verificar lint/typecheck/build y vista móvil.
2. Migraciones Supabase, RLS, seeds, Auth invitado/staff, catálogo servidor. Probar SQL con roles y documentar disponibilidad real de Supabase.
3. Tests de creación e idempotencia antes de servicios, transacciones de pedido/reserva, carrito/checkout y recuperación.
4. Tests de transiciones antes de servicios, cola Realtime y refetch, cancelaciones, vencimientos y sonido opt-in.
5. Tests de concurrencia antes de retiro, token cifrado/hash, claims ligados a sesión Auth, mock durable con reconciliación y cámara opcional.
6. Tests de corte operativo y ventas antes de resumen; menú/ajustes, integración, CI y documentación GitHub/Vercel. Suite y capturas finales.

## Decisiones de ejecución
- Construir dentro de onza-starter, conservando todo el kit. Rama feat/local-mvp; main será integración al incorporar cambios por PR.
- No sustituir Supabase por persistencia de navegador. Sin configuración, mostrar error persistente de conexión/configuración. Preferencias de tema/audio y borrador de carrito pueden persistir localmente; pedidos/pagos/permisos siempre en DB.
- Docker y Supabase CLI no están instalados; .env.example está vacío. No hay proyecto demo configurado. Continuar implementación independiente; verificar SQL con PostgreSQL embebido de pruebas si se puede instalar, sin presentarlo como integración Supabase real.
- Diseño: hospitalidad editorial, listas planas, blanco/grafito/borgoña, fallback tipográfico de fotografías. Movimiento corto en controles, sheets y cambios de estado con reduced motion.
- La API usa la sesión Supabase del usuario y RPC autorizadas, sin service_role en runtime. Operaciones mock se resuelven atómicamente en DB y dejan registros durables; BAC siempre falla cerrado.

## Registro
Inicio: entorno Node 25.5.0, npm 11.8.0, identidad Git existente. Se fijará Node LTS en .nvmrc. Sin subagentes ni cambios de modelo.
