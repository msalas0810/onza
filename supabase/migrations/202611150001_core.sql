-- Onza demo only. No real payment integration. All money is integer centésimos CRC.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.configuration (id boolean primary key default true check(id), demo_enabled boolean not null default false);
insert into private.configuration values(true,false);
create table public.venues (
 id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null check(length(name) between 1 and 100), zone text not null default '',
 timezone text not null default 'America/Costa_Rica' check(timezone='America/Costa_Rica'), currency text not null default 'CRC' check(currency='CRC'),
 open_state text not null default 'open' check(open_state in ('open','closed')), paused boolean not null default false,
 pickup_label text not null default 'Barra principal', support_contact text not null default '', hours text not null default 'Consultar al local',
 eta_minutes integer not null default 15 check(eta_minutes between 1 and 120), capacity integer not null default 30 check(capacity between 1 and 100),max_units integer not null default 20 check(max_units between 1 and 100)
);
create table public.memberships(user_id uuid not null references auth.users(id),venue_id uuid not null references public.venues(id),role text not null check(role in ('bartender','admin','onza')),primary key(user_id,venue_id));
create table public.categories(id uuid primary key default gen_random_uuid(),venue_id uuid not null references public.venues(id),label text not null,position integer not null default 0,unique(id,venue_id),unique(venue_id,label));
create table public.products(id uuid primary key default gen_random_uuid(),venue_id uuid not null references public.venues(id),category_id uuid not null,name text not null check(length(name) between 1 and 100),description text not null default '' check(length(description)<=500),price_minor integer not null check(price_minor between 0 and 100000000),photo_path text,size text not null default '',allergens text not null default 'No informado por el local',available boolean not null default true,archived boolean not null default false,version integer not null default 1,unique(id,venue_id),foreign key(category_id,venue_id) references public.categories(id,venue_id));
create table public.orders(
 id uuid primary key default gen_random_uuid(),venue_id uuid not null references public.venues(id),customer_id uuid not null references auth.users(id),public_code text not null unique,
 status text not null check(status in ('pending_authorization','queued','preparing','ready','delivered','canceled','expired','uncollected')),
 total_minor integer not null check(total_minor>=0),currency text not null default 'CRC' check(currency='CRC'),version integer not null default 1,
 created_at timestamptz not null default now(),preparing_at timestamptz,ready_at timestamptz,delivered_at timestamptz,deadline timestamptz not null,
 business_date date not null default ((now() at time zone 'America/Costa_Rica' - interval '6 hours')::date),unique(id,venue_id)
);
create table public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid not null,venue_id uuid not null,product_id uuid not null,name_snapshot text not null,unit_price_minor_snapshot integer not null check(unit_price_minor_snapshot>=0),quantity integer not null check(quantity between 1 and 10),line_total_minor integer not null check(line_total_minor=unit_price_minor_snapshot*quantity),foreign key(order_id,venue_id) references public.orders(id,venue_id),foreign key(product_id,venue_id) references public.products(id,venue_id),unique(order_id,product_id));
create table private.payments(id uuid primary key default gen_random_uuid(),order_id uuid not null unique references public.orders(id),provider text not null default 'mock' check(provider='mock'),merchant_config_ref text not null,status text not null check(status in ('authorizing','authorized','capture_pending','captured','void_pending','voided','failed','unknown','refund_pending','refunded')),authorized_minor integer not null default 0,captured_minor integer not null default 0,refunded_minor integer not null default 0,provider_reference text,expires_at timestamptz not null default now()+interval '2 hours',check(authorized_minor>=0 and captured_minor>=0 and refunded_minor between 0 and captured_minor));
create table private.payment_operations(id uuid primary key default gen_random_uuid(),payment_id uuid not null references private.payments(id),type text not null check(type in ('authorize','capture','void','refund')),idempotency_key text not null unique,status text not null,provider_state text not null,amount_minor integer not null,created_at timestamptz not null default now(),unique(payment_id,type));
create table public.order_events(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id),venue_id uuid not null references public.venues(id),actor_id uuid references auth.users(id),type text not null,from_status text,to_status text,created_at timestamptz not null default now(),metadata jsonb not null default '{}');
create table private.pickup_tokens(order_id uuid primary key references public.orders(id),token_hash text not null unique,encrypted_token text not null,expires_at timestamptz not null default now()+interval '2 hours',consumed_at timestamptz);
create table private.pickup_claims(id uuid primary key default gen_random_uuid(),order_id uuid not null unique references public.orders(id),owner_user_id uuid not null references auth.users(id),owner_staff_session_id text not null,status text not null default 'claimed',claimed_at timestamptz not null default now());
create table private.notifications(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id),event_id uuid not null references public.order_events(id),channel text not null default 'foreground',status text not null default 'pending_client',unique(event_id,channel));
create table private.policy_acceptances(order_id uuid primary key references public.orders(id),customer_id uuid not null references auth.users(id),terms_version text not null,privacy_version text not null,accepted_at timestamptz not null default now());
create table private.commands(actor_id uuid not null,command_key text not null,payload jsonb not null,order_id uuid not null references public.orders(id),primary key(actor_id,command_key));
create table private.rate_limits(actor_id uuid not null,bucket text not null,window_start timestamptz not null default date_trunc('minute',now()),count integer not null default 1,primary key(actor_id,bucket));
create index orders_queue on public.orders(venue_id,status,created_at);
create index orders_customer on public.orders(customer_id,created_at desc);
create index products_menu on public.products(venue_id,category_id,available);
create index events_order on public.order_events(order_id,created_at);
create index items_order on public.order_items(order_id);

create function private.is_staff(v uuid,admin_only boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false and exists(select 1 from public.memberships m where m.user_id=auth.uid() and m.venue_id=v and (not admin_only or m.role in ('admin','onza')))
$$;
create function public.has_venue_access(venue uuid,admin_only boolean default false) returns boolean language sql stable security definer set search_path='' as $$select private.is_staff(venue,admin_only)$$;
create function private.can_read_order(o uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.orders where id=o and (customer_id=auth.uid() or private.is_staff(venue_id)))$$;
create function public.business_date_at(instant timestamptz) returns date language sql immutable set search_path='' as $$select (instant at time zone 'America/Costa_Rica' - interval '6 hours')::date$$;

alter table public.venues enable row level security;
alter table public.products enable row level security;
alter table public.categories enable row level security;
alter table public.memberships enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
create policy venues_read on public.venues for select using(true);
create policy categories_read on public.categories for select using(true);
create policy products_read on public.products for select using(not archived or private.is_staff(venue_id,true));
create policy own_membership on public.memberships for select to authenticated using(user_id=auth.uid() and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false);
create policy orders_read on public.orders for select to authenticated using(customer_id=auth.uid() or private.is_staff(venue_id));
create policy items_read on public.order_items for select to authenticated using(private.can_read_order(order_id));
create policy events_read on public.order_events for select to authenticated using(private.can_read_order(order_id));
grant usage on schema public to anon,authenticated;
grant select on public.venues,public.products,public.categories to anon,authenticated;
grant select on public.memberships,public.orders,public.order_items,public.order_events to authenticated;
-- RLS helpers are granted through a locked private schema for policy evaluation only.
grant usage on schema private to authenticated,anon;
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.is_staff(uuid,boolean),private.can_read_order(uuid) to authenticated,anon;

create function private.limit_action(bucket_name text,max_count integer) returns boolean language plpgsql security definer set search_path='' as $$
 declare n integer; begin
 insert into private.rate_limits(actor_id,bucket) values(auth.uid(),bucket_name) on conflict(actor_id,bucket) do update set count=case when private.rate_limits.window_start<date_trunc('minute',now()) then 1 else private.rate_limits.count+1 end,window_start=date_trunc('minute',now()) returning count into n;
 return n<=max_count;
 end $$;
create function private.event(o public.orders,event_type text,from_state text default null,meta jsonb default '{}') returns uuid language plpgsql set search_path='' as $$declare event_id uuid;begin
 insert into public.order_events(order_id,venue_id,actor_id,type,from_status,to_status,metadata) values(o.id,o.venue_id,auth.uid(),event_type,from_state,o.status,meta) returning id into event_id;return event_id;end$$;
create function private.order_view(target_order_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(o)||jsonb_build_object('payment_state',p.status,'capture_state',(select provider_state from private.payment_operations where payment_id=p.id and type='capture'),'authorized_minor',p.authorized_minor,'captured_minor',p.captured_minor,'refunded_minor',p.refunded_minor,'venue',to_jsonb(v),'items',coalesce((select jsonb_agg(i order by i.id) from public.order_items i where i.order_id=o.id),'[]'::jsonb),'events',coalesce((select jsonb_agg(e order by e.created_at) from public.order_events e where e.order_id=o.id),'[]'::jsonb),'claim_id',case when c.owner_user_id=auth.uid() and c.owner_staff_session_id=auth.jwt()->>'session_id' then c.id else null end,'claimed_elsewhere',c.id is not null and not(c.owner_user_id=auth.uid() and c.owner_staff_session_id=auth.jwt()->>'session_id'),'encrypted_token',case when o.customer_id=auth.uid() and o.status='ready' and p.status in ('authorized','unknown','captured') and t.consumed_at is null and t.expires_at>now() then t.encrypted_token else null end)
 from public.orders o join public.venues v on v.id=o.venue_id join private.payments p on p.order_id=o.id left join private.pickup_claims c on c.order_id=o.id left join private.pickup_tokens t on t.order_id=o.id where o.id=target_order_id
$$;

-- All commands execute under a transaction; locks do not span external network I/O.
-- The mock ledger lives in PostgreSQL, so process restarts cannot duplicate a charge.
create function public.onza_command(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 action text:=input->>'action'; uid uuid:=auth.uid(); sid text:=auth.jwt()->>'session_id';
 v public.venues; o public.orders; product public.products; p private.payments; c private.pickup_claims;
 item jsonb; total integer:=0; units integer:=0; payload jsonb; previous private.commands; event_id uuid; scenario text; next_state text; op private.payment_operations; key text:=input->>'idempotencyKey'; count_active integer; token private.pickup_tokens; result jsonb;
begin
 if uid is null then raise exception 'NOT_AUTHORIZED';end if;
 if not (select demo_enabled from private.configuration where id) then raise exception 'DEMO_NOT_ENABLED';end if;
 perform public.sweep_orders();
 if action='create' then
  if key is null or length(key) not between 1 and 128 then raise exception 'INVALID_INPUT';end if;
  payload:=input-'idempotencyKey'-'tokenHash'-'encryptedToken';
  perform pg_advisory_xact_lock(hashtextextended(uid::text||key,0));
  select * into previous from private.commands where actor_id=uid and command_key=key;
  if found then if previous.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return private.order_view(previous.order_id);end if;
  if not private.limit_action('create',12) then return jsonb_build_object('error','RATE_LIMITED');end if;
  select * into v from public.venues where id=(input->>'venueId')::uuid for update;
  if not found or v.open_state<>'open' or v.paused then raise exception 'VENUE_PAUSED';end if;
  select count(*) into count_active from public.orders where venue_id=v.id and status in ('pending_authorization','queued','preparing','ready');
  if count_active>=v.capacity then raise exception 'VENUE_CAPACITY';end if;
  if input->>'termsVersion' is distinct from 'demo-v1' or input->>'privacyVersion' is distinct from 'demo-v1' or coalesce((input->>'adult')::boolean,false)=false then raise exception 'POLICY_REQUIRED';end if;
  if jsonb_typeof(input->'items')<>'array' or jsonb_array_length(input->'items') not between 1 and 20 then raise exception 'INVALID_INPUT';end if;
  if (select count(*) from jsonb_array_elements(input->'items'))<>(select count(distinct x->>'productId') from jsonb_array_elements(input->'items') x) then raise exception 'INVALID_INPUT';end if;
  for item in select * from jsonb_array_elements(input->'items') loop
   if not(item?'productId' and item?'quantity' and item?'expectedProductVersion') then raise exception 'INVALID_INPUT';end if;
   if (item->>'quantity')::numeric<>trunc((item->>'quantity')::numeric) or (item->>'quantity')::integer not between 1 and 10 then raise exception 'INVALID_QUANTITY';end if;
   select * into product from public.products where id=(item->>'productId')::uuid and venue_id=v.id for share;
   if not found or not product.available or product.archived then raise exception 'OUT_OF_STOCK';end if;
   if product.version is distinct from (item->>'expectedProductVersion')::integer then raise exception 'PRICE_CHANGED';end if;
   total:=total+product.price_minor*(item->>'quantity')::integer;units:=units+(item->>'quantity')::integer;
  end loop;
  if units>v.max_units then raise exception 'INVALID_QUANTITY';end if;
  if length(input->>'tokenHash')<>64 or coalesce(length(input->>'encryptedToken'),0)<1 then raise exception 'INVALID_TOKEN';end if;
  scenario:=coalesce(input->>'scenario','approved');
  if scenario not in ('approved','declined','requires_action','timeout') then raise exception 'INVALID_INPUT';end if;
  next_state:=case scenario when 'approved' then 'queued' when 'declined' then 'canceled' else 'pending_authorization' end;
  insert into public.orders(venue_id,customer_id,public_code,status,total_minor,deadline) values(v.id,uid,upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),next_state,total,now()+interval '2 minutes') returning * into o;
  for item in select * from jsonb_array_elements(input->'items') loop
   select * into product from public.products where id=(item->>'productId')::uuid;
   insert into public.order_items(order_id,venue_id,product_id,name_snapshot,unit_price_minor_snapshot,quantity,line_total_minor) values(o.id,v.id,product.id,product.name,product.price_minor,(item->>'quantity')::integer,product.price_minor*(item->>'quantity')::integer);
  end loop;
  insert into private.payments(order_id,merchant_config_ref,status,authorized_minor,provider_reference) values(o.id,'mock:'||v.id,case scenario when 'approved' then 'authorized' when 'declined' then 'failed' when 'timeout' then 'unknown' else 'authorizing' end,case when scenario='approved' then total else 0 end,case when scenario<>'timeout' then 'mock-'||o.id else null end) returning * into p;
  insert into private.payment_operations(payment_id,type,idempotency_key,status,provider_state,amount_minor) values(p.id,'authorize','authorize:'||o.id,p.status,case scenario when 'approved' then 'authorized' when 'declined' then 'declined' when 'requires_action' then 'requires_action' else 'unknown' end,total);
  insert into private.pickup_tokens(order_id,token_hash,encrypted_token) values(o.id,input->>'tokenHash',input->>'encryptedToken');
  insert into private.policy_acceptances(order_id,customer_id,terms_version,privacy_version) values(o.id,uid,input->>'termsVersion',input->>'privacyVersion');
  insert into private.commands values(uid,key,payload,o.id);
  perform private.event(o,'created');return private.order_view(o.id);
 end if;
 if action='venue_update' then
  if not private.is_staff((input->>'venueId')::uuid) then raise exception 'NOT_AUTHORIZED';end if;
  if input-'action'-'venueId'-'paused'<>'{}'::jsonb and not private.is_staff((input->>'venueId')::uuid,true) then raise exception 'NOT_AUTHORIZED';end if;
  update public.venues set paused=coalesce((input->>'paused')::boolean,paused),name=coalesce(nullif(input->>'name',''),name),zone=coalesce(input->>'zone',zone),pickup_label=coalesce(input->>'pickupLabel',pickup_label),support_contact=coalesce(input->>'supportContact',support_contact),hours=coalesce(input->>'hours',hours),open_state=coalesce(input->>'openState',open_state),eta_minutes=coalesce((input->>'etaMinutes')::integer,eta_minutes),capacity=coalesce((input->>'capacity')::integer,capacity) where id=(input->>'venueId')::uuid returning * into v;
  return to_jsonb(v);
 end if;
 if action='product_save' then
  if not private.is_staff((input->>'venueId')::uuid,true) then raise exception 'NOT_AUTHORIZED';end if;
  if input->>'productId' is null then
   insert into public.products(venue_id,category_id,name,description,price_minor,size,allergens,available,photo_path) values((input->>'venueId')::uuid,(input->>'categoryId')::uuid,input->>'name',coalesce(input->>'description',''),(input->>'priceMinor')::integer,coalesce(input->>'size',''),coalesce(input->>'allergens','No informado por el local'),coalesce((input->>'available')::boolean,true),input->>'photoPath') returning * into product;
  else
   update public.products set name=coalesce(input->>'name',name),description=coalesce(input->>'description',description),price_minor=coalesce((input->>'priceMinor')::integer,price_minor),category_id=coalesce((input->>'categoryId')::uuid,category_id),size=coalesce(input->>'size',size),allergens=coalesce(input->>'allergens',allergens),photo_path=case when input?'photoPath' then input->>'photoPath' else photo_path end,available=coalesce((input->>'available')::boolean,available),archived=coalesce((input->>'archived')::boolean,archived),version=version+1 where id=(input->>'productId')::uuid and venue_id=(input->>'venueId')::uuid and version=(input->>'expectedVersion')::integer returning * into product;
   if not found then raise exception 'VERSION_CONFLICT';end if;
  end if;return to_jsonb(product);
 end if;
 if action='resolve' then
  if not private.limit_action('resolve',10) then return jsonb_build_object('error','RATE_LIMITED');end if;
  select * into o from public.orders where venue_id=(input->>'venueId')::uuid and (public_code=upper(input->>'code') or id in(select order_id from private.pickup_tokens where token_hash=input->>'tokenHash'));
  if not found or not private.is_staff(o.venue_id) then return jsonb_build_object('error','INVALID_PICKUP');end if;
 else
  select * into o from public.orders where id=(input->>'orderId')::uuid;
  if not found or not(o.customer_id=uid or private.is_staff(o.venue_id)) then raise exception 'NOT_AUTHORIZED';end if;
 end if;
 -- Serialize all mutations on one order, including cancellation/capture races.
 select * into o from public.orders where id=o.id for update;
 select * into p from private.payments where private.payments.order_id=o.id for update;
 select * into c from private.pickup_claims where private.pickup_claims.order_id=o.id;
 if action='get' then return private.order_view(o.id);end if;
 if action='reconcile_authorization' then
  if not private.is_staff(o.venue_id,true) then raise exception 'NOT_AUTHORIZED';end if;
  if o.status<>'pending_authorization' or p.status<>'unknown' or coalesce((input->>'providerResultConfirmed')::boolean,false)=false or length(coalesce(input->>'reason',''))<5 or coalesce(input->>'outcome','') not in ('authorized','voided') then raise exception 'INVALID_TRANSITION';end if;
  -- Explicit simulated provider evidence; no second authorize attempt is performed.
  update private.payment_operations set status=input->>'outcome',provider_state=input->>'outcome' where payment_id=p.id and type='authorize';
  update private.payments set status=input->>'outcome',authorized_minor=case when input->>'outcome'='authorized' then o.total_minor else 0 end,provider_reference='mock-reconciled-'||o.id where id=p.id;
  update public.orders set status=case when input->>'outcome'='authorized' then 'queued' else 'canceled' end,deadline=now()+interval '2 minutes',version=version+1 where id=o.id returning * into o;
  perform private.event(o,'authorization_reconciled',null,jsonb_build_object('reason',input->>'reason','evidence','simulated_provider_result'));return private.order_view(o.id);
 end if;
 if action='authorize_action' then
  if o.customer_id<>uid or o.status<>'pending_authorization' or p.status<>'authorizing' then raise exception 'INVALID_TRANSITION';end if;
  update private.payments set status='authorized',authorized_minor=o.total_minor where id=p.id;
  update private.payment_operations set status='authorized',provider_state='authorized' where payment_id=p.id and type='authorize';
  update public.orders set status='queued',version=version+1,deadline=now()+interval '2 minutes' where id=o.id returning * into o;
  perform private.event(o,'authorization_confirmed');return private.order_view(o.id);
 end if;
 if action in ('accept','ready','cancel') then
  if key is null or input->>'expectedVersion' is null then raise exception 'INVALID_INPUT';end if;
  payload:=input-'idempotencyKey';select * into previous from private.commands where actor_id=uid and command_key=key;
  if found then if previous.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return private.order_view(previous.order_id);end if;
  if o.version<>(input->>'expectedVersion')::integer then raise exception 'VERSION_CONFLICT';end if;
  next_state:=o.status;
  if action='accept' then
   if not private.is_staff(o.venue_id) then raise exception 'NOT_AUTHORIZED';end if;
   if o.status<>'queued' or p.status<>'authorized' then raise exception 'INVALID_TRANSITION';end if;
   next_state:='preparing';
  elsif action='ready' then
   if not private.is_staff(o.venue_id) then raise exception 'NOT_AUTHORIZED';end if;
   if o.status<>'preparing' or p.status<>'authorized' then raise exception 'INVALID_TRANSITION';end if;
   next_state:='ready';
  else
   if length(trim(coalesce(input->>'reason','')))<3 then raise exception 'REASON_REQUIRED';end if;
   if o.status not in ('queued','preparing','ready','pending_authorization') or p.status in ('captured','capture_pending','unknown','refunded') or (c.id is not null and not exists(select 1 from private.payment_operations where payment_id=p.id and type='capture' and provider_state='declined')) then raise exception 'PAYMENT_UNCONFIRMED';end if;
   if not private.is_staff(o.venue_id) and o.status<>'queued' then raise exception 'INVALID_TRANSITION';end if;
   next_state:='canceled';
   update private.payments set status='voided' where id=p.id;
   insert into private.payment_operations(payment_id,type,idempotency_key,status,provider_state,amount_minor) values(p.id,'void','void:'||o.id,'voided','voided',o.total_minor) on conflict do nothing;
  end if;
  update public.orders set status=next_state,version=version+1,preparing_at=case when next_state='preparing' then now() else preparing_at end,ready_at=case when next_state='ready' then now() else ready_at end,deadline=case when next_state='ready' then now()+interval '20 minutes' when next_state='preparing' then now()+interval '2 hours' else deadline end where id=o.id returning * into o;
  event_id:=private.event(o,action,case action when 'accept' then 'queued' when 'ready' then 'preparing' else null end,jsonb_build_object('reason',input->>'reason'));
  if action='ready' then insert into private.notifications(order_id,event_id) values(o.id,event_id);end if;
  insert into private.commands values(uid,key,payload,o.id);
  return private.order_view(o.id);
 end if;
 if action in ('resolve','capture','complete','reconcile','transfer','refund') then
  if not private.is_staff(o.venue_id) or coalesce(sid,'')='' then raise exception 'NOT_AUTHORIZED';end if;
  if action='resolve' then
   if o.status='delivered' then return private.order_view(o.id);end if;
   select * into token from private.pickup_tokens where private.pickup_tokens.order_id=o.id;
   if token.consumed_at is not null or token.expires_at<=now() or o.status<>'ready' or p.expires_at<=now() then raise exception 'EXPIRED';end if;
   if c.id is not null and c.claimed_at<now()-interval '2 minutes' and not exists(select 1 from private.payment_operations where payment_id=p.id and type='capture') then update private.pickup_claims set owner_user_id=uid,owner_staff_session_id=sid,claimed_at=now() where id=c.id;end if;
   if c.id is null then insert into private.pickup_claims(order_id,owner_user_id,owner_staff_session_id) values(o.id,uid,sid) returning * into c;end if;
   return private.order_view(o.id);
  end if;
  if action='transfer' then
   if not private.is_staff(o.venue_id,true) or input->>'physicalCheck'<>'not_delivered' or length(coalesce(input->>'reason',''))<5 or c.id is null or o.status<>'ready' then raise exception 'SUPERVISOR_REVIEW_REQUIRED';end if;
   update private.pickup_claims set owner_user_id=uid,owner_staff_session_id=sid where id=c.id;
   perform private.event(o,'claim_transferred',null,jsonb_build_object('previous_owner',c.owner_user_id,'reason',input->>'reason','physical_check','not_delivered'));
   return private.order_view(o.id);
  end if;
  if action='refund' then
   if not private.is_staff(o.venue_id,true) then raise exception 'NOT_AUTHORIZED';end if;
   if p.status='refunded' then return private.order_view(o.id);end if;
   if not private.is_staff(o.venue_id,true) or p.status<>'captured' or length(coalesce(input->>'reason',''))<5 then raise exception 'INVALID_TRANSITION';end if;
   update private.payments set status='refunded',refunded_minor=captured_minor where id=p.id;
   insert into private.payment_operations(payment_id,type,idempotency_key,status,provider_state,amount_minor) values(p.id,'refund','refund:'||o.id,'refunded','refunded',p.captured_minor) on conflict do nothing;
   if o.status<>'delivered' then update public.orders set status='canceled',version=version+1 where id=o.id returning * into o;end if;
   perform private.event(o,'refunded',null,jsonb_build_object('reason',input->>'reason'));return private.order_view(o.id);
  end if;
  if input->>'claimId' is null or c.id is null or c.owner_user_id<>uid or c.owner_staff_session_id<>sid or c.id<>(input->>'claimId')::uuid then raise exception 'CLAIM_OWNED_ELSEWHERE';end if;
  if action in ('complete','capture','reconcile') and o.status='delivered' then return private.order_view(o.id);end if;
  if o.status<>'ready' then raise exception 'INVALID_TRANSITION';end if;
  if action='capture' then
   if p.status='captured' then return private.order_view(o.id);end if;
   if p.status<>'authorized' then raise exception 'PAYMENT_UNCONFIRMED';end if;
   if p.expires_at<=now() then raise exception 'EXPIRED';end if;
   scenario:=coalesce(input->>'scenario','approved');if scenario not in ('approved','declined','timeout_after_success','unknown') then raise exception 'INVALID_INPUT';end if;
   insert into private.payment_operations(payment_id,type,idempotency_key,status,provider_state,amount_minor) values(p.id,'capture','capture:'||o.id,case when scenario='approved' then 'captured' when scenario='declined' then 'failed' else 'unknown' end,case when scenario in ('approved','timeout_after_success') then 'captured' when scenario='declined' then 'declined' else 'unknown' end,o.total_minor) on conflict(payment_id,type) do nothing returning * into op;
   if not found then raise exception 'PAYMENT_UNCONFIRMED';end if;
   update private.payments set status=case when scenario='approved' then 'captured' when scenario='declined' then 'authorized' else 'unknown' end,captured_minor=case when scenario='approved' then o.total_minor else 0 end where id=p.id;
   perform private.event(o,'capture_attempt');return private.order_view(o.id);
  elsif action='reconcile' then
   select * into op from private.payment_operations where payment_id=p.id and type='capture';
   if op.provider_state='captured' then update private.payments set status='captured',captured_minor=op.amount_minor where id=p.id;update private.payment_operations set status='captured' where id=op.id;perform private.event(o,'capture_reconciled');end if;
   return private.order_view(o.id);
  elsif action='complete' then
   if p.status<>'captured' then raise exception 'PAYMENT_UNCONFIRMED';end if;
   if coalesce((input->>'physicalHandoff')::boolean,false)=false then raise exception 'PHYSICAL_HANDOFF_REQUIRED';end if;
   update public.orders set status='delivered',delivered_at=now(),version=version+1 where id=o.id returning * into o;
   update private.pickup_tokens set consumed_at=now() where private.pickup_tokens.order_id=o.id;
   update private.pickup_claims set status='completed' where id=c.id;
   perform private.event(o,'delivered','ready');return private.order_view(o.id);
  end if;
 end if;
 raise exception 'INVALID_INPUT';
end $$;

create function public.sweep_orders() returns integer language plpgsql security definer set search_path='' as $$
declare o public.orders;p private.payments;n integer:=0;begin
 if auth.uid() is null then raise exception 'NOT_AUTHORIZED';end if;
 for o in select * from public.orders where deadline<now() and status in ('queued','ready','pending_authorization') order by created_at limit 100 for update skip locked loop
  select * into p from private.payments where order_id=o.id for update;
  if p.status not in ('authorized','authorizing') or exists(select 1 from private.pickup_claims where order_id=o.id) then continue;end if;
  update public.orders set status=case when status='ready' then 'uncollected' else 'expired' end,version=version+1 where id=o.id returning * into o;
  update private.payments set status='voided' where id=p.id;
  insert into private.payment_operations(payment_id,type,idempotency_key,status,provider_state,amount_minor) values(p.id,'void','void:'||o.id,'voided','voided',o.total_minor) on conflict do nothing;
  perform private.event(o,'expired');n:=n+1;
 end loop;return n;end$$;

create function public.venue_summary(venue uuid,day date) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if not private.is_staff(venue,true) then raise exception 'NOT_AUTHORIZED';end if;
 select jsonb_build_object('business_date',day,'timezone','America/Costa_Rica','cutoff','06:00','captured_minor',coalesce(sum(p.captured_minor),0),'refunded_minor',coalesce(sum(p.refunded_minor),0),'reserved_minor',coalesce(sum(case when p.status='authorized' then p.authorized_minor else 0 end),0),'delivered_orders',count(*) filter(where o.status='delivered'),'preparation_n',count(*) filter(where o.ready_at is not null and o.preparing_at is not null),'median_preparation_seconds',percentile_cont(.5) within group(order by extract(epoch from o.ready_at-o.preparing_at)) filter(where o.ready_at is not null and o.preparing_at is not null),'products',coalesce((select jsonb_agg(x) from (select i.product_id,i.name_snapshot,sum(i.quantity) as units,sum(i.line_total_minor) as total_minor from public.order_items i join public.orders oo on oo.id=i.order_id where oo.venue_id=venue and oo.business_date=day and oo.status='delivered' group by i.product_id,i.name_snapshot) x),'[]'::jsonb)) into result from public.orders o join private.payments p on p.order_id=o.id where o.venue_id=venue and o.business_date=day;
 return result;end $$;
revoke execute on all functions in schema private from public;
revoke execute on function public.onza_command(jsonb),public.sweep_orders(),public.venue_summary(uuid,date),public.has_venue_access(uuid,boolean) from public,anon;
grant execute on function public.onza_command(jsonb),public.sweep_orders(),public.venue_summary(uuid,date),public.has_venue_access(uuid,boolean) to authenticated;

create function private.signal_payment_change() returns trigger language plpgsql security definer set search_path='' as $$begin update public.orders set version=version+1 where id=new.order_id;return new;end$$;
create trigger payment_changed after update on private.payments for each row execute function private.signal_payment_change();
revoke execute on function private.signal_payment_change() from public,anon,authenticated;

create function public.order_list(venue_filter uuid default null,order_filter uuid default null,before_time timestamptz default null) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if auth.uid() is null then raise exception 'NOT_AUTHORIZED';end if;
 if venue_filter is not null and not private.is_staff(venue_filter) then raise exception 'NOT_AUTHORIZED';end if;
 select coalesce(jsonb_agg(private.order_view(x.id) order by x.active desc,x.created_at desc),'[]'::jsonb) into result from (
  select id,created_at,status in ('pending_authorization','queued','preparing','ready') as active from public.orders
  where (venue_filter is null or venue_id=venue_filter) and (order_filter is null or id=order_filter)
  and (customer_id=auth.uid() or (venue_filter is not null and private.is_staff(venue_id)) or (order_filter is not null and private.is_staff(venue_id)))
  and (before_time is null or created_at<before_time) order by (status in ('pending_authorization','queued','preparing','ready')) desc,created_at desc limit 100
 ) x;return result;end$$;
revoke execute on function public.order_list(uuid,uuid,timestamptz) from public,anon;
grant execute on function public.order_list(uuid,uuid,timestamptz) to authenticated;
