-- Funciones del panel de plataforma (superadministrador) y del panel de empresa. ADITIVA (R4).
--
-- * Plataforma: cada función empieza con private.require_platform(): lectura sin segundo factor; todo lo que escribe o borra
--   (sensitive=true) exige un segundo factor verificado en los últimos 15 minutos. Cualquier otra cuenta recibe NOT_FOUND.
-- * Empresa: cada función exige un rol y el alcance de locales de la membresía, y que la empresa esté activa para escribir.
-- * Las invitaciones llegan con el HASH del token (la aplicación genera 256 bits y solo el hash toca la base). Aceptar una
--   invitación es de un solo uso, exige el mismo correo verificado y nunca convierte una cuenta personal en laboral.
-- * Las membresías de empresa se reflejan en `memberships` (el modelo operativo existente) para que el administrador de cada
--   local y el equipo de barra sigan funcionando sin cambios: propietario/administrador/gerentes → admin; caja/cocina/personal →
--   bartender; analista → solo lectura de empresa.
-- * Toda acción deja una fila en la auditoría (solo inserción). Nunca se registran tokens ni contraseñas.

-- ---------------------------------------------------------------------------
-- Ayudas de validación de entrada
-- ---------------------------------------------------------------------------

create function private.in_text(j jsonb,k text,p_max integer default 200,p_required boolean default false) returns text
 language plpgsql immutable set search_path='' as $$
declare v text:=nullif(btrim(coalesce(j->>k,'')),'');
begin
 if v is null and p_required then raise exception 'INVALID_INPUT'; end if;
 if v is not null and length(v)>p_max then raise exception 'INVALID_INPUT'; end if;
 return v;
end $$;

create function private.in_uuid(j jsonb,k text,p_required boolean default true) returns uuid language plpgsql immutable set search_path='' as $$
declare v text:=nullif(j->>k,'');
begin
 if v is null then
  if p_required then raise exception 'INVALID_INPUT'; end if;
  return null;
 end if;
 return v::uuid;
exception when invalid_text_representation then raise exception 'INVALID_INPUT';
end $$;

create function private.in_uuids(j jsonb,k text) returns uuid[] language plpgsql immutable set search_path='' as $$
declare out uuid[];
begin
 if j->k is null or jsonb_typeof(j->k)='null' then return null; end if;
 if jsonb_typeof(j->k)<>'array' or jsonb_array_length(j->k)>50 then raise exception 'INVALID_INPUT'; end if;
 select array_agg(x::uuid) into out from jsonb_array_elements_text(j->k) x;
 return out;
exception when invalid_text_representation then raise exception 'INVALID_INPUT';
end $$;

create function private.in_email(j jsonb,k text,p_required boolean default true) returns text language plpgsql immutable set search_path='' as $$
declare v text:=lower(nullif(btrim(coalesce(j->>k,'')),''));
begin
 if v is null then
  if p_required then raise exception 'INVALID_EMAIL'; end if;
  return null;
 end if;
 if length(v)>200 or v !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'INVALID_EMAIL'; end if;
 return v;
end $$;

create function private.in_hash(j jsonb,k text) returns text language plpgsql immutable set search_path='' as $$
declare v text:=lower(coalesce(j->>k,''));
begin
 if v !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_INPUT'; end if;
 return v;
end $$;

create function private.in_int(j jsonb,k text,p_min integer,p_max integer,p_default integer default null) returns integer language plpgsql immutable set search_path='' as $$
declare v integer;
begin
 if j->>k is null or j->>k='' then
  if p_default is null then raise exception 'INVALID_INPUT'; end if;
  return p_default;
 end if;
 v:=(j->>k)::integer;
 if v<p_min or v>p_max then raise exception 'INVALID_INPUT'; end if;
 return v;
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'INVALID_INPUT';
end $$;

-- Modalidades de servicio: consumo en el local, retiro y entrega a domicilio (zonas, tarifa y pedido mínimo).
create function private.valid_service_modes(m jsonb) returns boolean language plpgsql immutable set search_path='' as $$
begin
 return jsonb_typeof(m)='object'
  and jsonb_typeof(m->'dine_in')='boolean' and jsonb_typeof(m->'pickup')='boolean'
  and jsonb_typeof(m->'delivery')='object' and jsonb_typeof(m->'delivery'->'enabled')='boolean'
  and jsonb_typeof(coalesce(m->'delivery'->'zones','[]'::jsonb))='array' and jsonb_array_length(coalesce(m->'delivery'->'zones','[]'::jsonb))<=50
  and coalesce((m->'delivery'->>'fee_minor')::integer,0) between 0 and 100000000
  and coalesce((m->'delivery'->>'min_order_minor')::integer,0) between 0 and 100000000
  and ((m->'dine_in')::text='true' or (m->'pickup')::text='true' or (m->'delivery'->'enabled')::text='true');
exception when others then return false;
end $$;

-- Refleja la membresía de empresa en `memberships` (modelo operativo existente). No toca filas con rol `onza`.
create function private.sync_legacy_membership(p_org uuid,p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare m public.org_memberships; legacy text;
begin
 select * into m from public.org_memberships where organization_id=p_org and user_id=p_user;
 delete from public.memberships lm using public.venues v
  where lm.user_id=p_user and lm.venue_id=v.id and v.organization_id=p_org and lm.role in ('admin','bartender');
 if m.id is null or m.status<>'active' then return; end if;
 legacy:=case when m.role in ('owner','admin','venue_manager','ops_manager') then 'admin' when m.role in ('cashier','kitchen','staff') then 'bartender' else null end;
 if legacy is null then return; end if;
 insert into public.memberships(user_id,venue_id,role)
 select p_user,v.id,legacy from public.venues v where v.organization_id=p_org and (m.venue_ids is null or v.id=any(m.venue_ids))
 on conflict(user_id,venue_id) do update set role=excluded.role where public.memberships.role<>'onza';
end $$;

create function private.sync_org_members(p_org uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 for u in select user_id from public.org_memberships where organization_id=p_org loop perform private.sync_legacy_membership(p_org,u); end loop;
end $$;

-- La comprobación de operador es lo PRIMERO que se evalúa en cada función del panel (incluso antes de validar la entrada):
-- una cuenta ajena recibe NOT_FOUND con cualquier argumento, y nunca un error de validación que delate la función.
create function private.gate(p_sensitive boolean) returns boolean language plpgsql stable security definer set search_path='' as $$
begin perform private.require_platform(p_sensitive); return true; end $$;

-- ---------------------------------------------------------------------------
-- PLATAFORMA: lecturas (sin segundo factor)
-- ---------------------------------------------------------------------------

create function public.platform_overview(input jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare _gate boolean:=private.gate(false); d_to date; d_from date;
begin
 perform private.require_platform(false);
 d_to:=coalesce(nullif(input->>'to','')::date,(now() at time zone 'America/Costa_Rica')::date);
 d_from:=coalesce(nullif(input->>'from','')::date,d_to-29);
 if d_to<d_from or d_to-d_from>366 then raise exception 'INVALID_INPUT'; end if;
 return jsonb_build_object(
  'period',jsonb_build_object('from',d_from,'to',d_to),
  'organizations',jsonb_build_object('total',(select count(*) from public.organizations),
    'active',(select count(*) from public.organizations where status='active'),
    'suspended',(select count(*) from public.organizations where status='suspended'),
    'closed',(select count(*) from public.organizations where status='closed'),
    'demo',(select count(*) from public.organizations where is_demo)),
  'venues',jsonb_build_object('total',(select count(*) from public.venues),
    'published',(select count(*) from public.venues where publication_status='published' and suspended_at is null),
    'draft',(select count(*) from public.venues where publication_status='draft'),
    'archived',(select count(*) from public.venues where publication_status='archived'),
    'suspended',(select count(*) from public.venues where suspended_at is not null),
    'listed',(select count(*) from public.venues where demo_listed and publication_status='published' and suspended_at is null),
    'without_organization',(select count(*) from public.venues where organization_id is null)),
  'orders',jsonb_build_object('count',(select count(*) from public.orders where business_date between d_from and d_to),
    'delivered',(select count(*) from public.orders where status='delivered' and business_date between d_from and d_to),
    'total_minor',coalesce((select sum(total_minor) from public.orders where status='delivered' and business_date between d_from and d_to),0)),
  'by_day',coalesce((select jsonb_agg(jsonb_build_object('day',g::date,'orders',coalesce(c.n,0),'total_minor',coalesce(c.t,0)) order by g)
    from generate_series(d_from,d_to,interval '1 day') g
    left join (select business_date d,count(*) n,sum(total_minor) filter (where status='delivered') t from public.orders
               where business_date between d_from and d_to group by 1) c on c.d=g::date),'[]'::jsonb),
  'by_organization',coalesce((select jsonb_agg(r order by (r->>'orders')::int desc,r->>'name') from (
    select jsonb_build_object('organization_id',o.id,'name',o.name,'status',o.status,'venues',count(distinct v.id),
      'orders',count(od.id),'total_minor',coalesce(sum(od.total_minor) filter (where od.status='delivered'),0)) r
    from public.organizations o left join public.venues v on v.organization_id=o.id
    left join public.orders od on od.venue_id=v.id and od.business_date between d_from and d_to
    group by o.id order by count(od.id) desc limit 100) x),'[]'::jsonb));
end $$;

create function public.platform_orgs_list(input jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare _gate boolean:=private.gate(false); st text:=nullif(input->>'status',''); demo text:=nullif(input->>'demo',''); q text:=nullif(btrim(coalesce(input->>'q','')),'');
 lim integer:=least(greatest(coalesce(nullif(input->>'limit','')::integer,50),1),200); off integer:=greatest(coalesce(nullif(input->>'offset','')::integer,0),0);
begin
 perform private.require_platform(false);
 if st is not null and st not in ('active','suspended','closed') then raise exception 'INVALID_INPUT'; end if;
 return jsonb_build_object('total',(select count(*) from public.organizations o where (st is null or o.status=st) and (demo is null or o.is_demo=(demo='true'))
     and (q is null or o.name ilike '%'||q||'%' or o.slug ilike '%'||q||'%' or o.legal_name ilike '%'||q||'%')),
  'items',coalesce((select jsonb_agg(r order by r->>'created_at' desc) from (
   select jsonb_build_object('id',o.id,'name',o.name,'slug',o.slug,'legal_name',o.legal_name,'country',o.country,'plan',o.plan,'status',o.status,'is_demo',o.is_demo,
     'created_at',o.created_at,'venues',(select count(*) from public.venues v where v.organization_id=o.id),
     'members',(select count(*) from public.org_memberships m where m.organization_id=o.id),
     'orders_30d',(select count(*) from public.orders od join public.venues v on v.id=od.venue_id where v.organization_id=o.id and od.created_at>now()-interval '30 days')) r
   from public.organizations o where (st is null or o.status=st) and (demo is null or o.is_demo=(demo='true'))
     and (q is null or o.name ilike '%'||q||'%' or o.slug ilike '%'||q||'%' or o.legal_name ilike '%'||q||'%')
   order by o.created_at desc limit lim offset off) x),'[]'::jsonb));
end $$;

create function public.platform_org_get(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare _gate boolean:=private.gate(false); org public.organizations;
begin
 perform private.require_platform(false);
 select * into org from public.organizations where id=p_id;
 if not found then raise exception 'NOT_FOUND'; end if;
 return jsonb_build_object('organization',to_jsonb(org),
  'venues',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'slug',v.slug,'zone',v.zone,'publication_status',v.publication_status,
     'suspended',v.suspended_at is not null,'directory_visible',v.demo_listed) order by v.name) from public.venues v where v.organization_id=p_id),'[]'::jsonb),
  'members',coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'email',u.email,'role',m.role,'status',m.status,'venue_ids',m.venue_ids) order by m.created_at)
     from public.org_memberships m left join auth.users u on u.id=m.user_id where m.organization_id=p_id),'[]'::jsonb),
  'invitations',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'role',i.role,'venue_ids',i.venue_ids,'expires_at',i.expires_at,
     'state',case when i.accepted_at is not null then 'accepted' when i.revoked_at is not null then 'revoked' when i.expires_at<=now() then 'expired' else 'pending' end) order by i.created_at desc)
     from public.org_invitations i where i.organization_id=p_id),'[]'::jsonb),
  'recent_orders',coalesce((select jsonb_agg(jsonb_build_object('code',o.public_code,'status',o.status,'total_minor',o.total_minor,'venue',v.name,'created_at',o.created_at) order by o.created_at desc)
     from (select od.* from public.orders od join public.venues vv on vv.id=od.venue_id where vv.organization_id=p_id order by od.created_at desc limit 10) o join public.venues v on v.id=o.venue_id),'[]'::jsonb),
  'inventory',jsonb_build_object('products',(select count(*) from public.products pr join public.venues v on v.id=pr.venue_id where v.organization_id=p_id and not pr.archived),
     'categories',(select count(*) from public.categories c join public.venues v on v.id=c.venue_id where v.organization_id=p_id)));
end $$;

-- Inventario de productos de una empresa (la aplicación lo exporta a CSV).
create function public.platform_org_inventory(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_platform(false);
 if not exists(select 1 from public.organizations where id=p_id) then raise exception 'NOT_FOUND'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('venue',v.name,'category',c.label,'product',pr.name,'price_minor',pr.price_minor,'available',pr.available,'archived',pr.archived) order by v.name,c.position,pr.name)
  from public.products pr join public.venues v on v.id=pr.venue_id join public.categories c on c.id=pr.category_id where v.organization_id=p_id),'[]'::jsonb);
end $$;

create function public.platform_venues_list(input jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare _gate boolean:=private.gate(false); f text:=nullif(input->>'filter',''); org uuid:=private.in_uuid(input,'organizationId',false); q text:=nullif(btrim(coalesce(input->>'q','')),'');
 lim integer:=least(greatest(coalesce(nullif(input->>'limit','')::integer,50),1),200); off integer:=greatest(coalesce(nullif(input->>'offset','')::integer,0),0);
begin
 perform private.require_platform(false);
 if f is not null and f not in ('published','directory','pending','suspended','archived') then raise exception 'INVALID_INPUT'; end if;
 return jsonb_build_object('items',coalesce((select jsonb_agg(r order by r->>'name') from (
   select jsonb_build_object('id',v.id,'name',v.name,'slug',v.slug,'zone',v.zone,'organization_id',v.organization_id,'organization',o.name,
    'publication_status',v.publication_status,'suspended',v.suspended_at is not null,'directory_visible',v.demo_listed,'open_state',v.open_state,'paused',v.paused) r
   from public.venues v left join public.organizations o on o.id=v.organization_id
   where (org is null or v.organization_id=org) and (q is null or v.name ilike '%'||q||'%' or v.slug ilike '%'||q||'%')
    and (f is null
      or (f='published' and v.publication_status='published' and v.suspended_at is null)
      or (f='directory' and v.demo_listed and v.publication_status='published' and v.suspended_at is null)
      or (f='pending' and v.publication_status='draft')
      or (f='suspended' and v.suspended_at is not null)
      or (f='archived' and v.publication_status='archived'))
   order by v.name limit lim offset off) x),'[]'::jsonb));
end $$;

create function public.platform_venue_get(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare _gate boolean:=private.gate(false); v public.venues;
begin
 perform private.require_platform(false);
 select * into v from public.venues where id=p_id;
 if not found then raise exception 'NOT_FOUND'; end if;
 return jsonb_build_object('venue',to_jsonb(v),
  'organization',(select jsonb_build_object('id',o.id,'name',o.name,'slug',o.slug,'status',o.status) from public.organizations o where o.id=v.organization_id),
  'activity_30d',coalesce((select jsonb_agg(jsonb_build_object('day',g::date,'orders',coalesce(c.n,0)) order by g)
    from generate_series((now() at time zone 'America/Costa_Rica')::date-29,(now() at time zone 'America/Costa_Rica')::date,interval '1 day') g
    left join (select business_date d,count(*) n from public.orders where venue_id=p_id group by 1) c on c.d=g::date),'[]'::jsonb),
  'staff',coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'email',u.email,'role',m.role,'status',m.status) order by m.created_at)
    from public.org_memberships m left join auth.users u on u.id=m.user_id
    where m.organization_id=v.organization_id and (m.venue_ids is null or p_id=any(m.venue_ids))),'[]'::jsonb),
  'menu_link','/v/'||v.slug,
  'spots',(select count(*) from public.delivery_spots s where s.venue_id=p_id));
end $$;

-- Menú de un local (lectura). La edición del menú y del plano usa el administrador del propio local.
create function public.platform_venue_menu(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_platform(false);
 if not exists(select 1 from public.venues where id=p_id) then raise exception 'NOT_FOUND'; end if;
 return jsonb_build_object(
  'categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'label',c.label,'position',c.position) order by c.position,c.label) from public.categories c where c.venue_id=p_id),'[]'::jsonb),
  'products',coalesce((select jsonb_agg(jsonb_build_object('id',pr.id,'category_id',pr.category_id,'name',pr.name,'price_minor',pr.price_minor,'available',pr.available,'archived',pr.archived) order by pr.name)
    from public.products pr where pr.venue_id=p_id),'[]'::jsonb),
  'map',(select to_jsonb(m)-'id' from public.venue_maps m where m.venue_id=p_id limit 1),
  'spots',coalesce((select jsonb_agg(to_jsonb(s)) from (select * from public.delivery_spots where venue_id=p_id order by 1 limit 300) s),'[]'::jsonb));
end $$;

create function public.platform_users_list(input jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare _gate boolean:=private.gate(false); kind text:=coalesce(nullif(input->>'kind',''),'members'); q text:=nullif(btrim(coalesce(input->>'q','')),'');
 lim integer:=least(greatest(coalesce(nullif(input->>'limit','')::integer,50),1),200);
begin
 perform private.require_platform(false);
 if kind not in ('members','consumers','operators') then raise exception 'INVALID_INPUT'; end if;
 if kind='operators' then
  return jsonb_build_object('kind',kind,'items',coalesce((select jsonb_agg(jsonb_build_object('email',o.email,'role',o.role,'since',o.created_at)) from private.platform_operators o),'[]'::jsonb));
 elsif kind='members' then
  return jsonb_build_object('kind',kind,'items',coalesce((select jsonb_agg(r order by r->>'email') from (
    select jsonb_build_object('user_id',m.user_id,'email',u.email,'organization_id',m.organization_id,'organization',o.name,'role',m.role,'status',m.status,'venue_ids',m.venue_ids) r
    from public.org_memberships m join public.organizations o on o.id=m.organization_id left join auth.users u on u.id=m.user_id
    where q is null or u.email ilike '%'||q||'%' or o.name ilike '%'||q||'%' order by u.email limit lim) x),'[]'::jsonb));
 end if;
 return jsonb_build_object('kind',kind,'items',coalesce((select jsonb_agg(r order by r->>'email') from (
   select jsonb_build_object('user_id',p.user_id,'email',u.email,'username',p.username,'name',p.full_name,'since',p.onboarded_at) r
   from public.profiles p left join auth.users u on u.id=p.user_id
   where q is null or u.email ilike '%'||q||'%' or p.username ilike '%'||q||'%' order by u.email limit lim) x),'[]'::jsonb));
end $$;

create function public.platform_audit_list(input jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare _gate boolean:=private.gate(false); org uuid:=private.in_uuid(input,'organizationId',false); act text:=nullif(btrim(coalesce(input->>'action','')),'');
 lim integer:=least(greatest(coalesce(nullif(input->>'limit','')::integer,100),1),500); before timestamptz:=nullif(input->>'before','')::timestamptz;
begin
 perform private.require_platform(false);
 return coalesce((select jsonb_agg(to_jsonb(a) order by a.at desc) from (
   select id,at,actor_email,organization_id,venue_id,action,entity,entity_id,details,request_id,ip from public.platform_audit
   where (org is null or organization_id=org) and (act is null or action ilike act||'%') and (before is null or at<before) order by at desc limit lim) a),'[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- PLATAFORMA: acciones (exigen segundo factor reciente)
-- ---------------------------------------------------------------------------

-- Crea empresa, local (borrador) e invitación del propietario en UNA transacción. Nada se publica solo.
create function public.platform_onboard(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare _gate boolean:=private.gate(true); o jsonb:=coalesce(input->'organization','{}'); v jsonb:=coalesce(input->'venue','{}'); w jsonb:=coalesce(input->'owner','{}');
 meta jsonb:=coalesce(input->'meta','{}'); org public.organizations; ven public.venues; inv public.org_invitations;
begin
 perform private.require_platform(true);
 insert into public.organizations(name,slug,legal_name,tax_id,country,currency,contact_name,contact_email,contact_phone,notes,plan,features,is_demo,created_by)
 values(private.in_text(o,'name',120,true),private.in_text(o,'slug',60,true),coalesce(private.in_text(o,'legal_name',160),''),coalesce(private.in_text(o,'tax_id',40),''),
  coalesce(private.in_text(o,'country',2),'CR'),coalesce(private.in_text(o,'currency',3),'CRC'),private.in_text(o,'contact_name',120),private.in_email(o,'contact_email',false),
  private.in_text(o,'contact_phone',20),coalesce(private.in_text(o,'notes',2000),''),coalesce(private.in_text(o,'plan',20),'free'),coalesce(o->'features','{}'),
  coalesce((o->>'is_demo')::boolean,false),auth.uid()) returning * into org;
 insert into private.organization_secrets(organization_id) values(org.id);
 insert into public.venues(slug,name,zone,organization_id,publication_status,demo_listed)
 values(private.in_text(v,'slug',100,true),private.in_text(v,'name',100,true),coalesce(private.in_text(v,'zone',100),''),org.id,'draft',false) returning * into ven;
 insert into public.org_invitations(organization_id,email,role,token_hash,created_by)
 values(org.id,private.in_email(w,'email'),'owner',private.in_hash(w,'tokenHash'),auth.uid()) returning * into inv;
 perform private.audit('organization.onboard','organization',org.id::text,org.id,ven.id,
  jsonb_build_object('slug',org.slug,'venue_slug',ven.slug,'owner_email',inv.email,'is_demo',org.is_demo),meta);
 return jsonb_build_object('organization_id',org.id,'venue_id',ven.id,'invitation_id',inv.id,'expires_at',inv.expires_at,'menu_path','/v/'||ven.slug);
exception when unique_violation then raise exception 'SLUG_TAKEN';
 when check_violation or invalid_text_representation or not_null_violation or string_data_right_truncation or numeric_value_out_of_range then raise exception 'INVALID_INPUT';
end $$;

create function public.platform_org_update(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare _gate boolean:=private.gate(true); v_id uuid:=private.in_uuid(input,'id'); meta jsonb:=coalesce(input->'meta','{}'); v jsonb:=coalesce(input->'values','{}'); before jsonb; org public.organizations;
begin
 perform private.require_platform(true);
 select to_jsonb(o) into before from public.organizations o where o.id=v_id;
 if before is null then raise exception 'NOT_FOUND'; end if;
 update public.organizations set
  name=coalesce(private.in_text(v,'name',120),name),legal_name=case when v ? 'legal_name' then coalesce(private.in_text(v,'legal_name',160),'') else legal_name end,
  tax_id=case when v ? 'tax_id' then coalesce(private.in_text(v,'tax_id',40),'') else tax_id end,country=coalesce(private.in_text(v,'country',2),country),
  currency=coalesce(private.in_text(v,'currency',3),currency),contact_name=case when v ? 'contact_name' then private.in_text(v,'contact_name',120) else contact_name end,
  contact_email=case when v ? 'contact_email' then private.in_email(v,'contact_email',false) else contact_email end,
  contact_phone=case when v ? 'contact_phone' then private.in_text(v,'contact_phone',20) else contact_phone end,
  notes=case when v ? 'notes' then coalesce(private.in_text(v,'notes',2000),'') else notes end,plan=coalesce(private.in_text(v,'plan',20),plan),
  features=case when v ? 'features' and jsonb_typeof(v->'features')='object' then v->'features' else features end,
  is_demo=coalesce((v->>'is_demo')::boolean,is_demo),updated_at=now()
 where organizations.id=v_id returning * into org;
 perform private.audit('organization.update','organization',v_id::text,v_id,null,jsonb_build_object('fields',(select coalesce(jsonb_agg(k),'[]'::jsonb) from jsonb_object_keys(v) k)),meta);
 return to_jsonb(org);
exception when unique_violation then raise exception 'SLUG_TAKEN';
 when check_violation or invalid_text_representation or not_null_violation or string_data_right_truncation then raise exception 'INVALID_INPUT';
end $$;

create function public.platform_org_set_status(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare _gate boolean:=private.gate(true); v_id uuid:=private.in_uuid(input,'id'); st text:=input->>'status'; reason text:=private.in_text(input,'reason',300); meta jsonb:=coalesce(input->'meta','{}'); org public.organizations; prev text;
begin
 perform private.require_platform(true);
 if st not in ('active','suspended','closed') then raise exception 'INVALID_INPUT'; end if;
 if st<>'active' and (reason is null or length(reason)<5) then raise exception 'REASON_REQUIRED'; end if;
 select status into prev from public.organizations where organizations.id=v_id for update;
 if prev is null then raise exception 'NOT_FOUND'; end if;
 update public.organizations set status=st,status_reason=case when st='active' then null else reason end,status_changed_at=now(),updated_at=now() where organizations.id=v_id returning * into org;
 perform private.audit('organization.status','organization',v_id::text,v_id,null,jsonb_build_object('from',prev,'to',st,'reason',reason),meta);
 return jsonb_build_object('id',v_id,'status',st,'previous',prev);
end $$;

-- Eliminar: solo una empresa cerrada y sin locales (los locales se eliminan o archivan antes).
create function public.platform_org_delete(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare _gate boolean:=private.gate(true); v_id uuid:=private.in_uuid(input,'id'); org public.organizations; meta jsonb:=coalesce(input->'meta','{}');
begin
 perform private.require_platform(true);
 select * into org from public.organizations where organizations.id=v_id for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if input->>'confirmSlug' is distinct from org.slug then raise exception 'CONFIRMATION_REQUIRED'; end if;
 if org.status<>'closed' then raise exception 'ORGANIZATION_NOT_CLOSED'; end if;
 if exists(select 1 from public.venues where organization_id=v_id) then raise exception 'ORGANIZATION_HAS_VENUES'; end if;
 delete from public.organizations where organizations.id=v_id;
 perform private.audit('organization.delete','organization',v_id::text,null,null,jsonb_build_object('slug',org.slug,'name',org.name),meta);
 return jsonb_build_object('id',v_id,'deleted',true);
end $$;

create function public.platform_venue_create(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare _gate boolean:=private.gate(true); org uuid:=private.in_uuid(input,'organizationId'); meta jsonb:=coalesce(input->'meta','{}'); ven public.venues;
begin
 perform private.require_platform(true);
 if not exists(select 1 from public.organizations where id=org and status<>'closed') then raise exception 'ORGANIZATION_NOT_ACTIVE'; end if;
 insert into public.venues(slug,name,zone,organization_id,publication_status,demo_listed)
 values(private.in_text(input,'slug',100,true),private.in_text(input,'name',100,true),coalesce(private.in_text(input,'zone',100),''),org,'draft',false) returning * into ven;
 perform private.sync_org_members(org);
 perform private.audit('venue.create','venue',ven.id::text,org,ven.id,jsonb_build_object('slug',ven.slug),meta);
 return jsonb_build_object('venue_id',ven.id,'menu_path','/v/'||ven.slug);
exception when unique_violation then raise exception 'SLUG_TAKEN';
 when check_violation or invalid_text_representation or not_null_violation or string_data_right_truncation then raise exception 'INVALID_INPUT';
end $$;

create function public.platform_venue_update(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare _gate boolean:=private.gate(true); v_id uuid:=private.in_uuid(input,'id'); v jsonb:=coalesce(input->'values','{}'); meta jsonb:=coalesce(input->'meta','{}'); ven public.venues;
begin
 perform private.require_platform(true);
 if v ? 'service_modes' and not private.valid_service_modes(v->'service_modes') then raise exception 'INVALID_INPUT'; end if;
 update public.venues set
  name=coalesce(private.in_text(v,'name',100),name),zone=case when v ? 'zone' then coalesce(private.in_text(v,'zone',100),'') else zone end,
  hours=case when v ? 'hours' then coalesce(private.in_text(v,'hours',300),'Consultar al local') else hours end,
  eta_minutes=case when v ? 'eta_minutes' then private.in_int(v,'eta_minutes',1,120) else eta_minutes end,
  brand_color=case when v ? 'brand_color' then private.in_text(v,'brand_color',7) else brand_color end,
  service_modes=case when v ? 'service_modes' then v->'service_modes' else service_modes end,
  demo_listed=coalesce((v->>'directory_visible')::boolean,demo_listed)
 where venues.id=v_id returning * into ven;
 if not found then raise exception 'NOT_FOUND'; end if;
 perform private.audit('venue.update','venue',v_id::text,ven.organization_id,v_id,jsonb_build_object('fields',(select coalesce(jsonb_agg(k),'[]'::jsonb) from jsonb_object_keys(v) k)),meta);
 return jsonb_build_object('id',v_id,'updated',true);
exception when check_violation or invalid_text_representation or not_null_violation or string_data_right_truncation then raise exception 'INVALID_INPUT';
end $$;

-- Publicar, suspender y archivar. La suspensión solo la aplica el superadministrador.
create function public.platform_venue_set_status(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare _gate boolean:=private.gate(true); v_id uuid:=private.in_uuid(input,'id'); act text:=input->>'action'; reason text:=private.in_text(input,'reason',300); meta jsonb:=coalesce(input->'meta','{}'); ven public.venues;
begin
 perform private.require_platform(true);
 select * into ven from public.venues where venues.id=v_id for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if act='publish' then
  if ven.organization_id is not null and not private.org_active(ven.organization_id) then raise exception 'ORGANIZATION_NOT_ACTIVE'; end if;
  update public.venues set publication_status='published' where venues.id=v_id;
 elsif act='archive' then update public.venues set publication_status='archived' where venues.id=v_id;
 elsif act='unarchive' then update public.venues set publication_status='draft' where venues.id=v_id;
 elsif act='suspend' then
  if reason is null or length(reason)<5 then raise exception 'REASON_REQUIRED'; end if;
  update public.venues set suspended_at=now(),suspended_reason=reason,suspended_by=auth.uid() where venues.id=v_id;
 elsif act='unsuspend' then update public.venues set suspended_at=null,suspended_reason=null,suspended_by=null where venues.id=v_id;
 else raise exception 'INVALID_INPUT'; end if;
 perform private.audit('venue.'||act,'venue',v_id::text,ven.organization_id,v_id,jsonb_build_object('reason',reason,'from',ven.publication_status),meta);
 return jsonb_build_object('id',v_id,'action',act);
end $$;

-- Eliminar un local sin pedidos ni datos dependientes (si hay pedidos u otros datos, VENUE_HAS_DATA y no se toca nada).
create function public.platform_venue_delete(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare _gate boolean:=private.gate(true); v_id uuid:=private.in_uuid(input,'id'); ven public.venues; meta jsonb:=coalesce(input->'meta','{}');
begin
 perform private.require_platform(true);
 select * into ven from public.venues where venues.id=v_id for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if input->>'confirmSlug' is distinct from ven.slug then raise exception 'CONFIRMATION_REQUIRED'; end if;
 if ven.publication_status<>'archived' then raise exception 'VENUE_NOT_ARCHIVED'; end if;
 if exists(select 1 from public.orders where venue_id=v_id) then raise exception 'VENUE_HAS_DATA'; end if;
 begin
  delete from public.products where venue_id=v_id;
  delete from public.categories where venue_id=v_id;
  delete from public.delivery_spots where venue_id=v_id;
  delete from public.venue_maps where venue_id=v_id;
  delete from public.memberships where venue_id=v_id and role in ('admin','bartender');
  update public.org_memberships set venue_ids=array_remove(venue_ids,v_id) where venue_ids is not null and v_id=any(venue_ids) and cardinality(array_remove(venue_ids,v_id))>=1;
  delete from public.org_memberships where venue_ids is not null and cardinality(array_remove(venue_ids,v_id))=0 and v_id=any(venue_ids);
  delete from public.venues where venues.id=v_id;
 exception when foreign_key_violation then raise exception 'VENUE_HAS_DATA';
 end;
 perform private.audit('venue.delete','venue',v_id::text,ven.organization_id,null,jsonb_build_object('slug',ven.slug,'name',ven.name),meta);
 return jsonb_build_object('id',v_id,'deleted',true);
end $$;

create function public.platform_invitation_create(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare _gate boolean:=private.gate(true); org uuid:=private.in_uuid(input,'organizationId'); meta jsonb:=coalesce(input->'meta','{}'); inv public.org_invitations;
begin
 perform private.require_platform(true);
 if not exists(select 1 from public.organizations where id=org and status<>'closed') then raise exception 'ORGANIZATION_NOT_ACTIVE'; end if;
 insert into public.org_invitations(organization_id,email,role,venue_ids,token_hash,created_by)
 values(org,private.in_email(input,'email'),coalesce(input->>'role',''),private.in_uuids(input,'venueIds'),private.in_hash(input,'tokenHash'),auth.uid()) returning * into inv;
 perform private.audit('invitation.create','invitation',inv.id::text,org,null,jsonb_build_object('email',inv.email,'role',inv.role),meta);
 return jsonb_build_object('id',inv.id,'expires_at',inv.expires_at);
exception when unique_violation then raise exception 'INVITATION_EXISTS';
 when check_violation or invalid_text_representation or not_null_violation then raise exception 'INVALID_INPUT';
end $$;

create function public.platform_invitation_revoke(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare _gate boolean:=private.gate(true); v_id uuid:=private.in_uuid(input,'id'); meta jsonb:=coalesce(input->'meta','{}'); inv public.org_invitations;
begin
 perform private.require_platform(true);
 update public.org_invitations set revoked_at=now() where org_invitations.id=v_id and accepted_at is null and revoked_at is null returning * into inv;
 if not found then raise exception 'NOT_FOUND'; end if;
 perform private.audit('invitation.revoke','invitation',v_id::text,inv.organization_id,null,jsonb_build_object('email',inv.email),meta);
 return jsonb_build_object('id',v_id,'revoked',true);
end $$;

-- Usuarios: la acción de suspender o eliminar la ejecuta el proveedor de autenticación desde el servidor; la base la autoriza
-- (nunca sobre un operador), refleja el estado de la membresía y la registra en la auditoría.
create function public.platform_user_target(p_user uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare _gate boolean:=private.gate(true); v_email text; v_kind text;
begin
 perform private.require_platform(true);
 select u.email into v_email from auth.users u where u.id=p_user;
 if v_email is null then raise exception 'NOT_FOUND'; end if;
 if exists(select 1 from private.platform_operators o where o.email=lower(v_email)) then raise exception 'OPERATOR_PROTECTED'; end if;
 v_kind:=case when exists(select 1 from public.org_memberships m where m.user_id=p_user) then 'member' when exists(select 1 from public.profiles p where p.user_id=p_user) then 'consumer' else 'other' end;
 return jsonb_build_object('user_id',p_user,'email',v_email,'kind',v_kind);
end $$;

create function public.platform_user_record(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare _gate boolean:=private.gate(true); uid uuid:=private.in_uuid(input,'userId'); act text:=input->>'action'; meta jsonb:=coalesce(input->'meta','{}'); target jsonb; org uuid;
begin
 perform private.require_platform(true);
 if act not in ('suspend','unsuspend','delete') then raise exception 'INVALID_INPUT'; end if;
 target:=public.platform_user_target(uid);
 for org in select organization_id from public.org_memberships where user_id=uid loop
  if act in ('suspend','unsuspend') then update public.org_memberships set status=case when act='suspend' then 'suspended' else 'active' end where user_id=uid and organization_id=org; end if;
  if act='delete' then delete from public.org_memberships where user_id=uid and organization_id=org; end if;
  perform private.sync_legacy_membership(org,uid);
 end loop;
 perform private.audit('user.'||act,'user',uid::text,null,null,jsonb_build_object('email',target->>'email','kind',target->>'kind'),meta);
 return jsonb_build_object('user_id',uid,'action',act,'kind',target->>'kind');
end $$;

-- ---------------------------------------------------------------------------
-- EMPRESA
-- ---------------------------------------------------------------------------

create function public.org_my() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'SESSION_REQUIRED'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('organization_id',o.id,'name',o.name,'slug',o.slug,'status',o.status,'role',m.role,'venue_ids',m.venue_ids,
   'venues',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'slug',v.slug,'publication_status',v.publication_status,'suspended',v.suspended_at is not null) order by v.name)
     from public.venues v where v.organization_id=o.id and (m.venue_ids is null or v.id=any(m.venue_ids))),'[]'::jsonb)) order by o.name)
  from public.org_memberships m join public.organizations o on o.id=m.organization_id
  where m.user_id=auth.uid() and m.status='active' and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)),'[]'::jsonb);
end $$;

-- Alcance del que consulta: null = toda la empresa; si no, los locales de su membresía. NOT_FOUND si no es miembro.
create function private.org_scope(p_org uuid,p_roles text[]) returns uuid[] language plpgsql stable security definer set search_path='' as $$
declare m public.org_memberships;
begin
 select * into m from public.org_memberships where organization_id=p_org and user_id=auth.uid() and status='active' and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false);
 if m.id is null or not (m.role=any(p_roles)) then raise exception 'NOT_FOUND'; end if;
 return m.venue_ids;
end $$;

create function public.org_summary(input jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare org uuid:=private.in_uuid(input,'organizationId'); ven uuid:=private.in_uuid(input,'venueId',false); days integer:=private.in_int(input,'days',1,90,7); scope uuid[];
begin
 scope:=private.org_scope(org,array['owner','admin','venue_manager','ops_manager','analyst','cashier']);
 if ven is not null and (scope is not null and not ven=any(scope)) then raise exception 'NOT_FOUND'; end if;
 if ven is not null and not exists(select 1 from public.venues where id=ven and organization_id=org) then raise exception 'NOT_FOUND'; end if;
 return (with v as (select id from public.venues where organization_id=org and (ven is null or id=ven) and (scope is null or id=any(scope))),
  o as (select od.* from public.orders od join v on v.id=od.venue_id where od.business_date>(now() at time zone 'America/Costa_Rica')::date-days)
  select jsonb_build_object('days',days,'venues',(select count(*) from v),'orders',(select count(*) from o),
   'delivered',(select count(*) from o where status='delivered'),'total_minor',coalesce((select sum(total_minor) from o where status='delivered'),0),
   'by_status',coalesce((select jsonb_object_agg(status,n) from (select status,count(*) n from o group by 1) s),'{}'::jsonb),
   'by_day',coalesce((select jsonb_agg(jsonb_build_object('day',d,'orders',n) order by d) from (select business_date d,count(*) n from o group by 1) x),'[]'::jsonb)));
end $$;

-- Clientes que ve la empresa: seudónimo propio de cada empresa, sin correo ni identificador de cuenta.
create function public.org_customers(input jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare org uuid:=private.in_uuid(input,'organizationId'); scope uuid[]; salt text;
begin
 scope:=private.org_scope(org,array['owner','admin','ops_manager','analyst','venue_manager']);
 select customer_salt into salt from private.organization_secrets where organization_id=org;
 if salt is null then return '[]'::jsonb; end if;
 return coalesce((select jsonb_agg(r order by (r->>'total_minor')::bigint desc) from (
  select jsonb_build_object('pseudonym','Cliente-'||upper(substr(encode(sha256(convert_to(salt||':'||od.customer_id::text,'UTF8')),'hex'),1,6)),
   'orders',count(*),'total_minor',coalesce(sum(od.total_minor) filter (where od.status='delivered'),0),'last_order_at',max(od.created_at)) r
  from public.orders od join public.venues v on v.id=od.venue_id
  where v.organization_id=org and (scope is null or v.id=any(scope)) group by od.customer_id order by max(od.created_at) desc limit 500) x),'[]'::jsonb);
end $$;

create function public.org_menu(p_venue uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.org_venue_access(p_venue,array['owner','admin','venue_manager','ops_manager','analyst','cashier','kitchen','staff']) then raise exception 'NOT_FOUND'; end if;
 return jsonb_build_object(
  'categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'label',c.label) order by c.position,c.label) from public.categories c where c.venue_id=p_venue),'[]'::jsonb),
  'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'category_id',p.category_id,'name',p.name,'price_minor',p.price_minor,'available',p.available) order by p.name) from public.products p where p.venue_id=p_venue and not p.archived),'[]'::jsonb));
end $$;

create function public.org_venue_settings_save(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare ven uuid:=private.in_uuid(input,'venueId'); v jsonb:=coalesce(input->'values','{}'); meta jsonb:=coalesce(input->'meta','{}'); org uuid;
begin
 select organization_id into org from public.venues where id=ven;
 if org is null or not private.org_venue_access(ven,array['owner','admin','venue_manager','ops_manager']) then raise exception 'NOT_FOUND'; end if;
 if not private.org_active(org) then raise exception 'ORGANIZATION_NOT_ACTIVE'; end if;
 if v ? 'service_modes' and not private.valid_service_modes(v->'service_modes') then raise exception 'INVALID_INPUT'; end if;
 update public.venues set
  hours=case when v ? 'hours' then coalesce(private.in_text(v,'hours',300),'Consultar al local') else hours end,
  eta_minutes=case when v ? 'eta_minutes' then private.in_int(v,'eta_minutes',1,120) else eta_minutes end,
  brand_color=case when v ? 'brand_color' then private.in_text(v,'brand_color',7) else brand_color end,
  service_modes=case when v ? 'service_modes' then v->'service_modes' else service_modes end
 where id=ven;
 perform private.audit('venue.settings','venue',ven::text,org,ven,jsonb_build_object('fields',(select coalesce(jsonb_agg(k),'[]'::jsonb) from jsonb_object_keys(v) k)),meta);
 return jsonb_build_object('id',ven,'updated',true);
exception when check_violation or invalid_text_representation or string_data_right_truncation then raise exception 'INVALID_INPUT';
end $$;

create function public.org_staff_list(p_org uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.org_scope(p_org,array['owner','admin']);
 return jsonb_build_object(
  'members',coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'email',u.email,'role',m.role,'status',m.status,'venue_ids',m.venue_ids,'me',m.user_id=auth.uid()) order by m.created_at)
    from public.org_memberships m left join auth.users u on u.id=m.user_id where m.organization_id=p_org),'[]'::jsonb),
  'invitations',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'role',i.role,'venue_ids',i.venue_ids,'expires_at',i.expires_at,
    'state',case when i.revoked_at is not null then 'revoked' when i.expires_at<=now() then 'expired' else 'pending' end) order by i.created_at desc)
    from public.org_invitations i where i.organization_id=p_org and i.accepted_at is null and i.revoked_at is null),'[]'::jsonb));
end $$;

-- Solo el propietario concede o cambia propietarios y administradores.
create function private.org_can_grant(p_org uuid,p_role text) returns void language plpgsql stable security definer set search_path='' as $$
declare mine text:=private.org_role(p_org);
begin
 if mine is null or mine not in ('owner','admin') then raise exception 'NOT_FOUND'; end if;
 if p_role in ('owner','admin') and mine<>'owner' then raise exception 'NOT_AUTHORIZED'; end if;
end $$;

create function public.org_invitation_create(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=private.in_uuid(input,'organizationId'); role text:=coalesce(input->>'role',''); meta jsonb:=coalesce(input->'meta','{}'); inv public.org_invitations;
begin
 perform private.org_can_grant(org,role);
 if not private.org_active(org) then raise exception 'ORGANIZATION_NOT_ACTIVE'; end if;
 if not private.limit_action('org_invite',30) then raise exception 'RATE_LIMITED'; end if;
 insert into public.org_invitations(organization_id,email,role,venue_ids,token_hash,created_by)
 values(org,private.in_email(input,'email'),role,private.in_uuids(input,'venueIds'),private.in_hash(input,'tokenHash'),auth.uid()) returning * into inv;
 perform private.audit('invitation.create','invitation',inv.id::text,org,null,jsonb_build_object('email',inv.email,'role',inv.role),meta);
 return jsonb_build_object('id',inv.id,'expires_at',inv.expires_at);
exception when unique_violation then raise exception 'INVITATION_EXISTS';
 when check_violation or invalid_text_representation or not_null_violation then raise exception 'INVALID_INPUT';
end $$;

create function public.org_invitation_revoke(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid:=private.in_uuid(input,'id'); meta jsonb:=coalesce(input->'meta','{}'); inv public.org_invitations;
begin
 select * into inv from public.org_invitations where org_invitations.id=v_id and accepted_at is null and revoked_at is null;
 if not found then raise exception 'NOT_FOUND'; end if;
 perform private.org_can_grant(inv.organization_id,inv.role);
 update public.org_invitations set revoked_at=now() where org_invitations.id=v_id;
 perform private.audit('invitation.revoke','invitation',v_id::text,inv.organization_id,null,jsonb_build_object('email',inv.email),meta);
 return jsonb_build_object('id',v_id,'revoked',true);
end $$;

-- Reenviar = nuevo token (nuevo hash) y nuevo plazo de 7 días para la misma invitación pendiente.
create function public.org_invitation_resend(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid:=private.in_uuid(input,'id'); meta jsonb:=coalesce(input->'meta','{}'); inv public.org_invitations;
begin
 select * into inv from public.org_invitations where org_invitations.id=v_id and accepted_at is null and revoked_at is null;
 if not found then raise exception 'NOT_FOUND'; end if;
 perform private.org_can_grant(inv.organization_id,inv.role);
 if not private.org_active(inv.organization_id) then raise exception 'ORGANIZATION_NOT_ACTIVE'; end if;
 update public.org_invitations set token_hash=private.in_hash(input,'tokenHash'),expires_at=now()+interval '7 days' where org_invitations.id=v_id returning * into inv;
 perform private.audit('invitation.resend','invitation',v_id::text,inv.organization_id,null,jsonb_build_object('email',inv.email),meta);
 return jsonb_build_object('id',v_id,'expires_at',inv.expires_at);
exception when unique_violation then raise exception 'INVALID_INPUT';
end $$;

create function public.org_member_set(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=private.in_uuid(input,'organizationId'); uid uuid:=private.in_uuid(input,'userId'); new_role text:=coalesce(input->>'role',''); meta jsonb:=coalesce(input->'meta','{}'); cur public.org_memberships; owners integer;
begin
 select * into cur from public.org_memberships where organization_id=org and user_id=uid;
 if cur.id is null then raise exception 'NOT_FOUND'; end if;
 perform private.org_can_grant(org,new_role);
 perform private.org_can_grant(org,cur.role);
 if not private.org_active(org) then raise exception 'ORGANIZATION_NOT_ACTIVE'; end if;
 if uid=auth.uid() then raise exception 'SELF_CHANGE'; end if;
 if cur.role='owner' and new_role<>'owner' then
  select count(*) into owners from public.org_memberships where organization_id=org and role='owner' and status='active';
  if owners<=1 then raise exception 'LAST_OWNER'; end if;
 end if;
 update public.org_memberships set role=new_role,venue_ids=private.in_uuids(input,'venueIds') where organization_id=org and user_id=uid;
 perform private.sync_legacy_membership(org,uid);
 perform private.audit('member.update','member',uid::text,org,null,jsonb_build_object('from',cur.role,'to',new_role),meta);
 return jsonb_build_object('user_id',uid,'role',new_role);
exception when check_violation or invalid_text_representation then raise exception 'INVALID_INPUT';
end $$;

create function public.org_member_remove(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=private.in_uuid(input,'organizationId'); uid uuid:=private.in_uuid(input,'userId'); meta jsonb:=coalesce(input->'meta','{}'); cur public.org_memberships; owners integer;
begin
 select * into cur from public.org_memberships where organization_id=org and user_id=uid;
 if cur.id is null then raise exception 'NOT_FOUND'; end if;
 perform private.org_can_grant(org,cur.role);
 if uid=auth.uid() then raise exception 'SELF_CHANGE'; end if;
 if cur.role='owner' then
  select count(*) into owners from public.org_memberships where organization_id=org and role='owner' and status='active';
  if owners<=1 then raise exception 'LAST_OWNER'; end if;
 end if;
 delete from public.org_memberships where organization_id=org and user_id=uid;
 perform private.sync_legacy_membership(org,uid);
 perform private.audit('member.remove','member',uid::text,org,null,jsonb_build_object('role',cur.role),meta);
 return jsonb_build_object('user_id',uid,'removed',true);
end $$;

-- ---------------------------------------------------------------------------
-- Invitaciones: ver y aceptar (de un solo uso, con el mismo correo verificado)
-- ---------------------------------------------------------------------------

create function private.invitation_accept_core(p_hash text,p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare inv public.org_invitations; u_email text; u_confirmed timestamptz;
begin
 select * into inv from public.org_invitations where token_hash=p_hash for update;
 if not found or inv.revoked_at is not null or inv.accepted_at is not null or inv.expires_at<=now() then raise exception 'INVITATION_INVALID'; end if;
 select lower(btrim(email)),email_confirmed_at into u_email,u_confirmed from auth.users where id=p_user;
 if u_email is null or u_confirmed is null or u_email<>inv.email then raise exception 'INVITATION_INVALID'; end if;
 if exists(select 1 from public.profiles where user_id=p_user) then raise exception 'CUSTOMER_EMAIL'; end if;
 if not private.org_active(inv.organization_id) then raise exception 'ORGANIZATION_NOT_ACTIVE'; end if;
 insert into public.org_memberships(organization_id,user_id,role,venue_ids) values(inv.organization_id,p_user,inv.role,inv.venue_ids)
 on conflict(organization_id,user_id) do update set role=excluded.role,venue_ids=excluded.venue_ids,status='active';
 update public.org_invitations set accepted_at=now(),accepted_by=p_user where id=inv.id;
 perform private.sync_legacy_membership(inv.organization_id,p_user);
 insert into public.platform_audit(actor_id,actor_email,organization_id,action,entity,entity_id,details)
 values(p_user,u_email,inv.organization_id,'invitation.accept','invitation',inv.id::text,jsonb_build_object('role',inv.role));
 return jsonb_build_object('organization_id',inv.organization_id,'role',inv.role);
end $$;

-- Solo servidor (service_role): datos mínimos para mostrar la invitación antes de crear la cuenta.
create function public.invitation_lookup(p_hash text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare inv public.org_invitations; org public.organizations;
begin
 select * into inv from public.org_invitations where token_hash=p_hash;
 if not found or inv.revoked_at is not null or inv.accepted_at is not null or inv.expires_at<=now() then raise exception 'INVITATION_INVALID'; end if;
 select * into org from public.organizations where id=inv.organization_id;
 return jsonb_build_object('email',inv.email,'role',inv.role,'organization',org.name,'expires_at',inv.expires_at,
  'account_exists',exists(select 1 from auth.users u where lower(u.email)=inv.email));
end $$;

-- Solo servidor: acepta con la cuenta recién creada (correo ya confirmado por la invitación).
create function public.invitation_accept(p_hash text,p_user uuid) returns jsonb language sql security definer set search_path='' as $$
 select private.invitation_accept_core(p_hash,p_user) $$;

-- Con sesión: una cuenta laboral existente acepta con su propio correo verificado.
create function public.invitation_accept_self(p_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'SESSION_REQUIRED'; end if;
 if not private.limit_action('invitation_accept',10) then raise exception 'RATE_LIMITED'; end if;
 return private.invitation_accept_core(p_hash,auth.uid());
end $$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución: nada para el rol público.
-- ---------------------------------------------------------------------------

revoke execute on function public.platform_overview(jsonb),public.platform_orgs_list(jsonb),public.platform_org_get(uuid),public.platform_org_inventory(uuid),
 public.platform_venues_list(jsonb),public.platform_venue_get(uuid),public.platform_venue_menu(uuid),public.platform_users_list(jsonb),public.platform_audit_list(jsonb),
 public.platform_onboard(jsonb),public.platform_org_update(jsonb),public.platform_org_set_status(jsonb),public.platform_org_delete(jsonb),public.platform_venue_create(jsonb),
 public.platform_venue_update(jsonb),public.platform_venue_set_status(jsonb),public.platform_venue_delete(jsonb),public.platform_invitation_create(jsonb),
 public.platform_invitation_revoke(jsonb),public.platform_user_target(uuid),public.platform_user_record(jsonb),
 public.org_my(),public.org_summary(jsonb),public.org_customers(jsonb),public.org_menu(uuid),public.org_venue_settings_save(jsonb),public.org_staff_list(uuid),
 public.org_invitation_create(jsonb),public.org_invitation_revoke(jsonb),public.org_invitation_resend(jsonb),public.org_member_set(jsonb),public.org_member_remove(jsonb),
 public.invitation_lookup(text),public.invitation_accept(text,uuid),public.invitation_accept_self(text) from public,anon;
grant execute on function public.platform_overview(jsonb),public.platform_orgs_list(jsonb),public.platform_org_get(uuid),public.platform_org_inventory(uuid),
 public.platform_venues_list(jsonb),public.platform_venue_get(uuid),public.platform_venue_menu(uuid),public.platform_users_list(jsonb),public.platform_audit_list(jsonb),
 public.platform_onboard(jsonb),public.platform_org_update(jsonb),public.platform_org_set_status(jsonb),public.platform_org_delete(jsonb),public.platform_venue_create(jsonb),
 public.platform_venue_update(jsonb),public.platform_venue_set_status(jsonb),public.platform_venue_delete(jsonb),public.platform_invitation_create(jsonb),
 public.platform_invitation_revoke(jsonb),public.platform_user_target(uuid),public.platform_user_record(jsonb),
 public.org_my(),public.org_summary(jsonb),public.org_customers(jsonb),public.org_menu(uuid),public.org_venue_settings_save(jsonb),public.org_staff_list(uuid),
 public.org_invitation_create(jsonb),public.org_invitation_revoke(jsonb),public.org_invitation_resend(jsonb),public.org_member_set(jsonb),public.org_member_remove(jsonb),
 public.invitation_accept_self(text) to authenticated;
revoke execute on function public.invitation_lookup(text),public.invitation_accept(text,uuid) from authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  grant execute on function public.invitation_lookup(text),public.invitation_accept(text,uuid) to service_role;
 end if;
end $$;

do $$ declare f regprocedure; begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname in ('in_text','in_uuid','in_uuids','in_email','in_hash','in_int','valid_service_modes','sync_legacy_membership','sync_org_members',
   'org_scope','org_can_grant','invitation_accept_core','gate') loop
  execute format('revoke execute on function %s from public,anon,authenticated',f);
 end loop;
end $$;
