-- Mapa interactivo de ubicación y entrega (2026-11-24). ADITIVA: tablas y funciones nuevas, una columna nullable en orders
-- y una redefinición de private.order_view que SOLO agrega la clave `location`. No cambia onza_command, estados, pagos ni
-- el flujo de retiro: la entrega sigue exigiendo validar el código/QR del ticket (resolve → complete).
--
-- Modelo
--  * venue_maps            Un mapa por local (permanente) o por edición de evento (fecha + sede). Guarda el BORRADOR de trabajo.
--  * venue_map_versions    Versiones PUBLICADAS e inmutables (imagen + elementos + zonas). Cada pedido apunta a la versión que
--                          usó, así actualizar el plano nunca altera la ubicación histórica de un pedido.
--  * order_locations       Ubicación de un pedido: coordenadas normalizadas 0..1 sobre la imagen de esa versión.
--  * venue_map_zone_staff  Personal asignado a una zona del mapa.
--  * private.map_events    Bitácora de auditoría (publicar, archivar, duplicar, ubicar, quitar ubicación).
-- Todo acceso pasa por funciones SECURITY DEFINER que comprueban permisos y validan coordenadas en el servidor.

alter table public.orders add column if not exists location_updated_at timestamptz;
comment on column public.orders.location_updated_at is 'Cambia cuando el cliente marca, corrige o quita su ubicación: dispara Realtime hacia la barra sin tocar version.';

create table public.venue_maps (
 id uuid primary key default gen_random_uuid(),
 venue_id uuid not null references public.venues(id),
 name text not null check (length(btrim(name)) between 1 and 100),
 kind text not null default 'permanent' check (kind in ('permanent','edition')),
 event_name text check (event_name is null or length(event_name)<=100),
 site_label text check (site_label is null or length(site_label)<=100),
 event_date date,
 status text not null default 'draft' check (status in ('draft','published','archived')),
 published_version integer check (published_version is null or published_version>=1),
 draft_revision integer not null default 1 check (draft_revision>=1),
 draft_image_path text,
 draft_image_width integer,
 draft_image_height integer,
 draft_layout jsonb not null default '{"elements":[],"zones":[]}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,venue_id),
 check (kind='edition' or event_date is null),
 check (draft_image_path is null or (draft_image_width between 64 and 8000 and draft_image_height between 64 and 8000)),
 check (draft_image_path is null or draft_image_path ~ '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]{1,120}|static:demo-maps/[A-Za-z0-9._-]{1,80})\.(jpg|jpeg|png|webp|svg)$')
);
create index venue_maps_venue on public.venue_maps(venue_id,status);

create table public.venue_map_versions (
 map_id uuid not null,
 venue_id uuid not null,
 version integer not null check (version>=1),
 source_revision integer not null,
 image_path text not null check (image_path ~ '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]{1,120}|static:demo-maps/[A-Za-z0-9._-]{1,80})\.(jpg|jpeg|png|webp|svg)$'),
 image_width integer not null check (image_width between 64 and 8000),
 image_height integer not null check (image_height between 64 and 8000),
 layout jsonb not null,
 published_at timestamptz not null default now(),
 published_by uuid references auth.users(id),
 primary key(map_id,version),
 foreign key (map_id,venue_id) references public.venue_maps(id,venue_id)
);

-- Una versión publicada no se modifica ni se borra jamás: es la referencia de los pedidos que la usaron.
create function private.map_version_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'MAP_VERSION_IMMUTABLE'; end $$;
create trigger venue_map_versions_immutable before update or delete on public.venue_map_versions
 for each row execute function private.map_version_immutable();

create table public.order_locations (
 order_id uuid primary key references public.orders(id),
 venue_id uuid not null,
 map_id uuid not null,
 map_version integer not null,
 delivery_method text not null check (delivery_method in ('location_on_map','table','table_qr')),
 x double precision not null check (x between 0 and 1),
 y double precision not null check (y between 0 and 1),
 zone_id text,
 zone_name text,
 element_id text,
 element_label text,
 reference_id text,
 reference_label text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key (order_id,venue_id) references public.orders(id,venue_id),
 foreign key (map_id,map_version) references public.venue_map_versions(map_id,version)
);
create index order_locations_map on public.order_locations(map_id,map_version);

create table public.venue_map_zone_staff (
 map_id uuid not null,
 venue_id uuid not null,
 zone_id text not null check (zone_id ~ '^[A-Za-z0-9_-]{1,40}$'),
 user_id uuid not null,
 primary key(map_id,zone_id,user_id),
 foreign key (map_id,venue_id) references public.venue_maps(id,venue_id),
 foreign key (user_id,venue_id) references public.memberships(user_id,venue_id) on delete cascade
);

create table private.map_events (
 id uuid primary key default gen_random_uuid(),
 at timestamptz not null default now(),
 actor_id uuid,
 venue_id uuid not null,
 map_id uuid,
 map_version integer,
 order_id uuid,
 action text not null,
 details jsonb not null default '{}'::jsonb
);
create index map_events_venue on private.map_events(venue_id,at desc);

alter table public.venue_maps enable row level security;
alter table public.venue_map_versions enable row level security;
alter table public.order_locations enable row level security;
alter table public.venue_map_zone_staff enable row level security;
alter table private.map_events enable row level security;
-- Sin políticas y sin privilegios: ninguna lectura ni escritura directa con el JWT del usuario; solo las funciones de abajo.
revoke all on public.venue_maps, public.venue_map_versions, public.order_locations, public.venue_map_zone_staff from public, anon, authenticated;
revoke all on private.map_events from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- Geometría y validación del plano (coordenadas normalizadas 0..1 sobre la imagen)
-- ---------------------------------------------------------------------------------------------------------------------
create function private.map_num01(v jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(v)='number' and (v#>>'{}')::double precision between 0 and 1,false)
$$;

create function private.point_in_polygon(px double precision,py double precision,pts jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare n integer:=jsonb_array_length(pts); i integer; j integer; xi double precision; yi double precision; xj double precision; yj double precision; inside boolean:=false;
begin
 j:=n-1;
 for i in 0..n-1 loop
  xi:=(pts->i->>'x')::double precision; yi:=(pts->i->>'y')::double precision;
  xj:=(pts->j->>'x')::double precision; yj:=(pts->j->>'y')::double precision;
  if ((yi>py)<>(yj>py)) and (px<(xj-xi)*(py-yi)/(yj-yi)+xi) then inside:=not inside; end if;
  j:=i;
 end loop;
 return inside;
end $$;

-- Forma del plano: {"elements":[{id,type,label,x,y}],"zones":[{id,name,kind,delivery,points:[{x,y}]}]}. Rechaza claves ajenas.
create function private.map_validate_layout(layout jsonb) returns void language plpgsql immutable set search_path='' as $$
declare el jsonb; zn jsonb; pt jsonb; eids text[]:='{}'; zids text[]:='{}';
begin
 if layout is null or jsonb_typeof(layout)<>'object' or coalesce(jsonb_typeof(layout->'elements'),'')<>'array' or coalesce(jsonb_typeof(layout->'zones'),'')<>'array' then raise exception 'INVALID_MAP_LAYOUT'; end if;
 if exists(select 1 from jsonb_object_keys(layout) k where k<>all(array['elements','zones'])) then raise exception 'INVALID_MAP_LAYOUT'; end if;
 if length(layout::text)>200000 or jsonb_array_length(layout->'elements')>300 or jsonb_array_length(layout->'zones')>60 then raise exception 'INVALID_MAP_LAYOUT'; end if;
 for el in select * from jsonb_array_elements(layout->'elements') loop
  if jsonb_typeof(el)<>'object' or exists(select 1 from jsonb_object_keys(el) k where k<>all(array['id','type','label','x','y'])) then raise exception 'INVALID_MAP_LAYOUT'; end if;
  if coalesce(el->>'id','') !~ '^[A-Za-z0-9_-]{1,40}$' or coalesce(el->>'id','')=any(eids) then raise exception 'INVALID_MAP_LAYOUT'; end if;
  eids:=eids||(el->>'id');
  if coalesce(el->>'type','')<>all(array['table','bar','entrance','stage','poi','delivery_point']) then raise exception 'INVALID_MAP_LAYOUT'; end if;
  if coalesce(jsonb_typeof(el->'label'),'')<>'string' or length(btrim(el->>'label')) not between 1 and 60 then raise exception 'INVALID_MAP_LAYOUT'; end if;
  if not private.map_num01(el->'x') or not private.map_num01(el->'y') then raise exception 'INVALID_MAP_LAYOUT'; end if;
 end loop;
 for zn in select * from jsonb_array_elements(layout->'zones') loop
  if jsonb_typeof(zn)<>'object' or exists(select 1 from jsonb_object_keys(zn) k where k<>all(array['id','name','kind','delivery','points'])) then raise exception 'INVALID_MAP_LAYOUT'; end if;
  if coalesce(zn->>'id','') !~ '^[A-Za-z0-9_-]{1,40}$' or coalesce(zn->>'id','')=any(zids) then raise exception 'INVALID_MAP_LAYOUT'; end if;
  zids:=zids||(zn->>'id');
  if coalesce(jsonb_typeof(zn->'name'),'')<>'string' or length(btrim(zn->>'name')) not between 1 and 60 then raise exception 'INVALID_MAP_LAYOUT'; end if;
  if coalesce(zn->>'kind','')<>all(array['general','vip']) or coalesce(zn->>'delivery','')<>all(array['default','allow','restrict']) then raise exception 'INVALID_MAP_LAYOUT'; end if;
  if coalesce(jsonb_typeof(zn->'points'),'')<>'array' or jsonb_array_length(zn->'points') not between 3 and 40 then raise exception 'INVALID_MAP_LAYOUT'; end if;
  for pt in select * from jsonb_array_elements(zn->'points') loop
   if jsonb_typeof(pt)<>'object' or exists(select 1 from jsonb_object_keys(pt) k where k<>all(array['x','y'])) or not private.map_num01(pt->'x') or not private.map_num01(pt->'y') then raise exception 'INVALID_MAP_LAYOUT'; end if;
  end loop;
 end loop;
end $$;

-- Resuelve una selección contra una versión publicada y la valida: dentro del plano y sin zonas restringidas.
-- Si el plano define zonas con entrega "allow", la entrega solo se acepta dentro de alguna de ellas.
-- input: {method:'location_on_map',x,y} | {method:'table'|'table_qr',tableId}.
create function private.map_resolve_point(layout jsonb,w integer,h integer,input jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare
 method text:=input->>'method'; px double precision; py double precision; el jsonb; zn jsonb;
 chosen jsonb; zone_pick jsonb; allow_exists boolean:=false; in_allow boolean:=false; best jsonb; best_d double precision; d double precision;
begin
 if method is null or method<>all(array['location_on_map','table','table_qr']) then raise exception 'INVALID_INPUT'; end if;
 if method='location_on_map' then
  if coalesce(jsonb_typeof(input->'x'),'')<>'number' or coalesce(jsonb_typeof(input->'y'),'')<>'number' then raise exception 'INVALID_INPUT'; end if;
  px:=(input->>'x')::double precision; py:=(input->>'y')::double precision;
  if not (px between 0 and 1) or not (py between 0 and 1) then raise exception 'LOCATION_OUT_OF_MAP'; end if;
 else
  select e into chosen from jsonb_array_elements(layout->'elements') e where e->>'id'=input->>'tableId' and e->>'type'='table';
  if chosen is null then raise exception 'LOCATION_OUT_OF_MAP'; end if;
  px:=(chosen->>'x')::double precision; py:=(chosen->>'y')::double precision;
 end if;
 for zn in select * from jsonb_array_elements(layout->'zones') loop
  if zn->>'delivery'='allow' then allow_exists:=true; end if;
  if private.point_in_polygon(px,py,zn->'points') then
   if zn->>'delivery'='restrict' then raise exception 'LOCATION_RESTRICTED'; end if;
   if zn->>'delivery'='allow' then in_allow:=true; end if;
   if zone_pick is null or (zn->>'kind'='vip' and zone_pick->>'kind'<>'vip') then zone_pick:=zn; end if;
  end if;
 end loop;
 if allow_exists and not in_allow then raise exception 'LOCATION_RESTRICTED'; end if;
 -- Referencia más cercana (cualquier elemento), medida en píxeles de la imagen para no sesgarla por la proporción del plano.
 for el in select * from jsonb_array_elements(layout->'elements') loop
  d:=sqrt(power(((el->>'x')::double precision-px)*w,2)+power(((el->>'y')::double precision-py)*h,2));
  if best is null or d<best_d then best:=el; best_d:=d; end if;
 end loop;
 return jsonb_build_object('x',px,'y',py,'delivery_method',method,
  'zone_id',zone_pick->>'id','zone_name',zone_pick->>'name',
  'element_id',chosen->>'id','element_label',chosen->>'label',
  'reference_id',best->>'id','reference_label',best->>'label');
end $$;

-- Un mapa se ofrece en el checkout si está publicado y, siendo una edición con fecha, es de la noche en curso.
create function private.map_available(m public.venue_maps) returns boolean language sql stable set search_path='' as $$
 select m.status='published' and m.published_version is not null
  and (m.kind='permanent' or m.event_date is null or m.event_date=public.business_date_at(now()))
$$;

create function private.map_audit(venue uuid,map uuid,map_version integer,order_ref uuid,act text,info jsonb default '{}') returns void language sql set search_path='' as $$
 insert into private.map_events(actor_id,venue_id,map_id,map_version,order_id,action,details) values(auth.uid(),venue,map,map_version,order_ref,act,info)
$$;

create function private.map_staff_for(mid uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(z.zone_id,z.members),'{}'::jsonb) from (
  select s.zone_id,jsonb_agg(jsonb_build_object('user_id',s.user_id,'name',coalesce(a.display_name,'Persona del equipo')) order by coalesce(a.display_name,'')) as members
  from public.venue_map_zone_staff s left join public.staff_accounts a on a.user_id=s.user_id where s.map_id=mid group by s.zone_id
 ) z
$$;

create function private.map_summary(m public.venue_maps) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'id',m.id,'venue_id',m.venue_id,'name',m.name,'kind',m.kind,'event_name',m.event_name,'site_label',m.site_label,'event_date',m.event_date,
  'status',m.status,'published_version',m.published_version,'draft_revision',m.draft_revision,
  'image_path',m.draft_image_path,'image_width',m.draft_image_width,'image_height',m.draft_image_height,
  'elements',jsonb_array_length(m.draft_layout->'elements'),'zones',jsonb_array_length(m.draft_layout->'zones'),
  'has_unpublished_changes',m.status<>'archived' and (m.published_version is null or coalesce((select v.source_revision<>m.draft_revision from public.venue_map_versions v where v.map_id=m.id and v.version=m.published_version),true)),
  'available_now',private.map_available(m),
  'versions',coalesce((select jsonb_agg(jsonb_build_object('version',v.version,'published_at',v.published_at,'image_path',v.image_path) order by v.version desc) from public.venue_map_versions v where v.map_id=m.id),'[]'::jsonb),
  'updated_at',m.updated_at)
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Administración (solo administradores del local)
-- ---------------------------------------------------------------------------------------------------------------------
create function public.map_admin_list(venue uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.is_staff(venue,true) then raise exception 'NOT_AUTHORIZED'; end if;
 return coalesce((select jsonb_agg(private.map_summary(m) order by (m.status='archived'),m.created_at desc) from public.venue_maps m where m.venue_id=venue),'[]'::jsonb);
end $$;

create function public.map_admin_get(map uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m public.venue_maps;
begin
 select * into m from public.venue_maps where id=map;
 if auth.uid() is null or not found or not private.is_staff(m.venue_id,true) then raise exception 'NOT_AUTHORIZED'; end if;
 return private.map_summary(m)||jsonb_build_object('layout',m.draft_layout,'zone_staff',private.map_staff_for(m.id),
  'team',coalesce((select jsonb_agg(jsonb_build_object('user_id',t.user_id,'name',coalesce(a.display_name,'Persona del equipo'),'role',t.role) order by coalesce(a.display_name,''))
    from public.memberships t left join public.staff_accounts a on a.user_id=t.user_id where t.venue_id=m.venue_id),'[]'::jsonb));
end $$;

create function public.map_create(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare vid uuid; m public.venue_maps; k text; d date; nm text;
begin
 if auth.uid() is null or input is null or jsonb_typeof(input)<>'object' then raise exception 'NOT_AUTHORIZED'; end if;
 begin vid:=(input->>'venueId')::uuid; exception when others then raise exception 'INVALID_MAP'; end;
 if not private.is_staff(vid,true) then raise exception 'NOT_AUTHORIZED'; end if;
 if not private.limit_action('map_admin',60) then raise exception 'RATE_LIMITED'; end if;
 nm:=btrim(coalesce(input->>'name',''));
 k:=coalesce(input->>'kind','permanent');
 if length(nm) not between 1 and 100 or k<>all(array['permanent','edition']) then raise exception 'INVALID_MAP'; end if;
 if coalesce(length(input->>'eventName'),0)>100 or coalesce(length(input->>'siteLabel'),0)>100 then raise exception 'INVALID_MAP'; end if;
 begin d:=nullif(input->>'eventDate','')::date; exception when others then raise exception 'INVALID_MAP'; end;
 if k='edition' and d is null then raise exception 'INVALID_MAP'; end if;
 if k='permanent' then d:=null; end if;
 if (select count(*) from public.venue_maps where venue_id=vid)>=40 then raise exception 'MAP_LIMIT'; end if;
 insert into public.venue_maps(venue_id,name,kind,event_name,site_label,event_date)
  values(vid,nm,k,nullif(btrim(coalesce(input->>'eventName','')),''),nullif(btrim(coalesce(input->>'siteLabel','')),''),d) returning * into m;
 perform private.map_audit(vid,m.id,null,null,'map_created',jsonb_build_object('kind',k));
 return private.map_summary(m);
end $$;

create function public.map_update_meta(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.venue_maps; nm text; d date; k text;
begin
 if auth.uid() is null or input is null or jsonb_typeof(input)<>'object' then raise exception 'NOT_AUTHORIZED'; end if;
 select * into m from public.venue_maps where id=nullif(input->>'mapId','')::uuid for update;
 if not found or not private.is_staff(m.venue_id,true) then raise exception 'NOT_AUTHORIZED'; end if;
 if not private.limit_action('map_admin',60) then raise exception 'RATE_LIMITED'; end if;
 nm:=case when input ? 'name' then btrim(coalesce(input->>'name','')) else m.name end;
 k:=m.kind;
 d:=m.event_date;
 if input ? 'eventDate' then begin d:=nullif(input->>'eventDate','')::date; exception when others then raise exception 'INVALID_MAP'; end; end if;
 if length(nm) not between 1 and 100 then raise exception 'INVALID_MAP'; end if;
 if k='edition' and d is null then raise exception 'INVALID_MAP'; end if;
 if k='permanent' then d:=null; end if;
 if (input ? 'eventName' and coalesce(length(input->>'eventName'),0)>100) or (input ? 'siteLabel' and coalesce(length(input->>'siteLabel'),0)>100) then raise exception 'INVALID_MAP'; end if;
 update public.venue_maps set name=nm,event_date=d,
  event_name=case when input ? 'eventName' then nullif(btrim(coalesce(input->>'eventName','')),'') else event_name end,
  site_label=case when input ? 'siteLabel' then nullif(btrim(coalesce(input->>'siteLabel','')),'') else site_label end,
  updated_at=now() where id=m.id returning * into m;
 return private.map_summary(m);
end $$;

create function public.map_save_draft(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.venue_maps; img text; w integer; h integer; lay jsonb;
begin
 if auth.uid() is null or input is null or jsonb_typeof(input)<>'object' then raise exception 'NOT_AUTHORIZED'; end if;
 select * into m from public.venue_maps where id=nullif(input->>'mapId','')::uuid for update;
 if not found or not private.is_staff(m.venue_id,true) then raise exception 'NOT_AUTHORIZED'; end if;
 if not private.limit_action('map_admin',120) then raise exception 'RATE_LIMITED'; end if;
 if m.status='archived' then raise exception 'INVALID_TRANSITION'; end if;
 if input->>'expectedRevision' is null or m.draft_revision<>(input->>'expectedRevision')::integer then raise exception 'VERSION_CONFLICT'; end if;
 img:=m.draft_image_path; w:=m.draft_image_width; h:=m.draft_image_height; lay:=m.draft_layout;
 if input ? 'imagePath' then
  img:=input->>'imagePath';
  if img is null or img !~ ('^'||m.venue_id::text||'/[A-Za-z0-9._-]{1,120}\.(jpg|jpeg|png|webp|svg)$') then raise exception 'INVALID_MAP_IMAGE'; end if;
  if coalesce(jsonb_typeof(input->'imageWidth'),'')<>'number' or coalesce(jsonb_typeof(input->'imageHeight'),'')<>'number' then raise exception 'INVALID_MAP_IMAGE'; end if;
  w:=(input->>'imageWidth')::numeric::integer; h:=(input->>'imageHeight')::numeric::integer;
  if w not between 64 and 8000 or h not between 64 and 8000 then raise exception 'INVALID_MAP_IMAGE'; end if;
 end if;
 if input ? 'layout' then perform private.map_validate_layout(input->'layout'); lay:=input->'layout'; end if;
 update public.venue_maps set draft_image_path=img,draft_image_width=w,draft_image_height=h,draft_layout=lay,draft_revision=draft_revision+1,updated_at=now() where id=m.id returning * into m;
 delete from public.venue_map_zone_staff s where s.map_id=m.id and not exists(select 1 from jsonb_array_elements(m.draft_layout->'zones') z where z->>'id'=s.zone_id)
  and not exists(select 1 from public.venue_map_versions v,jsonb_array_elements(v.layout->'zones') z where v.map_id=m.id and v.version=m.published_version and z->>'id'=s.zone_id);
 return private.map_summary(m);
end $$;

-- Publica el borrador como una versión nueva e inmutable. Los pedidos ya hechos siguen apuntando a su versión.
create function public.map_publish(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.venue_maps; nv integer;
begin
 if auth.uid() is null or input is null or jsonb_typeof(input)<>'object' then raise exception 'NOT_AUTHORIZED'; end if;
 select * into m from public.venue_maps where id=nullif(input->>'mapId','')::uuid for update;
 if not found or not private.is_staff(m.venue_id,true) then raise exception 'NOT_AUTHORIZED'; end if;
 if not private.limit_action('map_admin',60) then raise exception 'RATE_LIMITED'; end if;
 if m.status='archived' then raise exception 'INVALID_TRANSITION'; end if;
 if input->>'expectedRevision' is null or m.draft_revision<>(input->>'expectedRevision')::integer then raise exception 'VERSION_CONFLICT'; end if;
 if m.draft_image_path is null then raise exception 'MAP_IMAGE_REQUIRED'; end if;
 perform private.map_validate_layout(m.draft_layout);
 if m.published_version is not null and exists(select 1 from public.venue_map_versions v where v.map_id=m.id and v.version=m.published_version and v.source_revision=m.draft_revision) then raise exception 'NO_CHANGES'; end if;
 nv:=coalesce(m.published_version,0)+1;
 insert into public.venue_map_versions(map_id,venue_id,version,source_revision,image_path,image_width,image_height,layout,published_by)
  values(m.id,m.venue_id,nv,m.draft_revision,m.draft_image_path,m.draft_image_width,m.draft_image_height,m.draft_layout,auth.uid());
 update public.venue_maps set published_version=nv,status='published',updated_at=now() where id=m.id returning * into m;
 perform private.map_audit(m.venue_id,m.id,nv,null,'map_published');
 return private.map_summary(m);
end $$;

create function public.map_archive(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.venue_maps; archive boolean;
begin
 if auth.uid() is null or input is null or jsonb_typeof(input)<>'object' then raise exception 'NOT_AUTHORIZED'; end if;
 select * into m from public.venue_maps where id=nullif(input->>'mapId','')::uuid for update;
 if not found or not private.is_staff(m.venue_id,true) then raise exception 'NOT_AUTHORIZED'; end if;
 if not private.limit_action('map_admin',60) then raise exception 'RATE_LIMITED'; end if;
 archive:=coalesce((input->>'archived')::boolean,true);
 update public.venue_maps set status=case when archive then 'archived' when published_version is null then 'draft' else 'published' end,updated_at=now() where id=m.id returning * into m;
 perform private.map_audit(m.venue_id,m.id,m.published_version,null,case when archive then 'map_archived' else 'map_restored' end);
 return private.map_summary(m);
end $$;

-- Duplica un mapa (por ejemplo, la edición anterior de un evento) como borrador nuevo: misma imagen y mismo plano, sin versiones
-- ni personal asignado. Se puede ajustar antes de publicar.
create function public.map_duplicate(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.venue_maps; m public.venue_maps; k text; d date; nm text; img text; w integer; h integer; lay jsonb; lv public.venue_map_versions;
begin
 if auth.uid() is null or input is null or jsonb_typeof(input)<>'object' then raise exception 'NOT_AUTHORIZED'; end if;
 select * into s from public.venue_maps where id=nullif(input->>'mapId','')::uuid;
 if not found or not private.is_staff(s.venue_id,true) then raise exception 'NOT_AUTHORIZED'; end if;
 if not private.limit_action('map_admin',60) then raise exception 'RATE_LIMITED'; end if;
 nm:=btrim(coalesce(nullif(input->>'name',''),left(s.name,92)||' (copia)'));
 k:=coalesce(input->>'kind',s.kind);
 if length(nm) not between 1 and 100 or k<>all(array['permanent','edition']) then raise exception 'INVALID_MAP'; end if;
 begin d:=case when input ? 'eventDate' then nullif(input->>'eventDate','')::date else s.event_date end; exception when others then raise exception 'INVALID_MAP'; end;
 if k='edition' and d is null then raise exception 'INVALID_MAP'; end if;
 if k='permanent' then d:=null; end if;
 if (select count(*) from public.venue_maps where venue_id=s.venue_id)>=40 then raise exception 'MAP_LIMIT'; end if;
 img:=s.draft_image_path; w:=s.draft_image_width; h:=s.draft_image_height; lay:=s.draft_layout;
 if img is null and s.published_version is not null then
  select * into lv from public.venue_map_versions where map_id=s.id and version=s.published_version;
  img:=lv.image_path; w:=lv.image_width; h:=lv.image_height; lay:=lv.layout;
 end if;
 insert into public.venue_maps(venue_id,name,kind,event_name,site_label,event_date,draft_image_path,draft_image_width,draft_image_height,draft_layout)
  values(s.venue_id,nm,k,
   case when input ? 'eventName' then nullif(btrim(coalesce(input->>'eventName','')),'') else s.event_name end,
   case when input ? 'siteLabel' then nullif(btrim(coalesce(input->>'siteLabel','')),'') else s.site_label end,
   d,img,w,h,lay) returning * into m;
 perform private.map_audit(m.venue_id,m.id,null,null,'map_duplicated',jsonb_build_object('source',s.id));
 return private.map_summary(m);
end $$;

-- Asigna personal a una zona. Solo miembros del propio local (la FK lo garantiza) y zonas que existan en el plano.
create function public.map_assign_staff(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.venue_maps; zid text:=input->>'zoneId'; uid text;
begin
 if auth.uid() is null or input is null or jsonb_typeof(input)<>'object' then raise exception 'NOT_AUTHORIZED'; end if;
 select * into m from public.venue_maps where id=nullif(input->>'mapId','')::uuid for update;
 if not found or not private.is_staff(m.venue_id,true) then raise exception 'NOT_AUTHORIZED'; end if;
 if not private.limit_action('map_admin',60) then raise exception 'RATE_LIMITED'; end if;
 if zid is null or coalesce(jsonb_typeof(input->'userIds'),'')<>'array' or jsonb_array_length(input->'userIds')>50 then raise exception 'INVALID_INPUT'; end if;
 if not exists(select 1 from jsonb_array_elements(m.draft_layout->'zones') z where z->>'id'=zid)
    and not exists(select 1 from public.venue_map_versions v,jsonb_array_elements(v.layout->'zones') z where v.map_id=m.id and v.version=m.published_version and z->>'id'=zid) then raise exception 'INVALID_INPUT'; end if;
 delete from public.venue_map_zone_staff where map_id=m.id and zone_id=zid;
 for uid in select jsonb_array_elements_text(input->'userIds') loop
  if not exists(select 1 from public.memberships t where t.user_id=uid::uuid and t.venue_id=m.venue_id) then raise exception 'NOT_MEMBER'; end if;
  insert into public.venue_map_zone_staff(map_id,venue_id,zone_id,user_id) values(m.id,m.venue_id,zid,uid::uuid) on conflict do nothing;
 end loop;
 perform private.map_audit(m.venue_id,m.id,null,null,'zone_staff_assigned',jsonb_build_object('zone',zid));
 return private.map_staff_for(m.id);
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Lectura: mapas ofrecidos a clientes y versión usada por un pedido
-- ---------------------------------------------------------------------------------------------------------------------
create function public.map_for_venue(venue uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'NOT_AUTHORIZED'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'kind',m.kind,'event_name',m.event_name,'site_label',m.site_label,
   'version',v.version,'image_path',v.image_path,'image_width',v.image_width,'image_height',v.image_height,'layout',v.layout) order by m.created_at)
  from public.venue_maps m join public.venue_map_versions v on v.map_id=m.id and v.version=m.published_version
  where m.venue_id=venue and private.map_available(m)),'[]'::jsonb);
end $$;

-- Una versión la leen: el equipo de ese local, cualquiera mientras sea la versión vigente de un mapa disponible (para elegir),
-- y el cliente dueño de un pedido que la usó (para ver su propia ubicación histórica).
create function public.map_version_get(map uuid,ver integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m public.venue_maps; v public.venue_map_versions; ok boolean:=false;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHORIZED'; end if;
 select * into m from public.venue_maps where id=map;
 select * into v from public.venue_map_versions where map_id=map and version=ver;
 if m.id is null or v.map_id is null then raise exception 'NOT_AUTHORIZED'; end if;
 ok:=private.is_staff(m.venue_id)
  or (m.published_version=v.version and private.map_available(m))
  or exists(select 1 from public.order_locations l join public.orders o on o.id=l.order_id where l.map_id=map and l.map_version=ver and o.customer_id=auth.uid());
 if not ok then raise exception 'NOT_AUTHORIZED'; end if;
 return jsonb_build_object('id',m.id,'venue_id',m.venue_id,'name',m.name,'kind',m.kind,'version',v.version,'image_path',v.image_path,
  'image_width',v.image_width,'image_height',v.image_height,'layout',v.layout,'published_at',v.published_at);
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Ubicación del pedido
-- ---------------------------------------------------------------------------------------------------------------------
create function private.map_resolve_for(vid uuid,input jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m public.venue_maps; v public.venue_map_versions; mid uuid;
begin
 begin mid:=(input->>'mapId')::uuid; exception when others then raise exception 'INVALID_INPUT'; end;
 select * into m from public.venue_maps where id=mid and venue_id=vid;
 if not found or not private.map_available(m) then raise exception 'MAP_UNAVAILABLE'; end if;
 select * into v from public.venue_map_versions where map_id=m.id and version=m.published_version;
 return private.map_resolve_point(v.layout,v.image_width,v.image_height,input)||jsonb_build_object('map_id',m.id,'map_version',v.version,'map_name',m.name);
end $$;

-- Comprobación previa (sin escribir): el checkout la usa antes de crear el pedido para no dejar un pedido con ubicación inválida.
create function public.order_location_validate(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare vid uuid;
begin
 if auth.uid() is null or input is null or jsonb_typeof(input)<>'object' then raise exception 'NOT_AUTHORIZED'; end if;
 begin vid:=(input->>'venueId')::uuid; exception when others then raise exception 'INVALID_INPUT'; end;
 if not private.limit_action('order_location_check',60) then raise exception 'RATE_LIMITED'; end if;
 return private.map_resolve_for(vid,input);
end $$;

create function public.order_location_set(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); oid uuid; o public.orders; r jsonb;
begin
 if uid is null or input is null or jsonb_typeof(input)<>'object' then raise exception 'NOT_AUTHORIZED'; end if;
 begin oid:=(input->>'orderId')::uuid; exception when others then raise exception 'INVALID_INPUT'; end;
 select * into o from public.orders where id=oid for update;
 -- Solo el cliente dueño del pedido; el personal no cambia la ubicación que marcó el cliente.
 if not found or o.customer_id<>uid then raise exception 'NOT_AUTHORIZED'; end if;
 if not private.limit_action('order_location',30) then raise exception 'RATE_LIMITED'; end if;
 -- Se puede corregir mientras el pedido sigue activo y nadie del equipo empezó la entrega (reclamo del retiro).
 if o.status not in ('pending_authorization','queued','preparing','ready') or exists(select 1 from private.pickup_claims c where c.order_id=o.id) then raise exception 'LOCATION_LOCKED'; end if;
 r:=private.map_resolve_for(o.venue_id,input);
 insert into public.order_locations(order_id,venue_id,map_id,map_version,delivery_method,x,y,zone_id,zone_name,element_id,element_label,reference_id,reference_label)
  values(o.id,o.venue_id,(r->>'map_id')::uuid,(r->>'map_version')::integer,r->>'delivery_method',(r->>'x')::double precision,(r->>'y')::double precision,
   r->>'zone_id',r->>'zone_name',r->>'element_id',r->>'element_label',r->>'reference_id',r->>'reference_label')
  on conflict(order_id) do update set map_id=excluded.map_id,map_version=excluded.map_version,delivery_method=excluded.delivery_method,x=excluded.x,y=excluded.y,
   zone_id=excluded.zone_id,zone_name=excluded.zone_name,element_id=excluded.element_id,element_label=excluded.element_label,
   reference_id=excluded.reference_id,reference_label=excluded.reference_label,updated_at=now();
 update public.orders set location_updated_at=now() where id=o.id;
 perform private.map_audit(o.venue_id,(r->>'map_id')::uuid,(r->>'map_version')::integer,o.id,'location_set',jsonb_build_object('method',r->>'delivery_method','zone',r->>'zone_id'));
 return private.order_view(o.id);
end $$;

create function public.order_location_clear(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); oid uuid; o public.orders; l public.order_locations;
begin
 if uid is null or input is null or jsonb_typeof(input)<>'object' then raise exception 'NOT_AUTHORIZED'; end if;
 begin oid:=(input->>'orderId')::uuid; exception when others then raise exception 'INVALID_INPUT'; end;
 select * into o from public.orders where id=oid for update;
 if not found or o.customer_id<>uid then raise exception 'NOT_AUTHORIZED'; end if;
 if not private.limit_action('order_location',30) then raise exception 'RATE_LIMITED'; end if;
 if o.status not in ('pending_authorization','queued','preparing','ready') or exists(select 1 from private.pickup_claims c where c.order_id=o.id) then raise exception 'LOCATION_LOCKED'; end if;
 delete from public.order_locations where order_id=o.id returning * into l;
 if found then
  update public.orders set location_updated_at=now() where id=o.id;
  perform private.map_audit(o.venue_id,l.map_id,l.map_version,o.id,'location_cleared');
 end if;
 return private.order_view(o.id);
end $$;

-- Misma vista de pedido que 021, con una clave nueva `location`. Solo se llama después de comprobar que quien consulta es el
-- cliente dueño o el equipo del local, así que la ubicación nunca llega a otro cliente ni a otro local.
create or replace function private.order_view(target_order_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(o)||jsonb_build_object('server_now',now(),'payment_state',p.status,'capture_state',(select provider_state from private.payment_operations where payment_id=p.id and type='capture'),'authorized_minor',p.authorized_minor,'captured_minor',p.captured_minor,'refunded_minor',p.refunded_minor,'venue',to_jsonb(v),'items',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('image_url',pr.image_url,'photo_path',pr.photo_path) order by i.id) from public.order_items i left join public.products pr on pr.id=i.product_id where i.order_id=o.id),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'order_id',e.order_id,'venue_id',e.venue_id,
     'actor_id',case when private.is_staff(o.venue_id) then e.actor_id end,'type',e.type,'from_status',e.from_status,'to_status',e.to_status,'created_at',e.created_at,
     'metadata',case when private.is_staff(o.venue_id) then e.metadata else '{}'::jsonb end) order by e.created_at) from public.order_events e where e.order_id=o.id),'[]'::jsonb),
  'claim_id',case when c.owner_user_id=auth.uid() and c.owner_staff_session_id=auth.jwt()->>'session_id' then c.id else null end,
  'claimed_elsewhere',c.id is not null and not(c.owner_user_id=auth.uid() and c.owner_staff_session_id=auth.jwt()->>'session_id'),
  'encrypted_token',case when o.customer_id=auth.uid() and o.status='ready' and p.status in ('authorized','unknown','captured') and t.consumed_at is null and t.expires_at>now() then t.encrypted_token else null end,
  'location',(select jsonb_build_object('order_id',l.order_id,'map_id',l.map_id,'map_version',l.map_version,'map_name',m.name,
     'location',jsonb_build_object('x',l.x,'y',l.y),'zone_id',l.zone_id,'zone_name',l.zone_name,'delivery_method',l.delivery_method,
     'element_id',l.element_id,'element_label',l.element_label,'reference_id',l.reference_id,'reference_label',l.reference_label,'updated_at',l.updated_at,
     'assigned_staff',case when private.is_staff(o.venue_id) and l.zone_id is not null then coalesce((select jsonb_agg(coalesce(a.display_name,'Persona del equipo') order by coalesce(a.display_name,''))
        from public.venue_map_zone_staff s left join public.staff_accounts a on a.user_id=s.user_id where s.map_id=l.map_id and s.zone_id=l.zone_id),'[]'::jsonb) else '[]'::jsonb end)
     from public.order_locations l join public.venue_maps m on m.id=l.map_id where l.order_id=o.id))
 from public.orders o join public.venues v on v.id=o.venue_id join private.payments p on p.order_id=o.id left join private.pickup_claims c on c.order_id=o.id left join private.pickup_tokens t on t.order_id=o.id where o.id=target_order_id
$$;

revoke execute on all functions in schema private from public, anon, authenticated;
revoke all on function public.map_admin_list(uuid),public.map_admin_get(uuid),public.map_create(jsonb),public.map_update_meta(jsonb),public.map_save_draft(jsonb),
 public.map_publish(jsonb),public.map_archive(jsonb),public.map_duplicate(jsonb),public.map_assign_staff(jsonb),public.map_for_venue(uuid),public.map_version_get(uuid,integer),
 public.order_location_validate(jsonb),public.order_location_set(jsonb),public.order_location_clear(jsonb) from public, anon;
grant execute on function public.map_admin_list(uuid),public.map_admin_get(uuid),public.map_create(jsonb),public.map_update_meta(jsonb),public.map_save_draft(jsonb),
 public.map_publish(jsonb),public.map_archive(jsonb),public.map_duplicate(jsonb),public.map_assign_staff(jsonb),public.map_for_venue(uuid),public.map_version_get(uuid,integer),
 public.order_location_validate(jsonb),public.order_location_set(jsonb),public.order_location_clear(jsonb) to authenticated;
-- RLS/definer helpers que las políticas existentes siguen necesitando (la revocación de arriba cubre todo el esquema private).
grant execute on function private.is_staff(uuid,boolean),private.can_read_order(uuid) to anon, authenticated;
