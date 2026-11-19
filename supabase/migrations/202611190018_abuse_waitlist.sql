-- Plan de pulido · E5: límite por cancelaciones del cliente y lista de espera con ofertas de cupo.
-- ADITIVA (R4): columnas con valor por defecto en private.configuration, tablas privadas nuevas, funciones nuevas y
-- reemplazo de private.create_order (helper interno de la 013). onza_command no cambia.
--
-- Parámetros de piloto (private.configuration; se cambian por SQL, nunca desde el navegador):
-- * cancel_limit_mode: 'off' | 'observe' (por defecto: registra, no bloquea) | 'enforce'.
-- * 3 cancelaciones confirmadas por el cliente, de pedidos distintos, en 10 minutos → 5 minutos sin crear pedidos.
--   No cuentan rechazos del local, vencimientos, rechazos técnicos de la reserva ni reintentos de la misma operación
--   (un pedido se cancela una sola vez). Ver, cancelar y retirar pedidos existentes nunca se bloquea.
-- * Lista de espera: oferta de 2 minutos, espera máxima de 10 minutos, un lugar por cuenta y local. Sin pedido ni reserva
--   de dinero mientras se espera: el pedido nace al confirmar la oferta, revalidando stock, precio, local y capacidad.
--   Con el local pausado o cerrado no se hacen ofertas nuevas.

alter table private.configuration
  add column if not exists cancel_limit_mode text not null default 'observe' check (cancel_limit_mode in ('off','observe','enforce')),
  add column if not exists cancel_limit_count integer not null default 3 check (cancel_limit_count between 1 and 20),
  add column if not exists cancel_window_seconds integer not null default 600 check (cancel_window_seconds between 60 and 86400),
  add column if not exists cancel_cooldown_seconds integer not null default 300 check (cancel_cooldown_seconds between 60 and 86400),
  add column if not exists waitlist_enabled boolean not null default true,
  add column if not exists waitlist_offer_seconds integer not null default 120 check (waitlist_offer_seconds between 30 and 900),
  add column if not exists waitlist_max_wait_seconds integer not null default 600 check (waitlist_max_wait_seconds between 60 and 7200);

-- Registro para soporte: bloqueos aplicados y bloqueos que se habrían aplicado en observación.
create table if not exists private.abuse_events(
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  kind text not null check (kind in ('cancel_cooldown_blocked','cancel_cooldown_observed')),
  retry_at timestamptz not null,
  cancels integer not null,
  created_at timestamptz not null default now()
);
create index if not exists abuse_events_actor on private.abuse_events(actor_id,created_at desc);
create index if not exists order_events_customer_cancel on public.order_events(actor_id,created_at) where type='cancel';

create table if not exists private.waitlist(
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id),
  customer_id uuid not null references auth.users(id),
  status text not null default 'waiting' check (status in ('waiting','offered','claimed','expired','left')),
  created_at timestamptz not null default now(),
  wait_expires_at timestamptz not null,
  offered_at timestamptz,
  offer_expires_at timestamptz,
  order_id uuid references public.orders(id),
  closed_reason text
);
create unique index if not exists waitlist_one_open on private.waitlist(venue_id,customer_id) where status in ('waiting','offered');
create index if not exists waitlist_queue on private.waitlist(venue_id,status,created_at);
alter table private.abuse_events enable row level security;
alter table private.waitlist enable row level security;

-- Cuándo vuelve a poder pedir la cuenta (null si no hay pausa vigente) y cuántas cancelaciones cuenta la ventana.
create or replace function private.cancel_cooldown(uid uuid) returns table(retry_at timestamptz,cancels integer) language plpgsql stable security definer set search_path='' as $$
declare cfg private.configuration; latest timestamptz; n integer;
begin
 select * into cfg from private.configuration where id;
 select count(distinct e.order_id),max(e.created_at) into n,latest from public.order_events e join public.orders o on o.id=e.order_id
 where e.type='cancel' and e.actor_id=uid and o.customer_id=uid and coalesce(e.metadata->>'by','customer')='customer'
   and e.created_at>now()-make_interval(secs=>cfg.cancel_window_seconds);
 if n>=cfg.cancel_limit_count and latest+make_interval(secs=>cfg.cancel_cooldown_seconds)>now() then
  return query select latest+make_interval(secs=>cfg.cancel_cooldown_seconds),n;
 else
  return query select null::timestamptz,n;
 end if;
end $$;

-- Ofertas pendientes de otros clientes (cupos retenidos) en el local.
create or replace function private.held_offers(venue uuid,except_customer uuid default null) returns integer language sql stable security definer set search_path='' as $$
 select count(*)::integer from private.waitlist where venue_id=venue and status='offered' and offer_expires_at>now() and (except_customer is null or customer_id<>except_customer)
$$;

-- Vence esperas y ofertas, y ofrece cupos libres en orden de llegada. Debe llamarse con el local bloqueado (for update).
create or replace function private.waitlist_advance(venue uuid) returns void language plpgsql security definer set search_path='' as $$
declare v public.venues; cfg private.configuration; free integer; entry private.waitlist;
begin
 select * into cfg from private.configuration where id;
 select * into v from public.venues where id=venue;
 update private.waitlist set status='expired',closed_reason='offer_expired' where venue_id=venue and status='offered' and offer_expires_at<=now();
 update private.waitlist set status='expired',closed_reason='wait_expired' where venue_id=venue and status='waiting' and wait_expires_at<=now();
 if not cfg.waitlist_enabled or v.open_state<>'open' or v.paused then return; end if;
 free:=v.capacity-private.active_order_count(venue)-private.held_offers(venue);
 while free>0 loop
  select * into entry from private.waitlist where venue_id=venue and status='waiting' order by created_at,id limit 1 for update;
  exit when not found;
  update private.waitlist set status='offered',offered_at=now(),offer_expires_at=now()+make_interval(secs=>cfg.waitlist_offer_seconds) where id=entry.id;
  free:=free-1;
 end loop;
end $$;

create or replace function private.waitlist_view(entry private.waitlist) returns jsonb language sql stable security definer set search_path='' as $$
 select case when entry.id is null then jsonb_build_object('status','none','server_now',now()) else
  jsonb_build_object('id',entry.id,'status',entry.status,'venue_id',entry.venue_id,'created_at',entry.created_at,
   'wait_expires_at',entry.wait_expires_at,'offer_expires_at',entry.offer_expires_at,'order_id',entry.order_id,'closed_reason',entry.closed_reason,
   'position',case when entry.status='waiting' then (select count(*)+1 from private.waitlist w where w.venue_id=entry.venue_id and w.status='waiting' and (w.created_at,w.id)<(entry.created_at,entry.id)) end,
   'venue_paused',(select paused or open_state<>'open' from public.venues where id=entry.venue_id),
   'server_now',now()) end
$$;

-- Lista de espera del cliente: join / status / leave. Un lugar abierto por cuenta y local.
create or replace function public.waitlist_command(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); action text:=input->>'action'; venue uuid; v public.venues; cfg private.configuration; entry private.waitlist; cooldown record;
begin
 if uid is null then raise exception 'SESSION_REQUIRED'; end if;
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'ACCOUNT_REQUIRED'; end if;
 if exists(select 1 from public.memberships m where m.user_id=uid) then raise exception 'STAFF_CANNOT_ORDER'; end if;
 begin venue:=(input->>'venueId')::uuid; exception when others then raise exception 'INVALID_INPUT'; end;
 select * into cfg from private.configuration where id;
 select * into v from public.venues where id=venue for update;
 if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
 perform public.sweep_orders();
 perform private.waitlist_advance(venue);
 select * into entry from private.waitlist where venue_id=venue and customer_id=uid order by created_at desc limit 1;
 if action='status' then
  return private.waitlist_view(entry);
 elsif action='leave' then
  if entry.status in ('waiting','offered') then
   update private.waitlist set status='left',closed_reason='customer' where id=entry.id returning * into entry;
   perform private.waitlist_advance(venue);
  end if;
  return private.waitlist_view(entry);
 elsif action='join' then
  if not cfg.waitlist_enabled then raise exception 'WAITLIST_DISABLED'; end if;
  if v.open_state<>'open' then raise exception 'VENUE_CLOSED'; end if;
  if v.paused then raise exception 'VENUE_PAUSED'; end if;
  if entry.status in ('waiting','offered') then return private.waitlist_view(entry); end if;
  select * into cooldown from private.cancel_cooldown(uid);
  if cooldown.retry_at is not null and cfg.cancel_limit_mode='enforce' then
   return jsonb_build_object('error','CANCEL_COOLDOWN','retryAt',cooldown.retry_at);
  end if;
  insert into private.waitlist(venue_id,customer_id,wait_expires_at) values(venue,uid,now()+make_interval(secs=>cfg.waitlist_max_wait_seconds)) returning * into entry;
  perform private.waitlist_advance(venue);
  select * into entry from private.waitlist where id=entry.id;
  return private.waitlist_view(entry);
 end if;
 raise exception 'INVALID_INPUT';
end $$;
revoke execute on function public.waitlist_command(jsonb) from public,anon;
grant execute on function public.waitlist_command(jsonb) to authenticated;

-- Creación de pedido con límite por cancelaciones y cupos de lista de espera. Igual a la 013 en todo lo demás.
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
 return private.order_view(o.id);
end $$;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_staff(uuid,boolean), private.can_read_order(uuid) to anon, authenticated;
