# Fidelización: diseño, alcance y pendientes

Estado: **Etapa 1 (cimiento) implementada en base de datos y pruebas.** No hay interfaz ni canje en el checkout todavía. La migración `202611270028_loyalty_foundation.sql` (antes 025 en la rama de origen) está aplicada en `onza-dev` desde D-2026-11-27-09. La interfaz de administración del local está en la pestaña «Fidelización y social»; el canje en el checkout sigue sin hacerse.

## Reglas de negocio (vigentes en el código)

| Tema | Regla |
| --- | --- |
| Unidad | 1 punto = ₡1 = 100 unidades minor. Puntos enteros. |
| Programa | Uno por local. Porcentaje base y `enabled`. Apagado por defecto. |
| Reglas | Alcance: todo el local, una categoría o un producto. Filtros: días ISO, franja horaria en hora de Costa Rica (puede cruzar medianoche), importe mínimo del pedido, vigencia (desde/hasta), tope de puntos por pedido, campaña opcional. |
| Precedencia | Si una regla coincide con una línea, reemplaza al base para esa línea. Si coinciden varias, gana la de **mayor** porcentaje; no se suman. Una regla al 0 % excluye la línea. |
| Quién gana | Solo cuentas con perfil completo (`public.profiles`). Nunca invitados. |
| Sobre qué | Sobre el importe **pagado en efectivo**: total menos lo pagado con puntos. Hoy el canje no existe, así que es el total. |
| Cuándo | Al confirmarse el cobro (estado `captured`), en la misma transacción. Un reembolso (`refunded`) revierte lo no consumido. |
| Idempotencia | Un abono por pedido y fondeador (índice único). Repetir el cobro o llamar otra vez al abono no duplica. |
| Vencimiento | Cada abono vence `points_valid_days` después de emitirse (por defecto 180). |
| Presupuesto | Campañas con `budget_points`. Lo emitido neto (abonos menos reversas) no supera el presupuesto. Vencer puntos no libera presupuesto (criterio conservador). |
| Fondeador | `venue` (el local), `sponsor` (patrocinador, con nombre) u `onza`. Cada asiento guarda su fondeador y campaña. |
| Comisiones | Ninguna. Pedidos no cobra por acumular ni canjear, y el libro no tiene asientos de comisión. Procesamiento y cashback financiado se mantienen separados por `funder`. |

## Modelo de datos

- `public.loyalty_programs`, `public.loyalty_rules`, `public.loyalty_campaigns`: configuración. Sin permisos directos para `anon` ni `authenticated`; se cambian solo por RPC.
- `private.loyalty_ledger`: libro **append-only** (triggers que bloquean `update` y `delete`). Tipos: `earn`, `reversal`, `expire`, `redeem` (reservado para el canje).
- `private.loyalty_allocations`: qué abono consume cada reversa o vencimiento. El saldo de cada abono nunca queda negativo y el consumo es explícito (base para el canje FIFO).
- `private.loyalty_config_log`: historial de cambios de configuración con `actor_id`, antes y después.
- Cambiar o desactivar una regla o campaña **no altera** los asientos existentes: cada asiento conserva su fondeador y su campaña. No hay RPC para borrar reglas ni campañas.

## RPC

| Función | Quién | Qué hace |
| --- | --- | --- |
| `loyalty_config(venue)` | administración del local | Programa, reglas y campañas con emitido y restante. |
| `loyalty_program_save(input)` | administración | Activa o pausa, porcentaje base, vigencia. |
| `loyalty_rule_save(input)` | administración | Crea o cambia una regla. Valida que la categoría, el producto o la campaña sean del mismo local. |
| `loyalty_campaign_save(input)` | administración | Crea o cambia una campaña. Rechaza bajar el presupuesto de lo ya emitido (`BUDGET_BELOW_ISSUED`) y cambiar el fondeador después de emitir (`FUNDER_LOCKED`). |
| `loyalty_summary(venue)` | administración | Emitido, revertido, vencido, canjeado y pendiente, con desglose por fondeador. Sin datos personales de clientes. |
| `loyalty_account()` | cuenta propia | Saldo por local, próximos vencimientos e historial de 50 movimientos. Ejecuta antes el vencimiento de sus abonos. |

Todas comprueban la autorización dentro de la base (`private.is_staff(venue, true)` o `auth.uid()`). Un empleado del local (`bartender`) no configura ni ve el resumen.

## Decisiones

- **Lógica en SQL, no en la aplicación.** La acumulación ocurre dentro de la misma transacción que el cambio a `captured`. Así no hay forma de cobrar sin abonar ni abonar sin cobro. La alternativa (un proceso posterior en TypeScript) tenía ventanas de inconsistencia y un doble registro de reglas.
- **Solo tablas y triggers nuevos (R4).** No se tocó `onza_command`, precios, montos ni permisos existentes. El único trigger nuevo sobre `private.payments` solo actúa al pasar a `captured` o `refunded`.
- **Serialización por programa.** Acumular, revertir, vencer y cambiar configuración toman un `FOR UPDATE` sobre la fila del programa del local. Evita que dos cobros agoten un presupuesto a la vez.
- **Sin dependencias nuevas.**

## Verificado

Pruebas en `tests/db/loyalty.test.ts` (PGlite con las migraciones reales y el flujo real `crear → aceptar → listo → cobrar`), y `tests/loyalty/types.test.ts` para los esquemas de entrada. Ver la entrada `D-2026-11-27-01` del diario para el resultado de la corrida.

## No verificado / no implementado (etapas siguientes)

1. **Canje en el checkout.** Requiere cambiar `onza_command` (monto autorizado y capturado = total menos canje) y el flujo de captura. Es la etapa de mayor riesgo y necesita aprobación explícita y pruebas de concurrencia. Ya están previstos el asiento `redeem` y el consumo por `loyalty_allocations`.
2. **Interfaz.** Panel de administración (configuración, campañas, resumen) y vista del cliente (saldo, progreso, vencimientos). Los servicios y esquemas de entrada ya existen en `src/features/loyalty/`.
3. **Programador de vencimientos.** Hoy vencen de forma perezosa al leer la cuenta. Falta un barrido programado (`private.loyalty_expire` por local), como el de PEN-005.
4. **Captura sin reembolso.** Un pedido capturado que nunca llega a `delivered` ni a `refunded` conserva sus puntos. Revisar junto con la regla de pedidos `uncollected`.
5. **Concurrencia real.** Las pruebas son secuenciales (PGlite es una sola conexión). Falta una prueba de dos cobros simultáneos sobre el mismo presupuesto, como la de retiros.
6. **Fidelización avanzada:** recompra, frecuencia, referidos, recuperación, progreso visual y notificaciones; antifraude más allá de topes y de la idempotencia del abono; experimentos A/B; programa compartido entre locales; liquidaciones entre establecimientos. La arquitectura lo permite (el `funder` y la campaña están en cada asiento y el programa es una fila por local), pero no hay código.
7. **Aplicar** la migración 028 en un proyecto Supabase aislado (`db push --dry-run` primero) y comprobar RLS y RPC con sesiones reales.
8. **Decisión de producto pendiente:** `Onza-Product-Blueprint-v3.md` lista «fidelidad» como fuera del MVP. Esta etapa la habilita por encargo explícito. Falta que el dueño lo registre en la sección 0 del blueprint.
