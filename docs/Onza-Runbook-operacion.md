# Onza · Runbook de operación (borrador de la auditoría)

21 de noviembre de 2026 · rama `audit/seguridad-escala`. Breve a propósito: qué mirar, qué hacer y cuándo escalar. Todo lo que dice «medido» sale de `docs/Onza-Auditoria-seguridad-y-escala.md` y de `docs/evidence/audit/`; lo demás son señales a vigilar, no resultados.

## 1. Señales y dónde mirarlas

| Qué falla | Señal | Dónde se ve | Primer paso |
|---|---|---|---|
| Cambio de sesión / cuenta equivocada | Personas del equipo que caen en «cuenta personal sin acceso al equipo», o clientes devueltos al acceso sin haber cerrado sesión | Vercel Logs: líneas `{"event":"command"|"team","status":401|403|503,"code":…,"requestId":…}`; Supabase → Logs → Auth (login/logout/refresh) | Buscar `status:503` en las rutas: ahora un fallo transitorio de Auth/base muestra «No pudimos verificar tu sesión» (503 con reintento) en vez de redirigir. Cruzar `requestId` con `x-onza-request-id` de la respuesta |
| Revocación que no corta | Un empleado quitado sigue viendo la cola | Probar `/api/orders?venue=<id>` con su sesión: debe dar 403 al instante (la membresía se lee en cada llamada, no del JWT) | Si responde 200, revisar la fila en `public.memberships` y que `private.is_staff` no haya cambiado |
| Latencia de la barra | Cola lenta o «Reconectando» | Supabase → Database → Query performance; `public.order_list` y `public.sweep_orders` son las dos consultas calientes | Comparar con la línea base de `docs/evidence/audit/` (p95 de `order_list(venue)` ≈ 0,2–0,4 s en la carga de referencia). Si sube, mirar el tamaño del historial del local y el plan de `order_list` (`scripts/audit/explain.mjs`) |
| Saturación de conexiones | Esperas largas en cualquier pantalla a la vez | Supabase → Reports → Database (conexiones, CPU). En la carga sintética, cuando una consulta lenta ocupó el pool, **todas** las operaciones esperaron (espera p95 > 100 s) | Identificar la consulta lenta antes de subir capacidad; el primer fallo medido fue una consulta, no el tamaño de la instancia |
| Cola de vencimientos / auto-aceptación | Pedidos «en cola» pasados de 5 min sin cambiar de estado, o auto-aceptación que no actúa | `select count(*) from public.orders where status in ('queued','ready','pending_authorization') and deadline<now()` | Sin programador, solo avanza con tráfico: ejecutar `select public.auto_accept_tick();` como administrador de base y activar `supabase/ops/pg_cron_auto_accept.sql` en staging (PEN-005, pendiente de decisión) |
| Duplicados | Dos eventos `accept`/`delivered`, dos `capture`/`refund` | Consulta de invariantes en `scripts/audit/concurrency.mjs` (función `invariants`) | No debería ocurrir: está cubierto por bloqueos de fila y restricciones únicas. Si ocurre, detener y abrir incidente |
| Intentos de abuso | `RATE_LIMITED`, `CANCEL_COOLDOWN` en aumento | Registro `command` con `code`; tabla `private.abuse_events` | Los límites son por cuenta (no por IP): no penalizan a todo un bar por compartir Wi-Fi |

## 2. Recuperación

1. **Una versión rompe algo**: volver al último despliegue estable en Vercel (Deployments → Promote/Instant rollback). Las migraciones 013–024 son aditivas: el código anterior sigue funcionando sobre el esquema nuevo (verificado con el salto 012 → 024). No hay migración que revertir para volver atrás.
2. **Pedido atascado en `pending_authorization` con pago `unknown`**: administración → conciliar (`reconcile_authorization`, solo admin). No se vuelve a cobrar.
3. **Retiro con dueño equivocado**: administración → transferir retiro (`transfer`, solo admin, exige comprobación física).
4. **Acceso de una persona comprometida**: quitar su acceso desde Equipo (efecto inmediato en las llamadas), cerrar sus sesiones («Cerrar sesión en todos los dispositivos» es de la propia persona; el administrador de Supabase puede revocar sesiones desde Auth) y cambiar la contraseña.
5. **Fuga de clave**: la rotación la hace una persona autorizada en el panel del proveedor. `PICKUP_TOKEN_ENCRYPTION_KEY` **no se cambia sin migrar** los tickets cifrados (cambiarla deja ilegibles los tickets en curso).

## 3. Backups y restauración (a verificar en staging, no se probó)

- Confirmar en el panel del proyecto qué plan de backups hay y el período de retención; el plan Free no ofrece restauración puntual.
- Prueba mínima antes del piloto: restaurar el último backup en un **proyecto de prueba aislado**, correr `npx supabase db push --dry-run` (debe decir «up to date») y recorrer un pedido completo. Anotar cuánto tardó.
- Sin esa prueba, **no se puede afirmar** que haya recuperación ante pérdida de datos.

## 4. Cuándo subir capacidad y cuándo no

Medir primero, decidir después. Referencias medidas (Postgres 17 en una máquina de desarrollo, **no** un proyecto Supabase):

- La primera causa de saturación no fue el tamaño de la base sino una consulta que dependía del historial del local (`order_list(venue)`: ~3,3 s con 20 000 pedidos). Ya corregida (migración 023). Si reaparece un patrón así (latencia que crece con el historial), corregir la consulta/índice antes de comprar capacidad.
- Subir capacidad cuando, con consultas ya revisadas, la CPU de la base se mantenga alta con p95 de lectura > 500 ms o aparezcan esperas de conexiones sostenidas.
- Introducir infraestructura nueva (colas, caché compartida) solo si una medición en staging comparable lo justifica; hoy no hay evidencia que lo pida.

## 5. Checklist de staging antes de un piloto

1. Proyecto Supabase **aislado** (no `onza-dev`) con la misma región que producción y plan comparable.
2. `supabase link` + `supabase db push --dry-run` debe listar exactamente 013–024; revisar y aplicar. Luego fijar los espejos de configuración: `update private.configuration set accounts_required=true` (si `ACCOUNTS_REQUIRED=true` en la app) y **no** activar `allow_scenarios`.
3. Auth: aplicar (tras `config diff`) lo que corresponda de `supabase/hosted-auth-hardening.toml` (contraseña mínima, confirmación de correo, rotación de refresh token). Probar ingreso, registro, recuperación y alta de equipo.
4. Cookies/refresh/expiración reales: recorrer `scripts/verify-audit-sesiones.mjs` adaptado a Supabase real (hoy solo se probó con el servidor local simulado).
5. Storage: buckets `avatars`, `venue-images`, `menu-photos` y sus políticas (015/006/002); subir y borrar una imagen como admin y como empleado de otro local (debe fallar).
6. Realtime: dos sesiones; revocar a una y medir en cuánto deja de recibir eventos (no medido).
7. Cron: `supabase/ops/pg_cron_auto_accept.sql` en staging; verificar `cron.job_run_details`.
8. Correo: SMTP propio (el integrado no alcanza), plantillas y límites.
9. Variables de Vercel solo para el entorno de prueba; `service_role` nunca como `NEXT_PUBLIC_*`.
10. Volver a una versión estable: el último despliegue anterior; las migraciones aditivas no se revierten.
