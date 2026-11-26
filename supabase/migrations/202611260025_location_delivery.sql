-- Entrega en el lugar (mesa, zona o puesto) configurable por local o evento. ADITIVA (R4): columnas con valor por defecto
-- que dejan todo como estaba (retiro en barra), una tabla nueva, funciones nuevas y un envoltorio de private.create_order.
--
-- Decisiones (detalle y alternativas en docs/Onza-Entrega-en-el-lugar.md):
-- * Un local (o un evento, que en Onza es un local con su propio enlace) elige cómo entrega: delivery_mode 'bar' (solo
--   barra: el comportamiento de siempre), 'both' (el cliente elige) o 'location' (solo en su lugar). spot_noun es la palabra
--   que ve el cliente: Mesa, Zona, Puesto, Gradas...
-- * Los lugares son filas validadas (delivery_spots), no texto libre: el servidor comprueba que el lugar sea del local y esté
--   habilitado al crear el pedido y al cambiarlo. El pedido guarda además una copia del nombre (spot_label/spot_area), así que
--   renombrar o deshabilitar un lugar no altera el historial.
-- * El retiro en barra, el QR y el código privado no cambian. En un pedido entregado en el lugar, el equipo valida el mismo QR o
--   código privado cuando llega al cliente: la misma cadena resolver → cobro simulado → entrega física. No se agrega otro
--   secreto. onza_command no se reemplaza (igual que en 021): la validación vive en un envoltorio de create_order.
-- * No se toca private.accept_order, expire_order ni los permisos de pago: stock, cancelación y reserva siguen siendo los de 013.

-- 1) Configuración del local.
alter table public.venues
  add column if not exists delivery_mode text not null default 'bar' check (delivery_mode in ('bar','both','location')),
  add column if not exists spot_noun text not null default 'Mesa' check (char_length(btrim(spot_noun)) between 1 and 20);
comment on column public.venues.delivery_mode is 'bar: solo retiro en barra. both: el cliente elige. location: solo entrega en su lugar (mesa, zona o puesto).';
comment on column public.venues.spot_noun is 'Palabra que ve el cliente para el lugar de entrega (Mesa, Zona, Puesto...).';

-- 2) Lugares de entrega del local. Lectura pública solo de los habilitados; escritura solo por las funciones de abajo.
create table public.delivery_spots(
 id uuid primary key default gen_random_uuid(),
 venue_id uuid not null references public.venues(id),
 label text not null check (char_length(btrim(label)) between 1 and 40),
 area text not null default '' check (char_length(area) <= 40),
 position integer not null default 0 check (position between 0 and 100000),
 enabled boolean not null default true,
 created_at timestamptz not null default now(),
 unique(id,venue_id)
);
create unique index delivery_spots_label on public.delivery_spots(venue_id, lower(label));
create index delivery_spots_venue on public.delivery_spots(venue_id, position);
alter table public.delivery_spots enable row level security;
create policy delivery_spots_read on public.delivery_spots for select to anon, authenticated
  using (enabled or private.is_staff(venue_id,true));
revoke all on public.delivery_spots from anon, authenticated;
grant select on public.delivery_spots to anon, authenticated;

-- 3) Dónde se entrega cada pedido. Con fulfillment='bar' no hay lugar; con 'location' el lugar es obligatorio y del mismo local.
alter table public.orders
  add column if not exists fulfillment text not null default 'bar' check (fulfillment in ('bar','location')),
  add column if not exists spot_id uuid,
  add column if not exists spot_label text,
  add column if not exists spot_area text,
  add column if not exists spot_changed_at timestamptz;
alter table public.orders
  add constraint orders_spot_same_venue foreign key (spot_id, venue_id) references public.delivery_spots(id, venue_id),
  add constraint orders_fulfillment_spot check (
    (fulfillment='bar' and spot_id is null and spot_label is null and spot_area is null)
    or (fulfillment='location' and spot_id is not null and spot_label is not null));

-- 4) Crear el pedido. La función de 019 pasa a llamarse create_order_base y queda intacta; esta valida la entrega ANTES de
--    crear nada y la registra en la misma transacción. Un reintento con la misma clave (o un conflicto de idempotencia) lo
--    resuelve la base, sin revalidar ni tocar el pedido original.
alter function private.create_order(jsonb) rename to create_order_base;
create function private.create_order(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); key text:=input->>'idempotencyKey'; vid uuid; sid uuid; mode text:='bar';
 v public.venues; spot public.delivery_spots; result jsonb; oid uuid;
begin
 if input ? 'delivery' then
  if jsonb_typeof(input->'delivery')<>'object' then raise exception 'INVALID_INPUT'; end if;
  mode:=coalesce(input->'delivery'->>'mode','bar');
  if mode not in ('bar','location') then raise exception 'INVALID_INPUT'; end if;
  if mode='bar' and input->'delivery' ? 'spotId' then raise exception 'INVALID_INPUT'; end if;
 end if;
 if key is not null and exists(select 1 from private.commands where actor_id=uid and command_key=key) then
  return private.create_order_base(input);
 end if;
 begin vid:=(input->>'venueId')::uuid; exception when others then vid:=null; end;
 -- Mismo orden de bloqueo que administración (local y después lugar): sin interbloqueos con quien edite los lugares.
 select * into v from public.venues where id=vid for update;
 if not found then return private.create_order_base(input); end if;
 if mode='bar' then
  if v.delivery_mode='location' then raise exception 'SPOT_REQUIRED'; end if;
 else
  if v.delivery_mode='bar' then raise exception 'DELIVERY_UNAVAILABLE'; end if;
  begin sid:=(input->'delivery'->>'spotId')::uuid; exception when others then sid:=null; end;
  select * into spot from public.delivery_spots where id=sid and venue_id=v.id for share;
  if not found or not spot.enabled then raise exception 'SPOT_INVALID'; end if;
 end if;
 result:=private.create_order_base(input);
 if result ? 'error' or mode='bar' then return result; end if;
 oid:=(result->>'id')::uuid;
 update public.orders set fulfillment='location',spot_id=spot.id,spot_label=spot.label,spot_area=nullif(spot.area,'')
  where id=oid and customer_id=uid and spot_id is null;
 return private.order_view(oid);
end $$;

-- 5) El cliente corrige su lugar mientras el pedido no se haya entregado. No cambia la versión del pedido (el equipo no ve
--    un conflicto al aceptar); Realtime avisa por el cambio de fila y el equipo ve «lugar actualizado».
create or replace function public.order_change_spot(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); oid uuid; sid uuid; o public.orders; v public.venues; spot public.delivery_spots; previous text;
begin
 if uid is null then raise exception 'NOT_AUTHORIZED'; end if;
 begin oid:=(input->>'orderId')::uuid; sid:=(input->>'spotId')::uuid; exception when others then raise exception 'INVALID_INPUT'; end;
 if not private.limit_action('spot',20) then return jsonb_build_object('error','RATE_LIMITED'); end if;
 select * into o from public.orders where id=oid for update;
 if not found or o.customer_id<>uid then raise exception 'NOT_AUTHORIZED'; end if;
 if o.fulfillment<>'location' or o.status not in ('pending_authorization','queued','preparing','ready') then raise exception 'INVALID_TRANSITION'; end if;
 select * into v from public.venues where id=o.venue_id;
 select * into spot from public.delivery_spots where id=sid and venue_id=o.venue_id for share;
 if not found or not spot.enabled or v.delivery_mode='bar' then raise exception 'SPOT_INVALID'; end if;
 if o.spot_id=spot.id then return private.order_view(o.id); end if;
 previous:=o.spot_label;
 update public.orders set spot_id=spot.id,spot_label=spot.label,spot_area=nullif(spot.area,''),spot_changed_at=now() where id=o.id returning * into o;
 perform private.event(o,'spot_changed',null,jsonb_build_object('from',previous,'to',spot.label));
 return private.order_view(o.id);
end $$;

-- 6) Administración del local. Todas exigen administración del local y dejan registro en platform_events.
create or replace function public.venue_delivery_config(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare vid uuid; mode text; noun text; v public.venues;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHORIZED'; end if;
 begin vid:=(input->>'venueId')::uuid; exception when others then raise exception 'INVALID_INPUT'; end;
 mode:=input->>'mode';
 noun:=nullif(btrim(coalesce(input->>'noun','')),'');
 if mode not in ('bar','both','location') or (noun is not null and char_length(noun)>20) then raise exception 'INVALID_INPUT'; end if;
 if not private.is_staff(vid,true) then raise exception 'NOT_AUTHORIZED'; end if;
 select * into v from public.venues where id=vid for update;
 if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
 if mode<>'bar' and not exists(select 1 from public.delivery_spots where venue_id=vid and enabled) then raise exception 'NO_SPOTS'; end if;
 update public.venues set delivery_mode=mode,spot_noun=coalesce(noun,spot_noun) where id=vid returning * into v;
 insert into private.platform_events(actor_id,action,venue_id,metadata) values(auth.uid(),'delivery_config',vid,jsonb_build_object('mode',v.delivery_mode,'noun',v.spot_noun));
 return jsonb_build_object('mode',v.delivery_mode,'noun',v.spot_noun);
end $$;

create or replace function public.venue_spot_save(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare vid uuid; sid uuid; lbl text; ar text; en boolean; v public.venues; s public.delivery_spots; n integer;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHORIZED'; end if;
 begin vid:=(input->>'venueId')::uuid; sid:=(input->>'spotId')::uuid; exception when others then raise exception 'INVALID_INPUT'; end;
 lbl:=btrim(coalesce(input->>'label',''));
 ar:=btrim(coalesce(input->>'area',''));
 if char_length(lbl) not between 1 and 40 or char_length(ar)>40 then raise exception 'INVALID_INPUT'; end if;
 if input ? 'enabled' then
  if jsonb_typeof(input->'enabled')<>'boolean' then raise exception 'INVALID_INPUT'; end if;
  en:=(input->>'enabled')::boolean;
 end if;
 if not private.is_staff(vid,true) then raise exception 'NOT_AUTHORIZED'; end if;
 select * into v from public.venues where id=vid for update;
 if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
 begin
  if sid is null then
   select count(*) into n from public.delivery_spots where venue_id=vid;
   if n>=300 then raise exception 'TOO_MANY_SPOTS'; end if;
   insert into public.delivery_spots(venue_id,label,area,position,enabled)
    values(vid,lbl,ar,coalesce((select max(position) from public.delivery_spots where venue_id=vid),0)+1,coalesce(en,true)) returning * into s;
  else
   select * into s from public.delivery_spots where id=sid and venue_id=vid for update;
   if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
   if en is false and s.enabled and v.delivery_mode<>'bar'
      and not exists(select 1 from public.delivery_spots where venue_id=vid and enabled and id<>s.id) then raise exception 'LAST_SPOT'; end if;
   update public.delivery_spots set label=lbl,area=ar,enabled=coalesce(en,enabled) where id=s.id returning * into s;
  end if;
 exception when unique_violation then raise exception 'SPOT_DUPLICATE';
 end;
 insert into private.platform_events(actor_id,action,venue_id,metadata) values(auth.uid(),'spot_save',vid,jsonb_build_object('spot',s.id,'label',s.label,'enabled',s.enabled));
 return to_jsonb(s);
end $$;

-- Altas por rango («Mesa 1» a «Mesa 20»): ahorra veinte formularios. Lo que ya existe se omite y se informa.
create or replace function public.venue_spot_bulk(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare vid uuid; prefix text; ar text; first_n integer; last_n integer; total integer; created integer; start_pos integer;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHORIZED'; end if;
 begin vid:=(input->>'venueId')::uuid; first_n:=(input->>'from')::integer; last_n:=(input->>'to')::integer; exception when others then raise exception 'INVALID_INPUT'; end;
 prefix:=btrim(coalesce(input->>'prefix',''));
 ar:=btrim(coalesce(input->>'area',''));
 if first_n is null or last_n is null or first_n<1 or last_n>9999 or last_n<first_n or last_n-first_n>99
    or char_length(prefix)>30 or char_length(ar)>40 or char_length(btrim(prefix||' '||last_n::text))>40 then raise exception 'INVALID_INPUT'; end if;
 if not private.is_staff(vid,true) then raise exception 'NOT_AUTHORIZED'; end if;
 perform 1 from public.venues where id=vid for update;
 if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
 select count(*) into total from public.delivery_spots where venue_id=vid;
 if total+(last_n-first_n+1)>300 then raise exception 'TOO_MANY_SPOTS'; end if;
 select coalesce(max(position),0) into start_pos from public.delivery_spots where venue_id=vid;
 with ins as (
  insert into public.delivery_spots(venue_id,label,area,position)
  select vid,btrim(prefix||' '||g::text),ar,start_pos+(g-first_n)+1 from generate_series(first_n,last_n) g
  on conflict do nothing returning 1
 ) select count(*) into created from ins;
 insert into private.platform_events(actor_id,action,venue_id,metadata) values(auth.uid(),'spot_bulk',vid,jsonb_build_object('prefix',prefix,'from',first_n,'to',last_n,'created',created));
 return jsonb_build_object('created',created,'skipped',(last_n-first_n+1)-created);
end $$;

-- Borra solo un lugar que nunca recibió pedidos; si ya se usó, se deshabilita (el historial conserva su nombre).
create or replace function public.venue_spot_delete(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare vid uuid; sid uuid; v public.venues; s public.delivery_spots;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHORIZED'; end if;
 begin vid:=(input->>'venueId')::uuid; sid:=(input->>'spotId')::uuid; exception when others then raise exception 'INVALID_INPUT'; end;
 if vid is null or sid is null then raise exception 'INVALID_INPUT'; end if;
 if not private.is_staff(vid,true) then raise exception 'NOT_AUTHORIZED'; end if;
 select * into v from public.venues where id=vid for update;
 if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
 select * into s from public.delivery_spots where id=sid and venue_id=vid for update;
 if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
 if exists(select 1 from public.orders where spot_id=s.id) then raise exception 'SPOT_IN_USE'; end if;
 if s.enabled and v.delivery_mode<>'bar' and not exists(select 1 from public.delivery_spots where venue_id=vid and enabled and id<>s.id) then raise exception 'LAST_SPOT'; end if;
 delete from public.delivery_spots where id=s.id;
 insert into private.platform_events(actor_id,action,venue_id,metadata) values(auth.uid(),'spot_delete',vid,jsonb_build_object('label',s.label));
 return jsonb_build_object('deleted',true);
end $$;

-- 7) Vista del pedido: igual a la de 021 y, solo para el equipo del local, quién registró la entrega. El cliente nunca ve
--    identificadores ni nombres del equipo.
create or replace function private.order_view(target_order_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(o)||jsonb_build_object('server_now',now(),'payment_state',p.status,'capture_state',(select provider_state from private.payment_operations where payment_id=p.id and type='capture'),'authorized_minor',p.authorized_minor,'captured_minor',p.captured_minor,'refunded_minor',p.refunded_minor,'venue',to_jsonb(v),'items',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('image_url',pr.image_url,'photo_path',pr.photo_path) order by i.id) from public.order_items i left join public.products pr on pr.id=i.product_id where i.order_id=o.id),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'order_id',e.order_id,'venue_id',e.venue_id,
     'actor_id',case when private.is_staff(o.venue_id) then e.actor_id end,'type',e.type,'from_status',e.from_status,'to_status',e.to_status,'created_at',e.created_at,
     'metadata',case when private.is_staff(o.venue_id) then e.metadata else '{}'::jsonb end) order by e.created_at) from public.order_events e where e.order_id=o.id),'[]'::jsonb),
  'delivered_by_name',case when private.is_staff(o.venue_id) then (select s.display_name from public.order_events e join public.staff_accounts s on s.user_id=e.actor_id where e.order_id=o.id and e.type='delivered' order by e.created_at desc limit 1) end,
  'claim_id',case when c.owner_user_id=auth.uid() and c.owner_staff_session_id=auth.jwt()->>'session_id' then c.id else null end,
  'claimed_elsewhere',c.id is not null and not(c.owner_user_id=auth.uid() and c.owner_staff_session_id=auth.jwt()->>'session_id'),
  'encrypted_token',case when o.customer_id=auth.uid() and o.status='ready' and p.status in ('authorized','unknown','captured') and t.consumed_at is null and t.expires_at>now() then t.encrypted_token else null end)
 from public.orders o join public.venues v on v.id=o.venue_id join private.payments p on p.order_id=o.id left join private.pickup_claims c on c.order_id=o.id left join private.pickup_tokens t on t.order_id=o.id where o.id=target_order_id
$$;

-- 8) Exportación del período para cierre de caja. Solo administración; sin datos de la persona que pidió. Tope de 93 días y
--    5 000 filas (la app avisa si se recorta).
create or replace function public.venue_orders_export(venue uuid, from_day date, to_day date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not private.is_staff(venue,true) then raise exception 'NOT_AUTHORIZED'; end if;
 if from_day is null or to_day is null or to_day<from_day or to_day-from_day>93 then raise exception 'INVALID_INPUT'; end if;
 select coalesce(jsonb_agg(x order by x.created_at),'[]'::jsonb) into result from (
  select o.business_date,o.public_code,o.status,o.created_at,o.queued_at,o.preparing_at,o.ready_at,o.delivered_at,o.fulfillment,o.spot_label,o.spot_area,
   o.total_minor,p.captured_minor,p.refunded_minor,
   (select string_agg(i.quantity||'× '||i.name_snapshot,'; ' order by i.name_snapshot) from public.order_items i where i.order_id=o.id) as items,
   (select s.display_name from public.order_events e join public.staff_accounts s on s.user_id=e.actor_id where e.order_id=o.id and e.type='delivered' order by e.created_at desc limit 1) as delivered_by
  from public.orders o join private.payments p on p.order_id=o.id
  where o.venue_id=venue and o.business_date between from_day and to_day order by o.created_at limit 5001
 ) x;
 return result;
end $$;

-- Mismos permisos que 004/022: nada de private es ejecutable desde fuera salvo los predicados de RLS; las funciones públicas
-- nuevas solo para sesiones autenticadas.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_staff(uuid,boolean), private.can_read_order(uuid) to anon, authenticated;
revoke execute on function public.order_change_spot(jsonb), public.venue_delivery_config(jsonb), public.venue_spot_save(jsonb),
 public.venue_spot_bulk(jsonb), public.venue_spot_delete(jsonb), public.venue_orders_export(uuid,date,date) from public, anon;
grant execute on function public.order_change_spot(jsonb), public.venue_delivery_config(jsonb), public.venue_spot_save(jsonb),
 public.venue_spot_bulk(jsonb), public.venue_spot_delete(jsonb), public.venue_orders_export(uuid,date,date) to authenticated;
