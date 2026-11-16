-- An Onza administrator is a permanent user with a server-provisioned onza membership.
-- Nothing in the browser or user_metadata can grant this role.
create function private.is_onza() returns boolean language sql stable security definer set search_path='' as $$select coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false and exists(select 1 from public.memberships where user_id=auth.uid() and role='onza')$$;
create or replace function private.is_staff(v uuid,admin_only boolean default false) returns boolean language sql stable security definer set search_path='' as $$select coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false and (private.is_onza() or exists(select 1 from public.memberships m where m.user_id=auth.uid() and m.venue_id=v and (not admin_only or m.role in ('admin','onza'))))$$;
create table private.platform_events(id uuid primary key default gen_random_uuid(),actor_id uuid not null references auth.users(id),action text not null,venue_id uuid not null references public.venues(id),created_at timestamptz not null default now(),metadata jsonb not null default '{}');
create function public.has_platform_access() returns boolean language sql stable security definer set search_path='' as $$select private.is_onza()$$;
create function public.platform_command(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare v public.venues;target uuid;begin
 if not private.is_onza() then raise exception 'NOT_AUTHORIZED';end if;
 if input->>'action'='venue_create' then
  if coalesce(input->>'name','')='' or coalesce(input->>'slug','')!~'^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'INVALID_INPUT';end if;
  insert into public.venues(slug,name,zone) values(input->>'slug',input->>'name',coalesce(input->>'zone','')) returning * into v;
  insert into public.categories(venue_id,label) values(v.id,'Menú');
  insert into private.platform_events(actor_id,action,venue_id) values(auth.uid(),'venue_created',v.id);return to_jsonb(v);
 elsif input->>'action'='membership_save' then
  if input->>'role' not in ('bartender','admin') then raise exception 'INVALID_INPUT';end if;
  target:=(input->>'userId')::uuid;
  if exists(select 1 from public.memberships where user_id=target and role='onza') then raise exception 'INVALID_INPUT';end if;
  insert into public.memberships(user_id,venue_id,role) values(target,(input->>'venueId')::uuid,input->>'role') on conflict(user_id,venue_id) do update set role=excluded.role;
  insert into private.platform_events(actor_id,action,venue_id,metadata) values(auth.uid(),'membership_saved',(input->>'venueId')::uuid,jsonb_build_object('user_id',target,'role',input->>'role'));return jsonb_build_object('ok',true);
 end if;raise exception 'INVALID_INPUT';end$$;
revoke execute on function private.is_onza() from public,anon,authenticated;
revoke execute on function public.has_platform_access(),public.platform_command(jsonb) from public,anon;
grant execute on function public.has_platform_access(),public.platform_command(jsonb) to authenticated;
