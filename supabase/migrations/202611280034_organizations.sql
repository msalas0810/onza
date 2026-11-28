-- Modelo multiempresa: empresas, estado de los locales, membresías con roles, invitaciones y seudónimos de cliente.
-- ADITIVA (R4) salvo dos cambios acotados y reversibles: columnas nuevas (con valores que conservan el comportamiento actual)
-- en `venues` y la política `venues_read`, que ahora oculta los locales no publicados o suspendidos y los de empresas no activas.
-- Todo local existente queda `published` y sin empresa, así que se sigue viendo igual.
--
-- * Una empresa (organización) puede estar `active | suspended | closed`. Una empresa suspendida, o un local suspendido, no
--   recibe pedidos nuevos (trigger sobre `orders`); el superadministrador es el único que aplica la suspensión.
-- * Visible en directorio = `venues.demo_listed` (ya existe; no se duplica).
-- * Las tablas nuevas no tienen escritura directa para nadie de la aplicación: los cambios pasan por funciones (035) que
--   validan rol y alcance. Las lecturas usan políticas de RLS con las MISMAS funciones de comprobación que el panel.
-- * Invitaciones: solo se guarda el hash SHA-256 de un token de 256 bits; son de un solo uso y vencen a los 7 días.
-- * Clientes de una empresa: seudónimo derivado con una sal propia de cada empresa (sin correo ni id de cuenta).
-- * El plan y las funciones son solo etiquetas: no hay cobros.

create table public.organizations(
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 2 and 120),
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 60),
 legal_name text not null default '' check(length(legal_name)<=160),
 tax_id text not null default '' check(length(tax_id)<=40),
 country text not null default 'CR' check(country ~ '^[A-Z]{2}$'),
 currency text not null default 'CRC' check(currency ~ '^[A-Z]{3}$'),
 contact_name text check(contact_name is null or length(contact_name)<=120),
 contact_email text check(contact_email is null or contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
 contact_phone text check(contact_phone is null or contact_phone ~ '^\+[0-9]{6,15}$'),
 notes text not null default '' check(length(notes)<=2000),
 plan text not null default 'free' check(plan in ('free','standard','premium')),
 features jsonb not null default '{}' check(jsonb_typeof(features)='object'),
 is_demo boolean not null default false,
 status text not null default 'active' check(status in ('active','suspended','closed')),
 status_reason text check(status_reason is null or length(status_reason)<=300),
 status_changed_at timestamptz,
 created_by uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index organizations_status on public.organizations(status,created_at desc);

create table private.organization_secrets(
 organization_id uuid primary key references public.organizations(id) on delete cascade,
 customer_salt text not null default replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','')
);
alter table private.organization_secrets enable row level security;
revoke all on private.organization_secrets from public,anon,authenticated;

alter table public.venues
 add column organization_id uuid references public.organizations(id),
 add column publication_status text not null default 'published' check(publication_status in ('draft','published','archived')),
 add column suspended_at timestamptz,
 add column suspended_reason text check(suspended_reason is null or length(suspended_reason)<=300),
 add column suspended_by uuid,
 add column service_modes jsonb not null default '{"dine_in":true,"pickup":true,"delivery":{"enabled":false,"zones":[],"fee_minor":0,"min_order_minor":0}}'
  check(jsonb_typeof(service_modes)='object'),
 add column brand_color text check(brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$');
create index venues_organization on public.venues(organization_id) where organization_id is not null;

create table public.org_memberships(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','admin','venue_manager','ops_manager','cashier','kitchen','staff','analyst')),
 venue_ids uuid[] check(venue_ids is null or cardinality(venue_ids)>=1),
 status text not null default 'active' check(status in ('active','suspended')),
 created_at timestamptz not null default now(),
 unique(organization_id,user_id),
 -- Propietario y administrador ven toda la empresa; los roles de local necesitan al menos un local.
 check((role in ('owner','admin') and venue_ids is null) or (role in ('ops_manager','analyst')) or (role in ('venue_manager','cashier','kitchen','staff') and venue_ids is not null))
);
create index org_memberships_user on public.org_memberships(user_id,status);

-- Los locales asignados deben ser de la propia empresa.
create function private.org_membership_check() returns trigger language plpgsql set search_path='' as $$
begin
 if new.venue_ids is not null and exists(
  select 1 from unnest(new.venue_ids) v(id) where not exists(select 1 from public.venues x where x.id=v.id and x.organization_id=new.organization_id)) then
  raise exception 'VENUE_NOT_IN_ORGANIZATION';
 end if;
 return new;
end $$;
create trigger org_memberships_check before insert or update on public.org_memberships for each row execute function private.org_membership_check();

create table public.org_invitations(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 email text not null check(email=lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
 role text not null check(role in ('owner','admin','venue_manager','ops_manager','cashier','kitchen','staff','analyst')),
 venue_ids uuid[] check(venue_ids is null or cardinality(venue_ids)>=1),
 token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz not null default now()+interval '7 days',
 accepted_at timestamptz,
 accepted_by uuid,
 revoked_at timestamptz,
 created_by uuid,
 created_at timestamptz not null default now(),
 check((role in ('owner','admin') and venue_ids is null) or (role in ('ops_manager','analyst')) or (role in ('venue_manager','cashier','kitchen','staff') and venue_ids is not null))
);
-- Una invitación pendiente por correo y empresa.
create unique index org_invitations_pending on public.org_invitations(organization_id,email) where accepted_at is null and revoked_at is null;
create trigger org_invitations_check before insert or update on public.org_invitations for each row execute function private.org_membership_check();

alter table public.organizations enable row level security;
alter table public.org_memberships enable row level security;
alter table public.org_invitations enable row level security;
revoke all on public.organizations,public.org_memberships,public.org_invitations from public,anon,authenticated;
grant select on public.organizations,public.org_memberships to authenticated;

-- ---------------------------------------------------------------------------
-- Comprobaciones de pertenencia (las usan las políticas y las funciones)
-- ---------------------------------------------------------------------------

create function private.org_role(p_org uuid) returns text language sql stable security definer set search_path='' as $$
 select m.role from public.org_memberships m
 where m.organization_id=p_org and m.user_id=auth.uid() and m.status='active' and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false) $$;

create function private.org_is_member(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.org_role(p_org) is not null $$;

create function private.org_has_role(p_org uuid,p_roles text[]) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(private.org_role(p_org)=any(p_roles),false) $$;

-- ¿Puede esta sesión operar el local? Rol permitido, membresía activa y alcance (todos los locales o este).
create function private.org_venue_access(p_venue uuid,p_roles text[]) returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.venues v join public.org_memberships m on m.organization_id=v.organization_id
  where v.id=p_venue and m.user_id=auth.uid() and m.status='active' and m.role=any(p_roles)
   and (m.venue_ids is null or p_venue=any(m.venue_ids))
   and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)) $$;

-- La empresa existe y está activa (o el local no tiene empresa: locales anteriores al modelo).
create function private.org_active(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select p_org is null or exists(select 1 from public.organizations o where o.id=p_org and o.status='active') $$;

create policy organizations_read on public.organizations for select to authenticated
 using (private.is_platform_operator() or private.org_is_member(id));
create policy org_memberships_read on public.org_memberships for select to authenticated
 using (private.is_platform_operator() or user_id=auth.uid() or private.org_has_role(organization_id,array['owner','admin']));

-- ---------------------------------------------------------------------------
-- Visibilidad de los locales: solo publicados, no suspendidos y de empresas activas (o sin empresa).
-- ---------------------------------------------------------------------------

-- Un único predicado para la política (SECURITY DEFINER): el rol anónimo del catálogo solo necesita ejecutar ESTE; las demás
-- funciones de pertenencia las llama él con los privilegios de su dueño, sin ampliar lo que puede ejecutar el público.
create function private.venue_visible(p_id uuid,p_org uuid,p_status text,p_suspended timestamptz) returns boolean language sql stable security definer set search_path='' as $$
 select (p_status='published' and p_suspended is null and private.org_active(p_org))
  or private.is_platform_operator()
  or (p_org is not null and private.org_venue_access(p_id,array['owner','admin','venue_manager','ops_manager','cashier','kitchen','staff','analyst'])) $$;

drop policy venues_read on public.venues;
create policy venues_read on public.venues for select using (
 private.is_staff(id) or private.venue_visible(id,organization_id,publication_status,suspended_at)
);
grant execute on function private.venue_visible(uuid,uuid,text,timestamptz) to anon,authenticated;
-- Las políticas de empresas y de membresías (solo sesiones autenticadas) usan estos predicados.
grant execute on function private.org_is_member(uuid),private.org_has_role(uuid,text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Una empresa o un local suspendido (o no publicado) no recibe pedidos nuevos.
-- ---------------------------------------------------------------------------

create function private.block_orders_when_unavailable() returns trigger language plpgsql security definer set search_path='' as $$
declare v public.venues;
begin
 select * into v from public.venues where id=new.venue_id;
 if v.suspended_at is not null then raise exception 'VENUE_SUSPENDED'; end if;
 if not private.org_active(v.organization_id) then raise exception 'ORGANIZATION_SUSPENDED'; end if;
 if v.publication_status<>'published' then raise exception 'VENUE_UNAVAILABLE'; end if;
 return new;
end $$;
create trigger orders_block_unavailable before insert on public.orders for each row execute function private.block_orders_when_unavailable();

do $$ declare f regprocedure; begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname in ('org_membership_check','block_orders_when_unavailable') loop
  execute format('revoke execute on function %s from public,anon,authenticated',f);
 end loop;
end $$;

-- Superficie mínima: una función nueva nace ejecutable por PUBLIC. Las de pertenencia las llaman las funciones del panel (con los
-- privilegios de su dueño) y el predicado de `venues`; solo estos dos los ejecutan directamente las políticas de sesiones autenticadas.
revoke execute on function private.org_role(uuid),private.org_active(uuid),private.org_is_member(uuid),private.org_has_role(uuid,text[]),
 private.org_venue_access(uuid,text[]) from public,anon,authenticated;
grant execute on function private.org_is_member(uuid),private.org_has_role(uuid,text[]) to authenticated;
