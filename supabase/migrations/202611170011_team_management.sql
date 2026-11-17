-- Equipo del local: cuentas laborales con contraseña temporal, cambio de rol y retiro de acceso por local.
-- Migración ADITIVA (regla R4): no cambia firmas ni columnas usadas por el frontend desplegado. Las cuentas laborales
-- existentes no tienen fila en staff_accounts y siguen operando igual; el cambio de contraseña solo se exige a las
-- cuentas creadas con contraseña temporal. Compatible con el commit desplegado 346df98.

create table public.staff_accounts(
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check(length(btrim(display_name)) between 2 and 100),
  must_change_password boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.staff_accounts enable row level security;
revoke all on public.staff_accounts from public, anon, authenticated;
grant select on public.staff_accounts to authenticated;
-- Cada persona del equipo ve solo su propia fila; el resto pasa por funciones con permisos comprobados.
create policy own_staff_account on public.staff_accounts for select to authenticated using(user_id=auth.uid());
do $$ begin
  if exists(select 1 from pg_roles where rolname='service_role') then
    grant all on public.staff_accounts to service_role;
  end if;
end $$;

-- Contraseña temporal pendiente: la cuenta no opera en ningún local hasta cambiarla (base de datos, API y navegación).
create function private.password_change_pending() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.staff_accounts s where s.user_id=auth.uid() and s.must_change_password)
$$;

create or replace function private.is_staff(v uuid,admin_only boolean default false) returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
    and not private.password_change_pending()
    and (private.is_onza() or exists(select 1 from public.memberships m where m.user_id=auth.uid() and m.venue_id=v and (not admin_only or m.role in ('admin','onza'))))
$$;

-- El tipo de cuenta lo decide la base. Una persona del equipo sin locales (por ejemplo, tras quitarle el acceso) sigue
-- siendo del equipo: nunca se convierte en cliente por tener el mismo correo.
create or replace function public.current_account() returns jsonb language sql stable security definer set search_path='' as $$
 select case
  when auth.uid() is null then jsonb_build_object('kind','none','onboarded',false)
  when coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then jsonb_build_object('kind','guest','onboarded',false)
  when exists(select 1 from public.memberships m where m.user_id=auth.uid()) or exists(select 1 from public.staff_accounts s where s.user_id=auth.uid())
    then jsonb_build_object('kind','staff','onboarded',false,'mustChangePassword',private.password_change_pending())
  else jsonb_build_object('kind','customer','onboarded',exists(select 1 from public.profiles p where p.user_id=auth.uid()))
 end
$$;

-- Equipo de un local. Solo el administrador de ese local; nunca devuelve cuentas de clientes.
create function public.list_venue_team(venue uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_staff(venue,true) then raise exception 'NOT_AUTHORIZED'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'userId',m.user_id,
      'email',u.email,
      'name',coalesce(s.display_name,split_part(u.email,'@',1)),
      'role',m.role,
      'mustChangePassword',coalesce(s.must_change_password,false),
      'self',m.user_id=auth.uid()
    ) order by (m.role='onza'), (m.role<>'admin'), coalesce(s.display_name,u.email))
    from public.memberships m
    join auth.users u on u.id=m.user_id
    left join public.staff_accounts s on s.user_id=m.user_id
    where m.venue_id=venue
  ),'[]'::jsonb);
end $$;

-- Cambiar el permiso de una persona en ESTE local (bartender = Empleado, admin = Administrador).
create function public.team_set_role(venue uuid,member uuid,new_role text) returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.memberships;
begin
  if not private.is_staff(venue,true) then raise exception 'NOT_AUTHORIZED'; end if;
  if new_role not in ('bartender','admin') then raise exception 'INVALID_ROLE'; end if;
  -- Serializa los cambios del equipo de este local: dos administradores no pueden dejarlo sin administrador a la vez.
  perform 1 from public.memberships where venue_id=venue for update;
  select * into target from public.memberships where venue_id=venue and user_id=member;
  if not found then raise exception 'NOT_MEMBER'; end if;
  if target.role='onza' then raise exception 'NOT_AUTHORIZED'; end if;
  if member=auth.uid() then raise exception 'SELF_CHANGE'; end if;
  if target.role='admin' and new_role<>'admin'
     and (select count(*) from public.memberships where venue_id=venue and role in ('admin','onza'))<=1
  then raise exception 'LAST_ADMIN'; end if;
  update public.memberships set role=new_role where venue_id=venue and user_id=member;
  insert into private.platform_events(actor_id,action,venue_id,metadata)
    values(auth.uid(),'team_set_role',venue,jsonb_build_object('member',member,'role',new_role));
  return jsonb_build_object('ok',true);
end $$;

-- Quitar el acceso a ESTE local. Borra únicamente la membresía (usuario, local): las de otros locales quedan intactas y
-- toda acción posterior en este local se rechaza porque cada comprobación consulta la membresía vigente.
create function public.team_revoke(venue uuid,member uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.memberships;remaining integer;
begin
  if not private.is_staff(venue,true) then raise exception 'NOT_AUTHORIZED'; end if;
  perform 1 from public.memberships where venue_id=venue for update;
  select * into target from public.memberships where venue_id=venue and user_id=member;
  if not found then raise exception 'NOT_MEMBER'; end if;
  if target.role='onza' then raise exception 'NOT_AUTHORIZED'; end if;
  if member=auth.uid() then raise exception 'SELF_CHANGE'; end if;
  if target.role='admin'
     and (select count(*) from public.memberships where venue_id=venue and role in ('admin','onza'))<=1
  then raise exception 'LAST_ADMIN'; end if;
  delete from public.memberships where venue_id=venue and user_id=member;
  select count(*) into remaining from public.memberships where user_id=member;
  insert into private.platform_events(actor_id,action,venue_id,metadata)
    values(auth.uid(),'team_revoke',venue,jsonb_build_object('member',member,'remainingMemberships',remaining));
  return jsonb_build_object('ok',true,'remainingMemberships',remaining);
end $$;

-- Solo para la ruta de servidor (service_role): nunca se exponen al navegador.
create function public.team_lookup_email(lookup text) returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce((
    select jsonb_build_object('id',u.id,'kind',
      case when exists(select 1 from public.memberships m where m.user_id=u.id)
             or exists(select 1 from public.staff_accounts s where s.user_id=u.id)
           then 'staff' else 'customer' end)
    from auth.users u where lower(u.email)=lower(lookup) limit 1
  ),jsonb_build_object('kind','none'))
$$;

create function public.team_attach(venue uuid,member uuid,member_name text,member_role text,actor uuid,fresh boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare is_member boolean;marker boolean;
begin
  if member_role not in ('bartender','admin') then raise exception 'INVALID_ROLE'; end if;
  -- Defensa en profundidad: el actor debe ser administrador de este local (o acceso interno de Onza).
  if not exists(select 1 from public.memberships m where m.user_id=actor and (m.role='onza' or (m.venue_id=venue and m.role='admin')))
  then raise exception 'NOT_AUTHORIZED'; end if;
  marker:=exists(select 1 from public.memberships m where m.user_id=member) or exists(select 1 from public.staff_accounts s where s.user_id=member);
  -- Un correo que ya es de una cuenta personal nunca se convierte ni se vincula (regla R1).
  if not fresh and not marker then raise exception 'CUSTOMER_EMAIL'; end if;
  is_member:=exists(select 1 from public.memberships where user_id=member and venue_id=venue);
  if is_member then raise exception 'ALREADY_MEMBER'; end if;
  insert into public.staff_accounts(user_id,display_name,must_change_password,created_by)
    values(member,btrim(member_name),fresh,actor) on conflict (user_id) do nothing;
  insert into public.memberships(user_id,venue_id,role) values(member,venue,member_role);
  insert into private.platform_events(actor_id,action,venue_id,metadata)
    values(actor,'team_attach',venue,jsonb_build_object('member',member,'role',member_role,'fresh',fresh));
  return jsonb_build_object('ok',true,'fresh',fresh);
end $$;

create function public.complete_password_change(member uuid) returns void language sql security definer set search_path='' as $$
  update public.staff_accounts set must_change_password=false where user_id=member
$$;

revoke execute on function public.list_venue_team(uuid),public.team_set_role(uuid,uuid,text),public.team_revoke(uuid,uuid) from public,anon;
grant execute on function public.list_venue_team(uuid),public.team_set_role(uuid,uuid,text),public.team_revoke(uuid,uuid) to authenticated;
revoke execute on function public.team_lookup_email(text),public.team_attach(uuid,uuid,text,text,uuid,boolean),public.complete_password_change(uuid) from public,anon,authenticated;
do $$ begin
  if exists(select 1 from pg_roles where rolname='service_role') then
    grant execute on function public.team_lookup_email(text),public.team_attach(uuid,uuid,text,text,uuid,boolean),public.complete_password_change(uuid) to service_role;
  end if;
end $$;
