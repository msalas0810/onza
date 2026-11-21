-- Auditoría de escala (2026-11-21): el límite de validaciones de retiro (`resolve`) era de 10 por minuto y por cuenta del equipo.
-- A la carga objetivo del plan (30 pedidos por minuto repartidos entre 3 empleados = 10 retiros por minuto cada uno) el límite
-- ya se alcanzaba: en la carga sostenida de 15 min hubo 48 `RATE_LIMITED` legítimos y los retiros se frenaban. Se sube a 60 por
-- minuto y por cuenta. El código manual sigue siendo de 48 bits derivados de un digest de 256 bits y solo resuelve dentro del
-- local de quien lo escribe: a 60 intentos por minuto buscar un código concreto lleva del orden de 10^12 minutos, y los intentos
-- inválidos siguen contando. DECISIÓN DE SEGURIDAD A CONFIRMAR POR EL DUEÑO DEL PRODUCTO: se revierte con otra migración que
-- vuelva a `greatest(max_count, 10)` (el valor pasa por esta única función; no se reemplaza onza_command).
create or replace function private.limit_action(bucket_name text,max_count integer) returns boolean language plpgsql security definer set search_path='' as $$
 declare n integer; cap integer:=case when bucket_name='resolve' then greatest(max_count,60) else max_count end; begin
 insert into private.rate_limits(actor_id,bucket) values(auth.uid(),bucket_name) on conflict(actor_id,bucket) do update set count=case when private.rate_limits.window_start<date_trunc('minute',now()) then 1 else private.rate_limits.count+1 end,window_start=date_trunc('minute',now()) returning count into n;
 return n<=cap;
 end $$;
revoke execute on function private.limit_action(text,integer) from public,anon,authenticated;
