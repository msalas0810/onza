-- Actividad por local y amigos. ADITIVA (R4): tablas y funciones nuevas; nada anterior se edita.
--
-- Decisiones (detalle en docs/Onza-Noche-decisiones.md):
-- * La señal de actividad son CHECK-INS voluntarios («Estoy acá»), de una cuenta de cliente con perfil, con vencimiento
--   (60, 120 o 180 min). Pedir NO crea un check-in: esta migración no toca pedidos ni lee sus tablas.
-- * Cada persona tiene a lo sumo UN check-in activo: el mapa cuenta personas, no toques.
-- * El mapa de actividad nunca devuelve conteos: solo un nivel (1, 2 o 3) y solo para locales con 5 o más personas activas
--   y coordenadas cargadas (las coordenadas se cargan solo si se verificaron; ver 009 y scripts/seed-real-venues.mjs).
-- * Compartir con amigos es un interruptor del check-in, apagado por defecto. Vence con el check-in y se apaga al instante.
--   Solo lo ven amistades ACEPTADAS. Nunca se comparte el pin de entrega, GPS, historial ni datos de pedidos.
-- * Las tablas no tienen permisos directos para anon/authenticated: todo pasa por estas funciones, que validan en servidor.

create table public.venue_checkins(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 venue_id uuid not null references public.venues(id),
 share_with_friends boolean not null default false,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 ended_at timestamptz,
 check (expires_at > created_at and expires_at <= created_at + interval '3 hours')
);
create index venue_checkins_active on public.venue_checkins(venue_id, expires_at) where ended_at is null;
create index venue_checkins_user on public.venue_checkins(user_id, created_at desc);
alter table public.venue_checkins enable row level security;
revoke all on public.venue_checkins from anon, authenticated;

create table public.friendships(
 id uuid primary key default gen_random_uuid(),
 requester uuid not null references auth.users(id) on delete cascade,
 addressee uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','accepted')),
 created_at timestamptz not null default now(),
 responded_at timestamptz,
 check (requester <> addressee)
);
-- Una sola relación por par, sin importar quién la pidió.
create unique index friendships_pair on public.friendships(least(requester, addressee), greatest(requester, addressee));
create index friendships_addressee on public.friendships(addressee, status);
alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;

-- Quién puede usar lo social: una cuenta de cliente con perfil (no invitada, no del equipo). Devuelve su id.
create function private.social_user() returns uuid language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'SESSION_REQUIRED'; end if;
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'ACCOUNT_REQUIRED'; end if;
 if exists(select 1 from public.memberships m where m.user_id=uid) or exists(select 1 from public.staff_accounts s where s.user_id=uid) then
  raise exception 'STAFF_NOT_SOCIAL';
 end if;
 if not exists(select 1 from public.profiles p where p.user_id=uid) then raise exception 'ONBOARDING_REQUIRED'; end if;
 return uid;
end $$;

-- «Estoy acá»: abre un check-in (cierra el anterior). share=false por defecto.
create function public.social_checkin(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.social_user(); v public.venues; mins integer; c public.venue_checkins;
begin
 if not private.limit_action('checkin',6) then raise exception 'RATE_LIMITED'; end if;
 mins:=coalesce((input->>'minutes')::integer,120);
 if mins not in (60,120,180) then raise exception 'INVALID_INPUT'; end if;
 select * into v from public.venues where id=(input->>'venueId')::uuid;
 if not found or not v.demo_listed then raise exception 'RESOURCE_NOT_FOUND'; end if;
 if v.open_state<>'open' then raise exception 'VENUE_CLOSED'; end if;
 update public.venue_checkins set ended_at=now() where user_id=uid and ended_at is null and expires_at>now();
 insert into public.venue_checkins(user_id,venue_id,share_with_friends,expires_at)
  values(uid,v.id,coalesce((input->>'share')::boolean,false),now()+make_interval(mins=>mins)) returning * into c;
 return jsonb_build_object('venueId',c.venue_id,'expiresAt',c.expires_at,'share',c.share_with_friends);
end $$;

-- Salir: cierra el check-in activo (y con él, lo compartido). Idempotente.
create function public.social_checkout() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.social_user();
begin
 update public.venue_checkins set ended_at=now() where user_id=uid and ended_at is null;
 return jsonb_build_object('ok',true);
end $$;

-- Compartir con amigos / dejar de compartir, sobre el check-in activo. Apagar es inmediato.
create function public.social_share(share boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.social_user(); c public.venue_checkins;
begin
 update public.venue_checkins set share_with_friends=coalesce(share,false)
  where user_id=uid and ended_at is null and expires_at>now() returning * into c;
 if not found then
  if coalesce(share,false) then raise exception 'CHECKIN_REQUIRED'; end if;
  return jsonb_build_object('share',false);
 end if;
 return jsonb_build_object('share',c.share_with_friends,'expiresAt',c.expires_at);
end $$;

-- Solicitud por identificador de Onza (@usuario). Si la otra persona ya me lo había pedido, queda aceptada.
create function public.social_friend_request(handle text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.social_user(); other uuid; f public.friendships;
begin
 if not private.limit_action('friend',10) then raise exception 'RATE_LIMITED'; end if;
 select p.user_id into other from public.profiles p where lower(p.username)=lower(ltrim(btrim(coalesce(handle,'')),'@'));
 if other is null or exists(select 1 from public.memberships m where m.user_id=other) then raise exception 'FRIEND_NOT_FOUND'; end if;
 if other=uid then raise exception 'FRIEND_SELF'; end if;
 select * into f from public.friendships x where least(x.requester,x.addressee)=least(uid,other) and greatest(x.requester,x.addressee)=greatest(uid,other) for update;
 if found then
  if f.status='pending' and f.addressee=uid then
   update public.friendships set status='accepted',responded_at=now() where id=f.id returning * into f;
  end if;
  return jsonb_build_object('status',f.status,'outgoing',f.requester=uid);
 end if;
 insert into public.friendships(requester,addressee) values(uid,other) returning * into f;
 return jsonb_build_object('status',f.status,'outgoing',true);
end $$;

-- Aceptar o rechazar una solicitud recibida. Solo quien la recibe.
create function public.social_friend_respond(request uuid, accept boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.social_user(); f public.friendships;
begin
 select * into f from public.friendships where id=request and addressee=uid and status='pending' for update;
 if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
 if accept then
  update public.friendships set status='accepted',responded_at=now() where id=f.id;
 else
  delete from public.friendships where id=f.id;
 end if;
 return jsonb_build_object('status',case when accept then 'accepted' else 'declined' end);
end $$;

-- Quitar una amistad o cancelar una solicitud enviada. Cualquiera de los dos lados; desde ese momento no ve nada.
create function public.social_friend_remove(friend uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.social_user();
begin
 delete from public.friendships f where least(f.requester,f.addressee)=least(uid,friend) and greatest(f.requester,f.addressee)=greatest(uid,friend);
 return jsonb_build_object('ok',true);
end $$;

-- Lo que ve la persona: su check-in, sus amistades (con el local SOLO si esa amistad está aceptada y la otra persona lo
-- comparte ahora) y las solicitudes. Nunca devuelve correos, teléfonos, pedidos ni historial.
create function public.social_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=private.social_user();
begin
 return jsonb_build_object(
  'me',(select jsonb_build_object('username',p.username,'name',p.full_name) from public.profiles p where p.user_id=uid),
  'checkin',(select jsonb_build_object('venueId',v.id,'venueName',v.name,'venueSlug',v.slug,'expiresAt',c.expires_at,'share',c.share_with_friends)
     from public.venue_checkins c join public.venues v on v.id=c.venue_id
     where c.user_id=uid and c.ended_at is null and c.expires_at>now() order by c.created_at desc limit 1),
  'friends',coalesce((select jsonb_agg(jsonb_build_object(
      'id',o.user_id,'username',o.username,'name',split_part(o.full_name,' ',1),
      'venue',(select jsonb_build_object('name',v.name,'slug',v.slug,'expiresAt',c.expires_at)
         from public.venue_checkins c join public.venues v on v.id=c.venue_id
         where c.user_id=o.user_id and c.share_with_friends and c.ended_at is null and c.expires_at>now()
         order by c.created_at desc limit 1)) order by o.username)
     from public.friendships f join public.profiles o on o.user_id=case when f.requester=uid then f.addressee else f.requester end
     where f.status='accepted' and uid in (f.requester,f.addressee)),'[]'::jsonb),
  'incoming',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'username',o.username,'name',split_part(o.full_name,' ',1)) order by f.created_at)
     from public.friendships f join public.profiles o on o.user_id=f.requester where f.addressee=uid and f.status='pending'),'[]'::jsonb),
  'outgoing',coalesce((select jsonb_agg(jsonb_build_object('id',o.user_id,'username',o.username) order by f.created_at)
     from public.friendships f join public.profiles o on o.user_id=f.addressee where f.requester=uid and f.status='pending'),'[]'::jsonb)
 );
end $$;

-- Mapa de actividad: locales con coordenadas y 5 o más personas con check-in activo. Solo el nivel, nunca el número.
create function public.venue_activity() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('venueId',v.id,'name',v.name,'slug',v.slug,'zone',v.zone,
    'latitude',v.latitude,'longitude',v.longitude,
    'level',case when a.people>=25 then 3 when a.people>=10 then 2 else 1 end) order by a.people desc, v.name),'[]'::jsonb)
 from (select c.venue_id, count(distinct c.user_id) as people from public.venue_checkins c
       where c.ended_at is null and c.expires_at>now() group by c.venue_id) a
 join public.venues v on v.id=a.venue_id
 where a.people>=5 and v.demo_listed and v.latitude is not null and v.longitude is not null;
$$;

revoke all on function private.social_user() from public, anon, authenticated;
revoke all on function public.social_checkin(jsonb), public.social_checkout(), public.social_share(boolean),
  public.social_friend_request(text), public.social_friend_respond(uuid,boolean), public.social_friend_remove(uuid),
  public.social_overview(), public.venue_activity() from public, anon;
grant execute on function public.social_checkin(jsonb), public.social_checkout(), public.social_share(boolean),
  public.social_friend_request(text), public.social_friend_respond(uuid,boolean), public.social_friend_remove(uuid),
  public.social_overview(), public.venue_activity() to authenticated;
