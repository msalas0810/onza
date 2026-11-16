# Construir Onza completo en local

Construí el MVP completo de Onza en esta carpeta. Quiero código funcionando en mi computadora, listo para subir después a GitHub y conectar a Vercel. No te detengás después del diseño, del scaffolding ni de la primera etapa.

Leé AGENTS.md, README.md, docs/01 a docs/05, los contratos, tokens y assets. Los Markdown son la especificación; no hace falta releer el PDF. Este prompt sustituye PROMPT-CODEX.md como orden de ejecución. Conservá el alcance y las reglas de seguridad del kit.

Inspeccioná el entorno y cualquier código existente. Presentá un plan breve y empezá a implementarlo en la misma sesión. Completá las seis etapas en orden, verificando cada una y continuando automáticamente. Resolvé decisiones rutinarias con la especificación.

## Resultado funcional

- Cliente invitado: explorar locales, menú, detalle, carrito, checkout con reserva simulada, seguimiento persistente y ticket QR/código.
- Barra autenticada: recibir, aceptar, preparar, marcar listo, validar retiro, capturar ficticiamente y confirmar entrega.
- Administrador: editar menú, disponibilidad, pausar pedidos y consultar ventas reales del demo.
- Dos sesiones independientes sincronizadas mediante Supabase, permisos por local y recuperación al refrescar/reconectar.
- Claro/oscuro completos, SVG y fuente incluidos, componentes compartidos y acabado móvil según el documento. Usá fallback para las fotos faltantes; no inventés afiliaciones ni licencias.

## Desarrollo local

Usá Next.js, TypeScript strict y Supabase según el kit. Fijá versiones compatibles y lockfile. Incluí migraciones, RLS, tipos y semillas reproducibles.

Si Docker está disponible, usá Supabase CLI local para desarrollar y probar sin credenciales de nube. Si ya hay un proyecto Supabase demo configurado, respetalo. Si falta una dependencia/configuración, explicá el paso preciso y continuá todo trabajo independiente; no sustituyás la persistencia por localStorage ni declares verificaciones no ejecutadas.

Los pagos son exclusivamente mock. Reserva al pedir; captura al retirar. Implementá los errores, cancelaciones, concurrencia y recuperación del kit. No conectés BAC ni solicités tarjetas reales. No prometás vibración/sonido en segundo plano en iPhone.

## GitHub y Vercel después

Inicializá Git local si no existe. Conservá cambios ajenos y hacé commits por hitos si hay identidad configurada; no inventés identidad ni cambiés configuración global.

Incluí .gitignore, .env.example sin secretos, versión de Node, scripts y README reproducible. Creá CONTRIBUTING.md para dos desarrolladores: ramas por tarea, PRs pequeños y main como rama de integración. Agregá CI para typecheck, lint, tests y build, sin depender de secretos productivos.

Documentá cómo importar el repositorio en Vercel, configurar variables y URLs de Auth, conectar Supabase y usar previews. La base persistente no vive en el filesystem de Vercel. Diferenciá las credenciales demo de producción. No creés repositorios remotos, hagás push, despliegues ni contrates recursos en esta ejecución.

## Uso eficiente y continuidad

Trabajá con un solo agente. No lances subagentes ni cambies modelo/configuración. No regeneres la marca ni replantees decisiones resueltas. Consultá documentación cuando haga falta, con búsquedas acotadas.

Al cerrar cada etapa actualizá docs/implementation-status.md: qué funciona, archivos relevantes, pruebas ejecutadas, pendientes y siguiente tarea exacta. Conservá checkpoints antes de terminar o ante una interrupción. Ejecutá checks dirigidos mientras avanzás y la suite completa al integrar; no repitas suites sin cambios ni omitas controles críticos para ahorrar uso.

Antes de finalizar verificá el recorrido cliente → barra → retiro → administrador, aislamiento entre locales, dobles envíos/capturas y ambos temas. Inspeccioná la interfaz renderizada en móvil y escritorio si hay herramientas disponibles; distinguí emulación de prueba física en iPhone. Entregá instrucciones de arranque, resultados reales y bloqueos concretos. No marques una etapa como terminada solo porque su interfaz existe.

Empezá ahora y continuá hasta completar el MVP o llegar a un bloqueo externo real; no pidas aprobación entre etapas.
