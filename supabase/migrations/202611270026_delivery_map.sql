-- Mapa del local para la entrega en el lugar (plano o foto con un toque = un pin). ADITIVA (R4): una tabla nueva, columnas
-- nulas y funciones nuevas o reemplazadas sobre 025; nada de lo anterior se edita. Sin mapa, todo sigue como en 025.
--
-- Decisiones (detalle en docs/Onza-Entrega-en-el-lugar.md):
-- * Cada local tiene su propio mapa: una imagen (Storage venue-images, o la de ejemplo del repo en el seed) con sus
--   dimensiones. Cambiar la imagen crea una versión nueva y retira la anterior; un pedido guarda la versión en que se hizo, así
--   que un plano nuevo nunca mueve el pin de un pedido viejo.
-- * El pin se guarda RELATIVO a la imagen (0 a 1 en cada eje, 6 decimales): se ve en el mismo lugar en cualquier pantalla.
-- * Áreas marcadas sobre la imagen, reutilizando los lugares de 025: cada lugar puede tener una forma (círculo = mesa,
--   polígono = zona). El «área de servicio» (polígonos donde sí se entrega) vive en el mapa; sin área, vale toda la imagen.
-- * El servidor valida mapa, punto y lugar: el mapa debe ser el vigente del local, el punto debe estar dentro del área de
--   servicio, y el nombre (mesa o zona) lo decide la base según las formas; el navegador nunca lo dicta. Si el punto cae
--   en una sola mesa, esa mesa; si cae entre mesas o en dos mesas que se superponen, no se adivina ninguna: solo el punto
--   (y la zona, si está dentro de una).
-- * La entrega sigue confirmándose con el mismo QR o código privado. Pagos mock, stock y cancelación no se tocan.

-- 1) Mapas por local.
create table public.venue_maps(
 id uuid primary key default gen_random_uuid(),
 venue_id uuid not null references public.venues(id),
 version integer not null check (version >= 1),
 image_url text not null check (char_length(image_url) <= 2048),
 width integer not null check (width between 1 and 20000),
 height integer not null check (height between 1 and 20000),
 service_area jsonb not null default '[]'::jsonb check (jsonb_typeof(service_area)='array' and pg_column_size(service_area) < 65536),
 status text not null default 'published' check (status in ('published','retired')),
 created_at timestamptz not null default now(),
 unique(id,venue_id),
 unique(venue_id,version)
);
create unique index venue_maps_one_published on public.venue_maps(venue_id) where status='published';
alter table public.venue_maps enable row level security;
create policy venue_maps_read on public.venue_maps for select to anon, authenticated
  using (status='published' or private.is_staff(venue_id,true));
revoke all on public.venue_maps from anon, authenticated;
grant select on public.venue_maps to anon, authenticated;

-- 2) Forma de cada lugar sobre la imagen: {"kind":"circle","x":,"y":,"r":} (r = fracción del ANCHO de la imagen) o
--    {"kind":"polygon","points":[[x,y],...]}. Nula = el lugar solo existe en la lista.
alter table public.delivery_spots add column if not exists shape jsonb check (shape is null or (jsonb_typeof(shape)='object' and pg_column_size(shape) < 4096));

-- 3) Dónde cayó el pin de cada pedido.
alter table public.orders
  add column if not exists map_id uuid,
  add column if not exists map_x numeric(7,6),
  add column if not exists map_y numeric(7,6);
alter table public.orders add constraint orders_map_same_venue foreign key (map_id, venue_id) references public.venue_maps(id, venue_id);
alter table public.orders drop constraint orders_fulfillment_spot;
alter table public.orders add constraint orders_fulfillment_spot check (
    (fulfillment='bar' and spot_id is null and spot_label is null and spot_area is null and map_id is null and map_x is null and map_y is null)
    or (fulfillment='location' and spot_label is not null and (spot_id is not null or map_id is not null)
        and ((map_id is null and map_x is null and map_y is null)
          or (map_id is not null and map_x between 0 and 1 and map_y between 0 and 1))));

-- 4) Geometría. La misma regla que la pantalla (src/features/delivery/geometry.ts): una prueba compara ambas.
create function private.valid_points(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare e jsonb;
begin
 if p is null or jsonb_typeof(p)<>'array' or jsonb_array_length(p) not between 3 and 60 then return false; end if;
 for e in select value from jsonb_array_elements(p) loop
  if jsonb_typeof(e)<>'array' or jsonb_array_length(e)<>2 then return false; end if;
  if jsonb_typeof(e->0)<>'number' or jsonb_typeof(e->1)<>'number' then return false; end if;
  if (e->>0)::numeric not between 0 and 1 or (e->>1)::numeric not between 0 and 1 then return false; end if;
 end loop;
 return true;
end $$;

-- Las comprobaciones van en pasos separados (no en un solo "and"): un valor que no es número nunca llega al cast.
create function private.valid_shape(s jsonb) returns boolean language plpgsql immutable set search_path='' as $$
begin
 if s is null or jsonb_typeof(s)<>'object' then return false; end if;
 if s->>'kind'='polygon' then return private.valid_points(s->'points'); end if;
 if s->>'kind'<>'circle' then return false; end if;
 if jsonb_typeof(s->'x') is distinct from 'number' or jsonb_typeof(s->'y') is distinct from 'number' or jsonb_typeof(s->'r') is distinct from 'number' then return false; end if;
 return (s->>'x')::numeric between 0 and 1 and (s->>'y')::numeric between 0 and 1 and (s->>'r')::numeric between 0.005 and 0.2;
end $$;

create function private.valid_area(a jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare e jsonb;
begin
 if a is null or jsonb_typeof(a)<>'array' or jsonb_array_length(a)>10 then return false; end if;
 for e in select value from jsonb_array_elements(a) loop
  if jsonb_typeof(e)<>'object' then return false; end if;
  if not private.valid_points(e->'points') then return false; end if;
 end loop;
 return true;
end $$;

create function private.point_in_points(p jsonb, px numeric, py numeric) returns boolean language plpgsql immutable set search_path='' as $$
declare n integer:=jsonb_array_length(p); i integer; j integer; inside boolean:=false; xi numeric; yi numeric; xj numeric; yj numeric;
begin
 j:=n-1;
 for i in 0..n-1 loop
  xi:=(p->i->>0)::numeric; yi:=(p->i->>1)::numeric; xj:=(p->j->>0)::numeric; yj:=(p->j->>1)::numeric;
  if ((yi>py)<>(yj>py)) and px < (xj-xi)*(py-yi)/(yj-yi)+xi then inside:=not inside; end if;
  j:=i;
 end loop;
 return inside;
end $$;

create function private.polygon_size(p jsonb) returns numeric language plpgsql immutable set search_path='' as $$
declare n integer:=jsonb_array_length(p); i integer; j integer; total numeric:=0;
begin
 j:=n-1;
 for i in 0..n-1 loop
  total:=total+((p->j->>0)::numeric+(p->i->>0)::numeric)*((p->j->>1)::numeric-(p->i->>1)::numeric);
  j:=i;
 end loop;
 return abs(total)/2;
end $$;

-- Sin área de servicio vale toda la imagen.
create function private.in_service_area(a jsonb, px numeric, py numeric) returns boolean language plpgsql immutable set search_path='' as $$
declare e jsonb;
begin
 if a is null or jsonb_array_length(a)=0 then return true; end if;
 for e in select value from jsonb_array_elements(a) loop
  if private.point_in_points(e->'points',px,py) then return true; end if;
 end loop;
 return false;
end $$;

-- El círculo es redondo en la imagen, no en el cuadrado 0..1: el eje vertical se corrige por la proporción de la imagen.
create function private.shape_contains(s jsonb, w integer, h integer, px numeric, py numeric) returns boolean language sql immutable set search_path='' as $$
 select case s->>'kind'
  when 'circle' then power(px-(s->>'x')::numeric,2)+power((py-(s->>'y')::numeric)*h/w,2) <= power((s->>'r')::numeric,2)
  when 'polygon' then private.point_in_points(s->'points',px,py)
  else false end
$$;

-- Qué lugar nombra un punto. hint = el lugar que el cliente dice ocupar (QR de una mesa): debe ser de este local, estar
-- habilitado y contener el punto. Sin hint: la única mesa que contiene el punto, o, si no hay, la zona más chica.
-- Devuelve {spot_id,label,area}; sin lugar, label y spot_id nulos.
create function private.resolve_place(m public.venue_maps, px numeric, py numeric, hint uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.delivery_spots; t public.delivery_spots; z public.delivery_spots; tables integer;
begin
 if hint is not null then
  select * into s from public.delivery_spots where id=hint and venue_id=m.venue_id and enabled and shape is not null;
  if not found or not private.shape_contains(s.shape,m.width,m.height,px,py) then raise exception 'SPOT_INVALID'; end if;
  return jsonb_build_object('spot_id',s.id,'label',s.label,'area',s.area);
 end if;
 select count(*) into tables from public.delivery_spots d
  where d.venue_id=m.venue_id and d.enabled and d.shape->>'kind'='circle' and private.shape_contains(d.shape,m.width,m.height,px,py);
 if tables=1 then
  select * into t from public.delivery_spots d
   where d.venue_id=m.venue_id and d.enabled and d.shape->>'kind'='circle' and private.shape_contains(d.shape,m.width,m.height,px,py);
 end if;
 select * into z from public.delivery_spots d
  where d.venue_id=m.venue_id and d.enabled and d.shape->>'kind'='polygon' and private.shape_contains(d.shape,m.width,m.height,px,py)
  order by private.polygon_size(d.shape->'points'), d.position, d.id limit 1;
 if t.id is not null then
  return jsonb_build_object('spot_id',t.id,'label',t.label,'area',coalesce(nullif(t.area,''),case when z.id is not null then z.label else '' end));
 elsif z.id is not null then
  return jsonb_build_object('spot_id',z.id,'label',z.label,'area',z.area);
 end if;
 return jsonb_build_object('spot_id',null,'label',null,'area','');
end $$;

-- Un local puede entregar en el lugar si tiene al menos un lugar habilitado (distinto de excl) o un mapa publicado.
create function private.can_deliver(vid uuid, excl uuid default null) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.delivery_spots where venue_id=vid and enabled and id is distinct from excl)
     or exists(select 1 from public.venue_maps where venue_id=vid and status='published')
$$;

-- Lee y valida el punto de una entrada {mapId,x,y}; null si no hay.
create function private.read_point(pt jsonb, out mid uuid, out px numeric, out py numeric) language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(pt) is distinct from 'object' then raise exception 'INVALID_INPUT'; end if;
 if jsonb_typeof(pt->'x') is distinct from 'number' or jsonb_typeof(pt->'y') is distinct from 'number' or jsonb_typeof(pt->'mapId') is distinct from 'string' then raise exception 'INVALID_INPUT'; end if;
 begin mid:=(pt->>'mapId')::uuid; px:=round((pt->>'x')::numeric,6); py:=round((pt->>'y')::numeric,6); exception when others then raise exception 'INVALID_INPUT'; end;
 if px not between 0 and 1 or py not between 0 and 1 then raise exception 'INVALID_INPUT'; end if;
end $$;

-- 5) Crear el pedido: igual que 025 y, con un punto, valida mapa vigente + área de servicio + lugar nombrado por la base.
create or replace function private.create_order(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); key text:=input->>'idempotencyKey'; vid uuid; sid uuid; mode text:='bar'; has_point boolean:=false;
 v public.venues; spot public.delivery_spots; m public.venue_maps; mid uuid; px numeric; py numeric; place jsonb; result jsonb; oid uuid;
begin
 if input ? 'delivery' then
  if jsonb_typeof(input->'delivery')<>'object' then raise exception 'INVALID_INPUT'; end if;
  mode:=coalesce(input->'delivery'->>'mode','bar');
  if mode not in ('bar','location') then raise exception 'INVALID_INPUT'; end if;
  if mode='bar' and (input->'delivery' ? 'spotId' or input->'delivery' ? 'point') then raise exception 'INVALID_INPUT'; end if;
  if input->'delivery' ? 'point' then
   has_point:=true;
   select r.mid,r.px,r.py into mid,px,py from private.read_point(input->'delivery'->'point') r;
  end if;
 end if;
 if key is not null and exists(select 1 from private.commands where actor_id=uid and command_key=key) then
  return private.create_order_base(input);
 end if;
 begin vid:=(input->>'venueId')::uuid; exception when others then vid:=null; end;
 -- Mismo orden de bloqueo que administración: primero el local, después lugares y mapa.
 select * into v from public.venues where id=vid for update;
 if not found then return private.create_order_base(input); end if;
 begin sid:=(input->'delivery'->>'spotId')::uuid; exception when others then sid:=null; end;
 if mode='bar' then
  if v.delivery_mode='location' then raise exception 'SPOT_REQUIRED'; end if;
 else
  if v.delivery_mode='bar' then raise exception 'DELIVERY_UNAVAILABLE'; end if;
  if has_point then
   select * into m from public.venue_maps where id=mid and venue_id=v.id and status='published' for share;
   if not found then raise exception 'MAP_OUTDATED'; end if;
   if not private.in_service_area(m.service_area,px,py) then raise exception 'OUTSIDE_AREA'; end if;
   place:=private.resolve_place(m,px,py,sid);
  else
   select * into spot from public.delivery_spots where id=sid and venue_id=v.id for share;
   if not found or not spot.enabled then raise exception 'SPOT_INVALID'; end if;
  end if;
 end if;
 result:=private.create_order_base(input);
 if result ? 'error' or mode='bar' then return result; end if;
 oid:=(result->>'id')::uuid;
 if has_point then
  update public.orders set fulfillment='location',spot_id=nullif(place->>'spot_id','')::uuid,spot_label=coalesce(place->>'label','Punto en el mapa'),
   spot_area=nullif(place->>'area',''),map_id=m.id,map_x=px,map_y=py
   where id=oid and customer_id=uid and fulfillment='bar';
 else
  update public.orders set fulfillment='location',spot_id=spot.id,spot_label=spot.label,spot_area=nullif(spot.area,'')
   where id=oid and customer_id=uid and fulfillment='bar';
 end if;
 return private.order_view(oid);
end $$;

-- 6) El cliente corrige su lugar (por lista o moviendo el pin) mientras el pedido no se haya entregado.
create or replace function public.order_change_spot(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); oid uuid; sid uuid; o public.orders; v public.venues; spot public.delivery_spots; m public.venue_maps;
 mid uuid; px numeric; py numeric; place jsonb; previous text; has_point boolean:=input ? 'point'; new_label text;
begin
 if uid is null then raise exception 'NOT_AUTHORIZED'; end if;
 begin oid:=(input->>'orderId')::uuid; exception when others then raise exception 'INVALID_INPUT'; end;
 if input ? 'spotId' and jsonb_typeof(input->'spotId')<>'null' then
  begin sid:=(input->>'spotId')::uuid; exception when others then raise exception 'INVALID_INPUT'; end;
 end if;
 if has_point then select r.mid,r.px,r.py into mid,px,py from private.read_point(input->'point') r;
 elsif sid is null then raise exception 'INVALID_INPUT'; end if;
 if not private.limit_action('spot',20) then return jsonb_build_object('error','RATE_LIMITED'); end if;
 select * into o from public.orders where id=oid for update;
 if not found or o.customer_id<>uid then raise exception 'NOT_AUTHORIZED'; end if;
 if o.fulfillment<>'location' or o.status not in ('pending_authorization','queued','preparing','ready') then raise exception 'INVALID_TRANSITION'; end if;
 select * into v from public.venues where id=o.venue_id for share;
 if v.delivery_mode='bar' then raise exception 'SPOT_INVALID'; end if;
 previous:=o.spot_label;
 if has_point then
  select * into m from public.venue_maps where id=mid and venue_id=o.venue_id and status='published' for share;
  if not found then raise exception 'MAP_OUTDATED'; end if;
  if not private.in_service_area(m.service_area,px,py) then raise exception 'OUTSIDE_AREA'; end if;
  place:=private.resolve_place(m,px,py,sid);
  if o.map_id is not distinct from m.id and o.map_x=px and o.map_y=py then return private.order_view(o.id); end if;
  new_label:=coalesce(place->>'label','Punto en el mapa');
  update public.orders set spot_id=nullif(place->>'spot_id','')::uuid,spot_label=new_label,spot_area=nullif(place->>'area',''),
   map_id=m.id,map_x=px,map_y=py,spot_changed_at=now() where id=o.id returning * into o;
 else
  select * into spot from public.delivery_spots where id=sid and venue_id=o.venue_id for share;
  if not found or not spot.enabled then raise exception 'SPOT_INVALID'; end if;
  if o.spot_id=spot.id and o.map_id is null then return private.order_view(o.id); end if;
  new_label:=spot.label;
  update public.orders set spot_id=spot.id,spot_label=spot.label,spot_area=nullif(spot.area,''),
   map_id=null,map_x=null,map_y=null,spot_changed_at=now() where id=o.id returning * into o;
 end if;
 perform private.event(o,'spot_changed',null,jsonb_build_object('from',previous,'to',new_label,'pin',has_point));
 return private.order_view(o.id);
end $$;

-- 7) Administración. El local ya podía activar la entrega con lugares; ahora también con solo un mapa (un festival no
--    tiene mesas numeradas: un pin dentro del área basta).
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
 if mode<>'bar' and not private.can_deliver(vid) then raise exception 'NO_SPOTS'; end if;
 update public.venues set delivery_mode=mode,spot_noun=coalesce(noun,spot_noun) where id=vid returning * into v;
 insert into private.platform_events(actor_id,action,venue_id,metadata) values(auth.uid(),'delivery_config',vid,jsonb_build_object('mode',v.delivery_mode,'noun',v.spot_noun));
 return jsonb_build_object('mode',v.delivery_mode,'noun',v.spot_noun);
end $$;

-- Con "shape" (objeto) el lugar se ubica en el mapa; con "shape": null se quita; sin la clave no cambia.
create or replace function public.venue_spot_save(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare vid uuid; sid uuid; lbl text; ar text; en boolean; v public.venues; s public.delivery_spots; n integer; set_shape boolean:=input ? 'shape'; sh jsonb;
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
 if set_shape and jsonb_typeof(input->'shape')<>'null' then
  sh:=input->'shape';
  if not private.valid_shape(sh) then raise exception 'INVALID_SHAPE'; end if;
 end if;
 if not private.is_staff(vid,true) then raise exception 'NOT_AUTHORIZED'; end if;
 select * into v from public.venues where id=vid for update;
 if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
 if sh is not null and not exists(select 1 from public.venue_maps where venue_id=vid and status='published') then raise exception 'NO_MAP'; end if;
 begin
  if sid is null then
   select count(*) into n from public.delivery_spots where venue_id=vid;
   if n>=300 then raise exception 'TOO_MANY_SPOTS'; end if;
   insert into public.delivery_spots(venue_id,label,area,position,enabled,shape)
    values(vid,lbl,ar,coalesce((select max(position) from public.delivery_spots where venue_id=vid),0)+1,coalesce(en,true),sh) returning * into s;
  else
   select * into s from public.delivery_spots where id=sid and venue_id=vid for update;
   if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
   if en is false and s.enabled and v.delivery_mode<>'bar' and not private.can_deliver(vid,s.id) then raise exception 'LAST_SPOT'; end if;
   update public.delivery_spots set label=lbl,area=ar,enabled=coalesce(en,enabled),shape=case when set_shape then sh else shape end where id=s.id returning * into s;
  end if;
 exception when unique_violation then raise exception 'SPOT_DUPLICATE';
 end;
 insert into private.platform_events(actor_id,action,venue_id,metadata) values(auth.uid(),'spot_save',vid,jsonb_build_object('spot',s.id,'label',s.label,'enabled',s.enabled,'shape',s.shape->>'kind'));
 return to_jsonb(s);
end $$;

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
 if s.enabled and v.delivery_mode<>'bar' and not private.can_deliver(vid,s.id) then raise exception 'LAST_SPOT'; end if;
 delete from public.delivery_spots where id=s.id;
 insert into private.platform_events(actor_id,action,venue_id,metadata) values(auth.uid(),'spot_delete',vid,jsonb_build_object('label',s.label));
 return jsonb_build_object('deleted',true);
end $$;

-- Mapa nuevo (o reemplazo de la imagen): versión siguiente, hereda el área de servicio y retira la anterior. La imagen debe
-- ser un archivo de este local en Storage; el pedido anterior sigue apuntando a su versión.
create function public.venue_map_save(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare vid uuid; url text; w integer; h integer; v public.venues; prev public.venue_maps; m public.venue_maps;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHORIZED'; end if;
 begin vid:=(input->>'venueId')::uuid; w:=(input->>'width')::integer; h:=(input->>'height')::integer; exception when others then raise exception 'INVALID_INPUT'; end;
 url:=input->>'imageUrl';
 if vid is null or w is null or h is null or w not between 1 and 20000 or h not between 1 and 20000 or url is null
    or url !~ ('^https?://[A-Za-z0-9.:-]+/storage/v1/object/public/venue-images/'||vid::text||'/map-[A-Za-z0-9._-]{1,100}\.(jpg|jpeg|png|webp)$') then raise exception 'INVALID_INPUT'; end if;
 if not private.is_staff(vid,true) then raise exception 'NOT_AUTHORIZED'; end if;
 select * into v from public.venues where id=vid for update;
 if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
 select * into prev from public.venue_maps where venue_id=vid and status='published' for update;
 if found then update public.venue_maps set status='retired' where id=prev.id; end if;
 insert into public.venue_maps(venue_id,version,image_url,width,height,service_area)
  values(vid,coalesce((select max(version) from public.venue_maps where venue_id=vid),0)+1,url,w,h,coalesce(prev.service_area,'[]'::jsonb)) returning * into m;
 insert into private.platform_events(actor_id,action,venue_id,metadata) values(auth.uid(),'map_save',vid,jsonb_build_object('map',m.id,'version',m.version));
 return to_jsonb(m);
end $$;

-- Área de servicio: polígonos (hasta 10) donde sí se entrega. Vacía = toda la imagen.
create function public.venue_map_area(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare vid uuid; area jsonb:=input->'serviceArea'; v public.venues; m public.venue_maps;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHORIZED'; end if;
 begin vid:=(input->>'venueId')::uuid; exception when others then raise exception 'INVALID_INPUT'; end;
 if vid is null then raise exception 'INVALID_INPUT'; end if;
 if not private.valid_area(area) then raise exception 'INVALID_SHAPE'; end if;
 if not private.is_staff(vid,true) then raise exception 'NOT_AUTHORIZED'; end if;
 select * into v from public.venues where id=vid for update;
 if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
 update public.venue_maps set service_area=area where venue_id=vid and status='published' returning * into m;
 if not found then raise exception 'NO_MAP'; end if;
 insert into private.platform_events(actor_id,action,venue_id,metadata) values(auth.uid(),'map_area',vid,jsonb_build_object('map',m.id,'polygons',jsonb_array_length(area)));
 return to_jsonb(m);
end $$;

-- Quitar el mapa: los lugares vuelven a ser solo una lista (se les borra la forma) y el cliente elige de ahí.
create function public.venue_map_remove(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare vid uuid; v public.venues; m public.venue_maps;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHORIZED'; end if;
 begin vid:=(input->>'venueId')::uuid; exception when others then raise exception 'INVALID_INPUT'; end;
 if vid is null then raise exception 'INVALID_INPUT'; end if;
 if not private.is_staff(vid,true) then raise exception 'NOT_AUTHORIZED'; end if;
 select * into v from public.venues where id=vid for update;
 if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
 select * into m from public.venue_maps where venue_id=vid and status='published' for update;
 if not found then raise exception 'NO_MAP'; end if;
 if v.delivery_mode<>'bar' and not exists(select 1 from public.delivery_spots where venue_id=vid and enabled) then raise exception 'LAST_SPOT'; end if;
 update public.venue_maps set status='retired' where id=m.id;
 update public.delivery_spots set shape=null where venue_id=vid and shape is not null;
 insert into private.platform_events(actor_id,action,venue_id,metadata) values(auth.uid(),'map_remove',vid,jsonb_build_object('map',m.id));
 return jsonb_build_object('removed',true);
end $$;

-- 8) Vista del pedido: la de 025 y, además, el mapa en que se marcó el pin (imagen y medidas; el cliente y el equipo del local
--    pueden leer el pedido, así que también ven su imagen aunque el local ya haya publicado otra versión).
create or replace function private.order_view(target_order_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(o)||jsonb_build_object('server_now',now(),'payment_state',p.status,'capture_state',(select provider_state from private.payment_operations where payment_id=p.id and type='capture'),'authorized_minor',p.authorized_minor,'captured_minor',p.captured_minor,'refunded_minor',p.refunded_minor,'venue',to_jsonb(v),'items',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('image_url',pr.image_url,'photo_path',pr.photo_path) order by i.id) from public.order_items i left join public.products pr on pr.id=i.product_id where i.order_id=o.id),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'order_id',e.order_id,'venue_id',e.venue_id,
     'actor_id',case when private.is_staff(o.venue_id) then e.actor_id end,'type',e.type,'from_status',e.from_status,'to_status',e.to_status,'created_at',e.created_at,
     'metadata',case when private.is_staff(o.venue_id) then e.metadata else '{}'::jsonb end) order by e.created_at) from public.order_events e where e.order_id=o.id),'[]'::jsonb),
  'delivered_by_name',case when private.is_staff(o.venue_id) then (select s.display_name from public.order_events e join public.staff_accounts s on s.user_id=e.actor_id where e.order_id=o.id and e.type='delivered' order by e.created_at desc limit 1) end,
  'map',(select jsonb_build_object('id',mp.id,'image_url',mp.image_url,'width',mp.width,'height',mp.height,'current',mp.status='published') from public.venue_maps mp where mp.id=o.map_id),
  'claim_id',case when c.owner_user_id=auth.uid() and c.owner_staff_session_id=auth.jwt()->>'session_id' then c.id else null end,
  'claimed_elsewhere',c.id is not null and not(c.owner_user_id=auth.uid() and c.owner_staff_session_id=auth.jwt()->>'session_id'),
  'encrypted_token',case when o.customer_id=auth.uid() and o.status='ready' and p.status in ('authorized','unknown','captured') and t.consumed_at is null and t.expires_at>now() then t.encrypted_token else null end)
 from public.orders o join public.venues v on v.id=o.venue_id join private.payments p on p.order_id=o.id left join private.pickup_claims c on c.order_id=o.id left join private.pickup_tokens t on t.order_id=o.id where o.id=target_order_id
$$;

-- Mismos permisos que 025: nada de private es ejecutable desde fuera salvo los predicados de RLS; las funciones públicas
-- nuevas solo para sesiones autenticadas.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_staff(uuid,boolean), private.can_read_order(uuid) to anon, authenticated;
revoke execute on function public.venue_map_save(jsonb), public.venue_map_area(jsonb), public.venue_map_remove(jsonb) from public, anon;
grant execute on function public.venue_map_save(jsonb), public.venue_map_area(jsonb), public.venue_map_remove(jsonb) to authenticated;
