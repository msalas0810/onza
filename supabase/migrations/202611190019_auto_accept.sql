-- Plan de pulido · E6: aceptación automática por local, apagada por defecto. ADITIVA (R4): columnas con valor por
-- defecto, tabla privada de registro, funciones nuevas y reemplazos compatibles de private.accept_order, sweep_orders y
-- private.create_order (ambos solo agregan la llamada a la automatización).
--
-- Reglas:
-- * La activa el administrador y fija el máximo de pedidos en preparación (distinto de la capacidad de admisión).
--   Cualquier persona del equipo del local puede volver a manual.
-- * Elegible solo si el local recibe (abierto y sin pausa), el pedido está en cola y vigente, la reserva está autorizada,
--   todos los artículos siguen disponibles y hay lugar en preparación. Si no, queda para decisión manual y se registra
--   el motivo (una vez por pedido y motivo).
-- * Usa la misma transición que «Aceptar» (private.accept_order, lock del pedido): doble clic, dos empleados y la
--   automatización no pueden aceptar dos veces. Las corridas automáticas de un local se serializan con un lock asesor.
-- * Corre en el servidor: al crear el pedido, en cada barrido (cualquier tráfico de clientes o equipo) y en
--   public.auto_accept_tick() para un programador externo con service_role. No depende del navegador de barra.

alter table public.venues
  add column if not exists auto_accept boolean not null default false,
  add column if not exists auto_accept_max_preparing integer not null default 5 check (auto_accept_max_preparing between 1 and 50);

create table if not exists private.auto_accept_log(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  venue_id uuid not null references public.venues(id),
  outcome text not null check (outcome in ('accepted','held')),
  reason text not null,
  created_at timestamptz not null default now(),
  unique(order_id,outcome,reason)
);
alter table private.auto_accept_log enable row level security;

-- Misma transición que la 013; la aceptación automática queda registrada sin actor humano y con su motivo.
create or replace function private.accept_order(target uuid,automatic boolean default false,meta jsonb default '{}') returns text language plpgsql security definer set search_path='' as $$
declare o public.orders; p private.payments;
begin
 select * into o from public.orders where id=target for update;
 if not found then return 'RESOURCE_NOT_FOUND'; end if;
 select * into p from private.payments where order_id=o.id for update;
 if o.status='queued' and o.deadline<=now() then perform private.expire_order(o.id); return 'ORDER_EXPIRED'; end if;
 if o.status='expired' then return 'ORDER_EXPIRED'; end if;
 if o.status<>'queued' or p.status<>'authorized' then return 'INVALID_TRANSITION'; end if;
 update public.orders set status='preparing',version=version+1,preparing_at=now(),deadline=now()+interval '2 hours' where id=o.id returning * into o;
 insert into public.order_events(order_id,venue_id,actor_id,type,from_status,to_status,metadata)
  values(o.id,o.venue_id,case when automatic then null else auth.uid() end,'accept','queued',o.status,coalesce(meta,'{}'::jsonb)||jsonb_build_object('automatic',automatic));
 return 'ok';
end $$;

-- Una corrida de aceptación automática para un local. Devuelve cuántos pedidos aceptó.
create or replace function private.auto_accept_venue(venue uuid) returns integer language plpgsql security definer set search_path='' as $$
declare v public.venues; o public.orders; preparing integer; accepted integer:=0; reason text; outcome text;
begin
 select * into v from public.venues where id=venue;
 if not found or not v.auto_accept then return 0; end if;
 perform pg_advisory_xact_lock(hashtextextended('auto-accept:'||venue::text,0));
 for o in select x.* from public.orders x join private.payments p on p.order_id=x.id
  where x.venue_id=venue and x.status='queued' order by coalesce(x.queued_at,x.created_at),x.id limit 50
 loop
  reason:=null;
  select * into v from public.venues where id=venue;
  select count(*) into preparing from public.orders where venue_id=venue and status='preparing';
  if not v.auto_accept then exit;
  elsif v.open_state<>'open' or v.paused then exit; -- una pausa corta la automatización; la cola sigue manual
  elsif o.deadline<=now() then reason:='expired';
  elsif not exists(select 1 from private.payments where order_id=o.id and status='authorized') then reason:='payment_not_authorized';
  elsif exists(select 1 from public.order_items i join public.products pr on pr.id=i.product_id where i.order_id=o.id and (not pr.available or pr.archived)) then reason:='out_of_stock';
  elsif preparing>=v.auto_accept_max_preparing then reason:='preparing_full';
  end if;
  if reason is not null then
   insert into private.auto_accept_log(order_id,venue_id,outcome,reason) values(o.id,venue,'held',reason) on conflict do nothing;
   if reason='preparing_full' then exit; end if; -- sin lugar en preparación no se adelanta a nadie
   continue;
  end if;
  outcome:=private.accept_order(o.id,true,jsonb_build_object('reason','auto_accept','max_preparing',v.auto_accept_max_preparing));
  if outcome='ok' then
   accepted:=accepted+1;
   insert into private.auto_accept_log(order_id,venue_id,outcome,reason) values(o.id,venue,'accepted','eligible') on conflict do nothing;
  else
   insert into private.auto_accept_log(order_id,venue_id,outcome,reason) values(o.id,venue,'held',lower(outcome)) on conflict do nothing;
  end if;
 end loop;
 return accepted;
end $$;

-- Barrido: vencimientos (013) y, después, aceptación automática de los locales que la tienen activa.
create or replace function public.sweep_orders() returns integer language plpgsql security definer set search_path='' as $$
declare o public.orders;n integer:=0;venue uuid;begin
 if auth.uid() is null then raise exception 'NOT_AUTHORIZED';end if;
 for o in select * from public.orders where deadline<=now() and status in ('queued','ready','pending_authorization') order by created_at limit 100 for update skip locked loop
  if private.expire_order(o.id) then n:=n+1; end if;
 end loop;
 for venue in select v.id from public.venues v where v.auto_accept and v.open_state='open' and not v.paused
  and exists(select 1 from public.orders x where x.venue_id=v.id and x.status='queued') loop
  perform private.auto_accept_venue(venue);
 end loop;
 return n;end$$;

-- Para un programador externo (service_role): la automatización corre aunque nadie tenga la app abierta.
create or replace function public.auto_accept_tick() returns integer language plpgsql security definer set search_path='' as $$
declare venue uuid; total integer:=0; o public.orders;
begin
 for o in select * from public.orders where deadline<=now() and status in ('queued','ready','pending_authorization') order by created_at limit 100 for update skip locked loop
  perform private.expire_order(o.id);
 end loop;
 for venue in select id from public.venues where auto_accept and open_state='open' and not paused loop
  total:=total+private.auto_accept_venue(venue);
 end loop;
 return total;
end $$;

-- Configuración: activar y fijar el máximo exige administración; volver a manual, cualquier persona del equipo del local.
create or replace function public.venue_auto_accept(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare venue uuid; enabled boolean; max_preparing integer; v public.venues;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHORIZED'; end if;
 begin venue:=(input->>'venueId')::uuid; exception when others then raise exception 'INVALID_INPUT'; end;
 if jsonb_typeof(input->'enabled')<>'boolean' then raise exception 'INVALID_INPUT'; end if;
 enabled:=(input->>'enabled')::boolean;
 if input ? 'maxPreparing' then
  begin max_preparing:=(input->>'maxPreparing')::integer; exception when others then raise exception 'INVALID_INPUT'; end;
  if max_preparing not between 1 and 50 then raise exception 'INVALID_INPUT'; end if;
 end if;
 if not private.is_staff(venue) then raise exception 'NOT_AUTHORIZED'; end if;
 if (enabled or max_preparing is not null) and not private.is_staff(venue,true) then raise exception 'NOT_AUTHORIZED'; end if;
 update public.venues set auto_accept=enabled,auto_accept_max_preparing=coalesce(max_preparing,auto_accept_max_preparing) where id=venue returning * into v;
 insert into private.platform_events(actor_id,action,venue_id,metadata) values(auth.uid(),'auto_accept',venue,jsonb_build_object('enabled',enabled,'maxPreparing',v.auto_accept_max_preparing));
 if enabled then perform private.auto_accept_venue(venue); end if;
 return jsonb_build_object('autoAccept',v.auto_accept,'maxPreparing',v.auto_accept_max_preparing);
end $$;

-- Medición para recomendar tiempos más adelante: espera (entrada → aceptado) y preparación (aceptado → listo) por hora
-- de entrada y tamaño del pedido, con mediana, p90 y tamaño de muestra. Solo administración.
create or replace function public.venue_timing_stats(venue uuid,from_day date,to_day date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare from_ts timestamptz; to_ts timestamptz; result jsonb;
begin
 if not private.is_staff(venue,true) then raise exception 'NOT_AUTHORIZED'; end if;
 if from_day is null or to_day is null or to_day<from_day or to_day-from_day>366 then raise exception 'INVALID_INPUT'; end if;
 from_ts:=(from_day+time '06:00') at time zone 'America/Costa_Rica';
 to_ts:=((to_day+1)+time '06:00') at time zone 'America/Costa_Rica';
 with o as (
  select x.id,coalesce(x.queued_at,x.created_at) as entered,x.preparing_at,x.ready_at,
   extract(hour from coalesce(x.queued_at,x.created_at) at time zone 'America/Costa_Rica')::integer as hour,
   (select sum(quantity) from public.order_items i where i.order_id=x.id) as units
  from public.orders x where x.venue_id=venue and x.preparing_at is not null and coalesce(x.queued_at,x.created_at)>=from_ts and coalesce(x.queued_at,x.created_at)<to_ts
 ), m as (
  select hour,case when units<=2 then '1-2' when units<=5 then '3-5' else '6+' end as size,
   extract(epoch from preparing_at-entered) as wait_s,
   case when ready_at is not null then extract(epoch from ready_at-preparing_at) end as prep_s
  from o
 )
 select coalesce(jsonb_agg(jsonb_build_object('hour',hour,'size',size,'n',n,'wait_median',wm,'wait_p90',wp,'prep_n',pn,'prep_median',pm,'prep_p90',pp) order by hour,size),'[]'::jsonb) into result from (
  select hour,size,count(*) as n,
   percentile_cont(.5) within group(order by wait_s) as wm,percentile_cont(.9) within group(order by wait_s) as wp,
   count(prep_s) as pn,percentile_cont(.5) within group(order by prep_s) as pm,percentile_cont(.9) within group(order by prep_s) as pp
  from m group by hour,size
 ) g;
 return result;
end $$;

-- Creación: igual a la 018 y, al final, una corrida de aceptación automática del local (si está activa).
create or replace function private.create_order(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); key text:=input->>'idempotencyKey';
 v public.venues; o public.orders; product public.products; p private.payments; previous private.commands;
 item jsonb; total integer:=0; units integer:=0; payload jsonb; scenario text; next_state text;
 cfg private.configuration; cooldown record; offer private.waitlist; others integer; queue_waiting boolean;
begin
 if key is null or length(key) not between 1 and 128 then raise exception 'INVALID_INPUT';end if;
 payload:=input-'idempotencyKey'-'tokenHash'-'encryptedToken';
 perform pg_advisory_xact_lock(hashtextextended(uid::text||key,0));
 select * into previous from private.commands where actor_id=uid and command_key=key;
 if found then if previous.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return private.order_view(previous.order_id);end if;
 if not private.limit_action('create',12) then return jsonb_build_object('error','RATE_LIMITED');end if;
 select * into cfg from private.configuration where id;
 select * into cooldown from private.cancel_cooldown(uid);
 if cooldown.retry_at is not null and cfg.cancel_limit_mode<>'off' then
  insert into private.abuse_events(actor_id,kind,retry_at,cancels) values(uid,case when cfg.cancel_limit_mode='enforce' then 'cancel_cooldown_blocked' else 'cancel_cooldown_observed' end,cooldown.retry_at,cooldown.cancels);
  if cfg.cancel_limit_mode='enforce' then return jsonb_build_object('error','CANCEL_COOLDOWN','retryAt',cooldown.retry_at); end if;
 end if;
 select * into v from public.venues where id=(input->>'venueId')::uuid for update;
 if not found then raise exception 'RESOURCE_NOT_FOUND';end if;
 if v.open_state<>'open' then raise exception 'VENUE_CLOSED';end if;
 if v.paused then raise exception 'VENUE_PAUSED';end if;
 perform private.waitlist_advance(v.id);
 select * into offer from private.waitlist where venue_id=v.id and customer_id=uid and status='offered' and offer_expires_at>now() for update;
 others:=private.held_offers(v.id,uid);
 queue_waiting:=exists(select 1 from private.waitlist where venue_id=v.id and status='waiting' and customer_id<>uid);
 -- Con oferta propia vigente, el cupo está retenido para esta cuenta. Sin oferta, nadie se adelanta a la fila.
 if private.active_order_count(v.id)+others>=v.capacity or (offer.id is null and queue_waiting) then
  return jsonb_build_object('error','VENUE_CAPACITY','waitlist',cfg.waitlist_enabled);
 end if;
 if input->>'termsVersion' is distinct from 'demo-v1' or input->>'privacyVersion' is distinct from 'demo-v1' or coalesce((input->>'adult')::boolean,false)=false then raise exception 'POLICY_REQUIRED';end if;
 if jsonb_typeof(input->'items')<>'array' or jsonb_array_length(input->'items') not between 1 and 20 then raise exception 'INVALID_INPUT';end if;
 if (select count(*) from jsonb_array_elements(input->'items'))<>(select count(distinct x->>'productId') from jsonb_array_elements(input->'items') x) then raise exception 'INVALID_INPUT';end if;
 for item in select * from jsonb_array_elements(input->'items') loop
  if not(item?'productId' and item?'quantity' and item?'expectedProductVersion') then raise exception 'INVALID_INPUT';end if;
  if (item->>'quantity')::numeric<>trunc((item->>'quantity')::numeric) or (item->>'quantity')::integer not between 1 and 10 then raise exception 'INVALID_QUANTITY';end if;
  select * into product from public.products where id=(item->>'productId')::uuid and venue_id=v.id for share;
  if not found or not product.available or product.archived then return jsonb_build_object('error','OUT_OF_STOCK','productId',item->>'productId');end if;
  if (item ? 'expectedPriceMinor' and product.price_minor<>(item->>'expectedPriceMinor')::integer)
     or (not (item ? 'expectedPriceMinor') and product.version is distinct from (item->>'expectedProductVersion')::integer) then
   return jsonb_build_object('error','PRICE_CHANGED','productId',product.id,'priceMinor',product.price_minor,'version',product.version);
  end if;
  total:=total+product.price_minor*(item->>'quantity')::integer;units:=units+(item->>'quantity')::integer;
 end loop;
 if units>v.max_units then raise exception 'INVALID_QUANTITY';end if;
 if length(input->>'tokenHash')<>64 or coalesce(length(input->>'encryptedToken'),0)<1 then raise exception 'INVALID_TOKEN';end if;
 scenario:=coalesce(input->>'scenario','approved');
 if scenario not in ('approved','declined','requires_action','timeout') then raise exception 'INVALID_INPUT';end if;
 next_state:=case scenario when 'approved' then 'queued' when 'declined' then 'canceled' else 'pending_authorization' end;
 insert into public.orders(venue_id,customer_id,public_code,status,total_minor,deadline,queued_at)
  values(v.id,uid,upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),next_state,total,
   case when next_state='queued' then now()+private.accept_window() else now()+interval '2 minutes' end,
   case when next_state='queued' then now() end) returning * into o;
 for item in select * from jsonb_array_elements(input->'items') loop
  select * into product from public.products where id=(item->>'productId')::uuid;
  insert into public.order_items(order_id,venue_id,product_id,name_snapshot,unit_price_minor_snapshot,quantity,line_total_minor) values(o.id,v.id,product.id,product.name,product.price_minor,(item->>'quantity')::integer,product.price_minor*(item->>'quantity')::integer);
 end loop;
 insert into private.payments(order_id,merchant_config_ref,status,authorized_minor,provider_reference) values(o.id,'mock:'||v.id,case scenario when 'approved' then 'authorized' when 'declined' then 'failed' when 'timeout' then 'unknown' else 'authorizing' end,case when scenario='approved' then total else 0 end,case when scenario<>'timeout' then 'mock-'||o.id else null end) returning * into p;
 insert into private.payment_operations(payment_id,type,idempotency_key,status,provider_state,amount_minor) values(p.id,'authorize','authorize:'||o.id,p.status,case scenario when 'approved' then 'authorized' when 'declined' then 'declined' when 'requires_action' then 'requires_action' else 'unknown' end,total);
 insert into private.pickup_tokens(order_id,token_hash,encrypted_token) values(o.id,input->>'tokenHash',input->>'encryptedToken');
 insert into private.policy_acceptances(order_id,customer_id,terms_version,privacy_version) values(o.id,uid,input->>'termsVersion',input->>'privacyVersion');
 insert into private.commands values(uid,key,payload,o.id);
 if offer.id is not null then update private.waitlist set status='claimed',order_id=o.id,closed_reason='order_created' where id=offer.id; end if;
 perform private.event(o,'created',null,case when offer.id is not null then jsonb_build_object('waitlist',offer.id) else '{}'::jsonb end);
 -- E6: aceptación automática en la misma transacción, con la transición común y sus reglas de elegibilidad.
 perform private.auto_accept_venue(v.id);
 return private.order_view(o.id);
end $$;

revoke execute on function public.auto_accept_tick() from public,anon,authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  grant execute on function public.auto_accept_tick() to service_role;
 end if;
end $$;
revoke execute on function public.venue_auto_accept(jsonb),public.venue_timing_stats(uuid,date,date) from public,anon;
grant execute on function public.venue_auto_accept(jsonb),public.venue_timing_stats(uuid,date,date) to authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_staff(uuid,boolean), private.can_read_order(uuid) to anon, authenticated;
