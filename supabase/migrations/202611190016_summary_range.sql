-- Plan de pulido · E4: resumen de administración por período. ADITIVA (R4): función nueva; venue_summary queda intacta.
-- Reglas:
-- * Período = noches operativas [from_day 06:00, (to_day+1) 06:00) en America/Costa_Rica.
-- * Pedidos: por hora de entrada (queued_at, o created_at en pedidos anteriores a la migración 013); no cuentan las
--   reservas rechazadas al crear.
-- * Ventas netas: capturas confirmadas menos devoluciones confirmadas, por la hora de cada operación (no por la del
--   pedido). Las reservas no son ventas: el monto reservado es un saldo actual aparte, no histórico.
-- * Preparación = de aceptado a listo. Espera = de entrada a aceptado (base para medir la aceptación automática).
create or replace function public.venue_summary_range(venue uuid,from_day date,to_day date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 tz text:='America/Costa_Rica';
 from_ts timestamptz; to_ts timestamptz; grain text; result jsonb;
begin
 if not private.is_staff(venue,true) then raise exception 'NOT_AUTHORIZED'; end if;
 if from_day is null or to_day is null or to_day<from_day or to_day-from_day>366 then raise exception 'INVALID_INPUT'; end if;
 from_ts:=(from_day+time '06:00') at time zone tz;
 to_ts:=((to_day+1)+time '06:00') at time zone tz;
 grain:=case when from_day=to_day then 'hour' when to_day-from_day<=62 then 'day' else 'month' end;
 with o as (
  select x.*,coalesce(x.queued_at,x.created_at) as entered_at from public.orders x join private.payments p on p.order_id=x.id
  where x.venue_id=venue and p.status<>'failed' and coalesce(x.queued_at,x.created_at)>=from_ts and coalesce(x.queued_at,x.created_at)<to_ts
 ), money as (
  select op.created_at as at, case when op.type='capture' then op.amount_minor else -op.amount_minor end as amount, op.type
  from private.payment_operations op join private.payments p on p.id=op.payment_id join public.orders x on x.id=p.order_id
  where x.venue_id=venue and op.created_at>=from_ts and op.created_at<to_ts
   and ((op.type='capture' and op.provider_state='captured' and p.status in ('captured','refunded')) or (op.type='refund' and op.status='refunded'))
 ), prep as (
  select extract(epoch from x.ready_at-x.preparing_at) as s from public.orders x
  where x.venue_id=venue and x.ready_at>=from_ts and x.ready_at<to_ts and x.preparing_at is not null
 ), wait as (
  select extract(epoch from x.preparing_at-coalesce(x.queued_at,x.created_at)) as s from public.orders x
  where x.venue_id=venue and x.preparing_at>=from_ts and x.preparing_at<to_ts
 ), buckets as (
  select case grain
   when 'hour' then to_char(at at time zone tz,'HH24')
   when 'day' then to_char((at at time zone tz-interval '6 hours')::date,'YYYY-MM-DD')
   else to_char((at at time zone tz-interval '6 hours')::date,'YYYY-MM') end as bucket,kind,value
  from (select entered_at as at,'orders' as kind,1 as value from o union all select at,'net',amount from money) e
 )
 select jsonb_build_object(
  'from',from_day,'to',to_day,'timezone',tz,'cutoff','06:00','grain',grain,
  'orders',(select count(*) from o),
  'delivered_orders',(select count(*) from o where status='delivered'),
  'canceled_orders',(select count(*) from o where status in ('canceled','expired','uncollected')),
  'captured_minor',coalesce((select sum(amount) from money where type='capture'),0),
  'refunded_minor',coalesce((select -sum(amount) from money where type='refund'),0),
  'net_minor',coalesce((select sum(amount) from money),0),
  'reserved_now_minor',coalesce((select sum(p.authorized_minor) from private.payments p join public.orders x on x.id=p.order_id where x.venue_id=venue and p.status='authorized'),0),
  'active_orders',private.active_order_count(venue),
  'preparation_n',(select count(*) from prep),
  'median_preparation_seconds',(select percentile_cont(.5) within group(order by s) from prep),
  'p90_preparation_seconds',(select percentile_cont(.9) within group(order by s) from prep),
  'wait_n',(select count(*) from wait),
  'median_wait_seconds',(select percentile_cont(.5) within group(order by s) from wait),
  'series',coalesce((select jsonb_agg(jsonb_build_object('bucket',bucket,'orders',orders,'net_minor',net) order by bucket) from (
     select bucket,sum(value) filter(where kind='orders')::integer as orders,coalesce(sum(value) filter(where kind='net'),0)::integer as net from buckets group by bucket) s),'[]'::jsonb),
  'products',coalesce((select jsonb_agg(jsonb_build_object('product_id',product_id,'name_snapshot',name_snapshot,'units',units,'total_minor',total) order by units desc,name_snapshot) from (
     select i.product_id,i.name_snapshot,sum(i.quantity)::integer as units,sum(i.line_total_minor)::integer as total from public.order_items i join o on o.id=i.order_id where o.status='delivered' group by i.product_id,i.name_snapshot) pr),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke execute on function public.venue_summary_range(uuid,date,date) from public,anon;
grant execute on function public.venue_summary_range(uuid,date,date) to authenticated;
