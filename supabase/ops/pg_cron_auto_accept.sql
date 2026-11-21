-- OPERACIÓN (no es una migración; no se aplica sola). Programa el trabajo periódico que hoy depende de que haya tráfico:
-- vencimientos de pedidos (5 minutos para aceptar, retiros sin recoger) y aceptación automática de los locales que la
-- tengan encendida. public.auto_accept_tick() es idempotente: usa los mismos bloqueos que «Aceptar», así que dos corridas
-- simultáneas, o una corrida y un operador, no duplican nada (probado en scripts/audit/concurrency.mjs, C4 y C10).
--
-- Pasos para una persona autorizada (cambio remoto: requiere decisión aparte):
--   1. En un proyecto de prueba aislado: Dashboard → Database → Extensions → habilitar `pg_cron`.
--   2. Ejecutar este archivo en el editor SQL del proyecto de prueba y verificar `select * from cron.job_run_details order by start_time desc limit 5;`
--   3. Repetir en el proyecto alojado solo después de revisar el resultado.
-- Cadencia: cada 10 segundos (pg_cron ≥ 1.5 admite intervalos en segundos). Si la versión instalada solo admite minutos, usar '* * * * *'.
select cron.schedule('onza-tick', '10 seconds', $$select public.auto_accept_tick()$$);
-- Para detenerlo: select cron.unschedule('onza-tick');
-- Limpieza de tablas de registro (opcional, semanal): conservar 90 días de abuse_events y auto_accept_log.
select cron.schedule('onza-retention', '0 9 * * 0', $$
  delete from private.abuse_events where created_at < now() - interval '90 days';
  delete from private.auto_accept_log where created_at < now() - interval '90 days';
$$);
