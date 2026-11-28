-- Super administrador de la plataforma (mega admin). ADITIVA (R4): tablas y funciones nuevas; nada anterior se edita.
--
-- Solo UNA cuenta administra la plataforma: la del correo sembrado abajo. La comprobación vive en la base y la usan las
-- funciones del panel Y las políticas de RLS (misma función), de modo que llamar a la API directamente no la esquiva:
--   * El correo debe estar VERIFICADO en el proveedor de autenticación y coincidir, en minúsculas, con el correo del token.
--     Si el correo de la cuenta cambia, el acceso se pierde solo (no hay forma de «asignar» acceso desde la interfaz).
--   * Cualquier otra cuenta (empresa, consumidor, soporte, invitada, sin verificar) recibe NOT_FOUND: el panel no revela que existe.
--   * Las acciones sensibles exigen un segundo factor verificado en los últimos 15 minutos (claim `amr` con marca de tiempo);
--     si no, REAUTH_REQUIRED. Sin segundo factor solo hay lectura.
-- La tabla de operadores no tiene permisos para nadie de la aplicación: solo las funciones con privilegios elevados la leen.
-- Agregar un operador en el futuro se hace con `scripts/platform/add-operator.mjs`, nunca desde la interfaz.

create table private.platform_operators(
 email text primary key check(email=lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
 role text not null default 'super_admin' check(role='super_admin'),
 created_at timestamptz not null default now()
);
alter table private.platform_operators enable row level security;
revoke all on private.platform_operators from public,anon,authenticated;

-- Una sola fila: cualquier cambio exige el interruptor que solo activa el script de operación, dentro de su transacción.
create function private.platform_operators_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if coalesce(current_setting('onza.allow_operator_change',true),'')<>'on' then raise exception 'OPERATOR_LIST_LOCKED'; end if;
 return coalesce(new,old);
end $$;
create trigger platform_operators_guard before insert or update or delete on private.platform_operators
 for each row execute function private.platform_operators_guard();

-- Siembra permitida solo aquí (el interruptor es local a esta transacción).
select set_config('onza.allow_operator_change','on',true);
insert into private.platform_operators(email,role) values('admin.choliempresas@gmail.com','super_admin');
select set_config('onza.allow_operator_change','off',true);

-- ¿Es esta sesión la del operador? Correo del token = correo VIGENTE de la cuenta = correo del operador, y verificado.
create function private.is_platform_operator() returns boolean language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); token_email text; account_email text; confirmed timestamptz;
begin
 if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then return false; end if;
 token_email:=lower(btrim(coalesce(auth.jwt()->>'email','')));
 if token_email='' then return false; end if;
 select lower(btrim(u.email)),u.email_confirmed_at into account_email,confirmed from auth.users u where u.id=uid;
 if account_email is null or confirmed is null or account_email<>token_email then return false; end if;
 return exists(select 1 from private.platform_operators o where o.email=account_email and o.role='super_admin');
end $$;

-- Segundo factor (TOTP o llave de seguridad) verificado en los últimos 15 minutos, según el claim `amr` del token.
create function private.platform_mfa_recent() returns boolean language plpgsql stable security definer set search_path='' as $$
declare entries jsonb:=auth.jwt()->'amr'; entry jsonb;
begin
 if coalesce(auth.jwt()->>'aal','')<>'aal2' or jsonb_typeof(entries) is distinct from 'array' then return false; end if;
 for entry in select * from jsonb_array_elements(entries) loop
  if entry->>'method' in ('totp','webauthn') and coalesce((entry->>'timestamp')::numeric,0)>=extract(epoch from now())-900 then return true; end if;
 end loop;
 return false;
end $$;

create function private.require_platform(p_sensitive boolean default false) returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_platform_operator() then raise exception 'NOT_FOUND'; end if;
 if p_sensitive and not private.platform_mfa_recent() then raise exception 'REAUTH_REQUIRED'; end if;
end $$;

-- Comprobación para la capa de la aplicación. Para toda cuenta que no es el operador responde NOT_FOUND.
create function public.platform_access(sensitive boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_platform(sensitive);
 return jsonb_build_object('ok',true,'mfa_recent',private.platform_mfa_recent(),'email',lower(auth.jwt()->>'email'));
end $$;

-- Solo servidor (service_role): ¿este correo (sin verificar) es el del operador? Sirve para elegir el mensaje de una sesión
-- revocada sin conceder nada. Fuera de service_role no existe para nadie.
create function public.platform_is_operator_email(p_email text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.platform_operators o where o.email=lower(btrim(p_email))) $$;

-- ---------------------------------------------------------------------------
-- Auditoría: solo inserción para la aplicación; lectura global solo para el operador.
-- ---------------------------------------------------------------------------

create table public.platform_audit(
 id uuid primary key default gen_random_uuid(),
 at timestamptz not null default now(),
 actor_id uuid,
 actor_email text,
 organization_id uuid,
 venue_id uuid,
 action text not null check(length(action) between 3 and 80),
 entity text not null check(length(entity) between 2 and 60),
 entity_id text,
 details jsonb not null default '{}' check(jsonb_typeof(details)='object'),
 request_id text check(length(request_id)<=80),
 ip text check(length(ip)<=64)
);
create index platform_audit_recent on public.platform_audit(at desc);
create index platform_audit_org on public.platform_audit(organization_id,at desc) where organization_id is not null;
create index platform_audit_action on public.platform_audit(action,at desc);
alter table public.platform_audit enable row level security;
revoke all on public.platform_audit from public,anon,authenticated;
grant select on public.platform_audit to authenticated;
create policy platform_audit_read on public.platform_audit for select to authenticated using (private.is_platform_operator());

create function private.audit_append_only() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'APPEND_ONLY'; end $$;
create trigger platform_audit_append_only before update or delete on public.platform_audit for each row execute function private.audit_append_only();

-- Nunca guarda secretos: los datos van en `details` (el llamador no pasa tokens ni contraseñas).
create function private.audit(p_action text,p_entity text,p_entity_id text,p_org uuid,p_venue uuid,p_details jsonb default '{}',p_meta jsonb default '{}') returns void
 language plpgsql security definer set search_path='' as $$
begin
 insert into public.platform_audit(actor_id,actor_email,organization_id,venue_id,action,entity,entity_id,details,request_id,ip)
 values(auth.uid(),lower(auth.jwt()->>'email'),p_org,p_venue,p_action,p_entity,p_entity_id,coalesce(p_details,'{}'),left(p_meta->>'requestId',80),left(p_meta->>'ip',64));
end $$;

-- Permisos de ejecución: nada para el rol público.
revoke execute on function public.platform_access(boolean),public.platform_is_operator_email(text) from public,anon;
grant execute on function public.platform_access(boolean) to authenticated;
revoke execute on function public.platform_is_operator_email(text) from authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  grant execute on function public.platform_is_operator_email(text) to service_role;
 end if;
end $$;

do $$ declare f regprocedure; begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname in ('platform_operators_guard','is_platform_operator','platform_mfa_recent','require_platform','audit_append_only','audit') loop
  execute format('revoke execute on function %s from public,anon,authenticated',f);
 end loop;
end $$;
-- Los predicados de RLS los ejecuta la sesión de quien consulta (como is_staff).
grant execute on function private.is_platform_operator() to authenticated;
