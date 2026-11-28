-- ONZA Social: rankings, bares desbloqueables, presencia con avatares, enviar un trago y Drink Stories. ADITIVA (R4).
--
-- Reutiliza lo ya existente: `venue_checkins` y `friendships` (027), el avatar y la economía (029/030). No duplica nada.
--
-- Decisiones de privacidad (todas con el valor MÁS RESERVADO por defecto):
-- * Ranking entre amigos: lo ven solo amistades ACEPTADAS entre sí (la amistad es el consentimiento).
-- * Ranking por bar: solo aparecen personas que activaron `show_in_rankings` (apagado por defecto) y solo se muestra el
--   usuario público, el nivel y el avatar. Por «visitas verificadas» (pedido entregado), nunca por check-in.
-- * Quién está en el bar: se ve a quien tiene un check-in ACTIVO con «compartir» encendido (switch maestro de 027) y cuya
--   privacidad de avatar lo permite (`everyone`, o `friends` si son amigos; `nobody` jamás). Nunca GPS, pedidos ni historial.
-- * Mapa de bares: «desbloquear» un bar exige al menos un pedido ENTREGADO allí (visita verificada), no un check-in.
-- * Enviar un trago: solo entre amistades aceptadas, ambas partes adultas (por fecha de nacimiento del perfil), solo en locales que
--   lo habilitaron. El pago y la creación del pedido NO están integrados todavía: el flujo queda en `awaiting_payment` y la
--   función global `social_gifts_available` está APAGADA hasta que el checkout lo soporte con aprobación explícita (cambia
--   montos y estados de pedido, que AGENTS.md reserva a una etapa autorizada).
-- * Drink Stories: media en bucket privado (migración 032), tags de local y de producto, vencen a las 24 h, se pueden reportar
--   (3 reportes las ocultan) y ONZA puede moderarlas. Solo cuentas adultas con perfil.
-- * Sin permisos directos para anon/authenticated sobre ninguna tabla nueva.

alter table public.economy_settings add column if not exists social_gifts_available boolean not null default false;

create table public.venue_social_settings(
 venue_id uuid primary key references public.venues(id),
 gifts_enabled boolean not null default false,
 stories_enabled boolean not null default true,
 updated_at timestamptz not null default now(),
 updated_by uuid
);
alter table public.venue_social_settings enable row level security;
revoke all on public.venue_social_settings from public,anon,authenticated;

create table private.drink_gifts(
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 venue_id uuid not null references public.venues(id),
 product_id uuid not null,
 message text not null default '' check(length(message)<=140),
 status text not null default 'awaiting_payment' check(status in ('awaiting_payment','pending','accepted','declined','expired','canceled','redeemed')),
 delivery_code_hash text,
 order_id uuid references public.orders(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '24 hours',
 responded_at timestamptz,
 check(sender_id<>recipient_id)
);
create index drink_gifts_recipient on private.drink_gifts(recipient_id,status,created_at desc);
create index drink_gifts_sender on private.drink_gifts(sender_id,status,created_at desc);

create table public.drink_stories(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 venue_id uuid not null references public.venues(id),
 product_id uuid,
 media_path text not null check(media_path ~ '^[0-9a-f-]{36}/story-[A-Za-z0-9_-]{1,64}\.(jpg|png|webp|mp4|webm)$'),
 media_type text not null check(media_type in ('image','video')),
 caption text not null default '' check(length(caption)<=200),
 visibility text not null default 'friends' check(visibility in ('friends','public')),
 hidden_at timestamptz,
 hidden_reason text,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '24 hours',
 unique(media_path)
);
create index drink_stories_venue on public.drink_stories(venue_id,created_at desc) where hidden_at is null;
create index drink_stories_user on public.drink_stories(user_id,created_at desc);
alter table public.drink_stories enable row level security;
revoke all on public.drink_stories from public,anon,authenticated;

create table private.story_reports(
 story_id uuid not null references public.drink_stories(id) on delete cascade,
 reporter_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check(length(btrim(reason)) between 3 and 200),
 created_at timestamptz not null default now(),
 primary key(story_id,reporter_id)
);
alter table private.drink_gifts enable row level security;
alter table private.story_reports enable row level security;
revoke all on private.drink_gifts,private.story_reports from public,anon,authenticated;

-- ---------------------------------------------------------------------------
-- Ayudas
-- ---------------------------------------------------------------------------

create function private.are_friends(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.friendships f where f.status='accepted' and ((f.requester=a and f.addressee=b) or (f.requester=b and f.addressee=a))) $$;

create function private.is_adult(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.user_id=p_user and p.birth_date<=(now() at time zone 'America/Costa_Rica')::date-interval '18 years') $$;

-- Cuántos estados de la métrica de logros: se agregan las historias.
create or replace function private.economy_metric(p_user uuid,p_metric text) returns integer language plpgsql stable security definer set search_path='' as $$
begin
 return case p_metric
  when 'orders' then (select count(*) from public.orders where customer_id=p_user and status='delivered')
  when 'venues' then (select count(*) from private.venue_visits where user_id=p_user)
  when 'checkins' then (select count(*) from public.venue_checkins where user_id=p_user)
  when 'friends' then (select count(*) from public.friendships where status='accepted' and p_user in (requester,addressee))
  when 'stories' then (select count(*) from public.drink_stories where user_id=p_user)
  when 'level' then private.level_for(coalesce((select xp from private.xp_totals where user_id=p_user),0))
  else 0 end;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Ranking entre amigos
-- ---------------------------------------------------------------------------

create function public.social_leaderboard_friends(metric text default 'xp') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=private.economy_user();
begin
 if metric not in ('xp','venues','achievements') then raise exception 'INVALID_INPUT'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('rank',x.rank,'me',x.user_id=uid,'value',x.value,'avatar',private.avatar_card(x.user_id)) order by x.rank)
  from (select s.user_id,s.value,rank() over(order by s.value desc) as rank
   from (select u.user_id,case metric
      when 'xp' then coalesce((select t.xp from private.xp_totals t where t.user_id=u.user_id),0)
      when 'venues' then (select count(*) from private.venue_visits v where v.user_id=u.user_id)
      else (select count(*) from private.user_achievements a where a.user_id=u.user_id) end as value
     from (select uid as user_id
           union select case when f.requester=uid then f.addressee else f.requester end
             from public.friendships f where f.status='accepted' and uid in (f.requester,f.addressee)) u) s) x),'[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- 2. Ranking por bar (solo quien lo activó; por visitas verificadas)
-- ---------------------------------------------------------------------------

create function public.venue_leaderboard(venue uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=private.economy_user();
begin
 if not exists(select 1 from public.venues v where v.id=venue and v.demo_listed) then raise exception 'NOT_FOUND'; end if;
 return jsonb_build_object('venue_id',venue,
  'participating',coalesce((select show_in_rankings from private.avatar_profiles where user_id=uid),false),
  'entries',coalesce((select jsonb_agg(jsonb_build_object('rank',x.rank,'me',x.user_id=uid,'visits',x.visit_count,'avatar',private.avatar_card(x.user_id)) order by x.rank)
   from (select vv.user_id,vv.visit_count,rank() over(order by vv.visit_count desc,vv.first_visit_at) as rank
    from private.venue_visits vv join private.avatar_profiles ap on ap.user_id=vv.user_id and ap.show_in_rankings
    where vv.venue_id=venue order by rank limit 20) x),'[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- 3. Mapa de bares desbloqueables
-- ---------------------------------------------------------------------------

create function public.social_bar_map() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=private.economy_user();
begin
 return jsonb_build_object(
  'unlocked',(select count(*) from private.venue_visits where user_id=uid),
  'total',(select count(*) from public.venues where demo_listed),
  'venues',coalesce((select jsonb_agg(jsonb_build_object('venueId',v.id,'slug',v.slug,'zone',v.zone,'latitude',v.latitude,'longitude',v.longitude,
      'unlocked',vv.user_id is not null,'name',case when vv.user_id is not null then v.name else null end,
      'visits',coalesce(vv.visit_count,0),'first_visit_at',vv.first_visit_at) order by (vv.user_id is null),v.name)
    from public.venues v left join private.venue_visits vv on vv.venue_id=v.id and vv.user_id=uid where v.demo_listed),'[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- 4. Quién está en el bar
-- ---------------------------------------------------------------------------

create function public.venue_presence(venue uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=private.economy_user(); total integer;
begin
 if not exists(select 1 from public.venues v where v.id=venue and v.demo_listed) then raise exception 'NOT_FOUND'; end if;
 select count(distinct user_id) into total from public.venue_checkins where venue_id=venue and ended_at is null and expires_at>now();
 return jsonb_build_object('venue_id',venue,
  'total_active',case when total>=5 then total else null end,
  'people',coalesce((select jsonb_agg(private.avatar_card(c.user_id) order by c.created_at desc)
   from (select distinct on (k.user_id) k.user_id,k.created_at from public.venue_checkins k
         left join private.avatar_profiles ap on ap.user_id=k.user_id
         where k.venue_id=venue and k.ended_at is null and k.expires_at>now()
          and (k.user_id=uid or (k.share_with_friends and coalesce(ap.presence,'friends')<>'nobody'
               and (coalesce(ap.presence,'friends')='everyone' or private.are_friends(uid,k.user_id))))
         order by k.user_id,k.created_at desc) c),'[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- Ajustes sociales por local (administración del local)
-- ---------------------------------------------------------------------------

create function public.venue_social_settings_get(venue uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.is_staff(venue,true) then raise exception 'NOT_AUTHORIZED'; end if;
 return coalesce((select to_jsonb(s) from public.venue_social_settings s where s.venue_id=venue),
  jsonb_build_object('venue_id',venue,'gifts_enabled',false,'stories_enabled',true));
end $$;

create function public.venue_social_settings_save(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v uuid; g boolean; s boolean;
begin
 begin v:=(input->>'venueId')::uuid; g:=coalesce((input->>'gifts_enabled')::boolean,false); s:=coalesce((input->>'stories_enabled')::boolean,true);
 exception when invalid_text_representation then raise exception 'INVALID_INPUT'; end;
 if auth.uid() is null or not private.is_staff(v,true) then raise exception 'NOT_AUTHORIZED'; end if;
 insert into public.venue_social_settings(venue_id,gifts_enabled,stories_enabled,updated_by) values(v,g,s,auth.uid())
 on conflict(venue_id) do update set gifts_enabled=excluded.gifts_enabled,stories_enabled=excluded.stories_enabled,updated_at=now(),updated_by=auth.uid();
 return jsonb_build_object('venue_id',v,'gifts_enabled',g,'stories_enabled',s);
end $$;

-- ---------------------------------------------------------------------------
-- 5. Enviar un trago
-- ---------------------------------------------------------------------------

create function private.gift_sweep() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 update private.drink_gifts set status='expired',responded_at=now() where status in ('awaiting_payment','pending') and expires_at<=now();
 get diagnostics n=row_count;
 return n;
end $$;

create function public.gift_propose(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.economy_user(); rcpt uuid; v uuid; prod uuid; msg text:=btrim(coalesce(input->>'message','')); g private.drink_gifts;
begin
 if not (select social_gifts_available from public.economy_settings) then raise exception 'GIFTS_NOT_AVAILABLE'; end if;
 begin rcpt:=(input->>'recipientId')::uuid; v:=(input->>'venueId')::uuid; prod:=(input->>'productId')::uuid;
 exception when invalid_text_representation then raise exception 'INVALID_INPUT'; end;
 if length(msg)>140 then raise exception 'INVALID_INPUT'; end if;
 if rcpt=uid then raise exception 'INVALID_INPUT'; end if;
 if not coalesce((select gifts_enabled from public.venue_social_settings where venue_id=v),false) then raise exception 'VENUE_GIFTS_DISABLED'; end if;
 if not private.are_friends(uid,rcpt) then raise exception 'NOT_FRIENDS'; end if;
 if not private.is_adult(uid) or not private.is_adult(rcpt) then raise exception 'ADULT_REQUIRED'; end if;
 if not exists(select 1 from public.products p where p.id=prod and p.venue_id=v and p.available) then raise exception 'PRODUCT_NOT_AVAILABLE'; end if;
 if not private.limit_action('gift_propose',10) then raise exception 'RATE_LIMITED'; end if;
 perform private.gift_sweep();
 if (select count(*) from private.drink_gifts where sender_id=uid and status in ('awaiting_payment','pending')) >= 3 then raise exception 'TOO_MANY_PENDING'; end if;
 insert into private.drink_gifts(sender_id,recipient_id,venue_id,product_id,message) values(uid,rcpt,v,prod,msg) returning * into g;
 return jsonb_build_object('id',g.id,'status',g.status,'expires_at',g.expires_at);
end $$;

-- Solo servidor (service_role), tras cobrar al remitente con el checkout. Hoy nada lo llama.
create function public.gift_mark_paid(gift uuid,order_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare g private.drink_gifts;
begin
 select * into g from private.drink_gifts where id=gift for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if g.status<>'awaiting_payment' then raise exception 'GIFT_NOT_AWAITING_PAYMENT'; end if;
 update private.drink_gifts set status='pending',order_id=gift_mark_paid.order_id where id=gift;
 return jsonb_build_object('id',gift,'status','pending');
end $$;

create function public.gift_respond(gift uuid,accept boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.economy_user(); g private.drink_gifts; code text;
begin
 perform private.gift_sweep();
 select * into g from private.drink_gifts where id=gift and recipient_id=uid for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if g.status<>'pending' then raise exception 'GIFT_NOT_PENDING'; end if;
 if not accept then
  update private.drink_gifts set status='declined',responded_at=now() where id=gift;
  return jsonb_build_object('id',gift,'status','declined');
 end if;
 if not private.is_adult(uid) then raise exception 'ADULT_REQUIRED'; end if;
 code:=lpad((floor(random()*1000000))::int::text,6,'0');
 update private.drink_gifts set status='accepted',responded_at=now(),delivery_code_hash=encode(sha256(convert_to(gift::text||':'||code,'UTF8')),'hex') where id=gift;
 perform private.economy_event(g.sender_id,'gift_sent',gift::text,g.venue_id);
 perform private.economy_event(uid,'gift_received',gift::text,g.venue_id);
 return jsonb_build_object('id',gift,'status','accepted','delivery_code',code,'venue_id',g.venue_id);
end $$;

create function public.gift_cancel(gift uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.economy_user(); g private.drink_gifts;
begin
 select * into g from private.drink_gifts where id=gift and sender_id=uid for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if g.status not in ('awaiting_payment','pending') then raise exception 'GIFT_NOT_CANCELABLE'; end if;
 update private.drink_gifts set status='canceled',responded_at=now() where id=gift;
 return jsonb_build_object('id',gift,'status','canceled');
end $$;

create function public.gift_overview() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.economy_user();
begin
 perform private.gift_sweep();
 return jsonb_build_object('available',(select social_gifts_available from public.economy_settings),
  'received',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'status',g.status,'message',g.message,'venue_id',g.venue_id,'product_id',g.product_id,
     'from',private.avatar_card(g.sender_id),'expires_at',g.expires_at,'created_at',g.created_at) order by g.created_at desc)
    from (select * from private.drink_gifts where recipient_id=uid and status in ('pending','accepted') order by created_at desc limit 30) g),'[]'::jsonb),
  'sent',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'status',g.status,'message',g.message,'venue_id',g.venue_id,'product_id',g.product_id,
     'to',private.avatar_card(g.recipient_id),'expires_at',g.expires_at,'created_at',g.created_at) order by g.created_at desc)
    from (select * from private.drink_gifts where sender_id=uid order by created_at desc limit 30) g),'[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- 6. Drink Stories
-- ---------------------------------------------------------------------------

create function private.story_visible_to(p_story public.drink_stories,p_viewer uuid) returns boolean language sql stable security definer set search_path='' as $$
 select p_story.hidden_at is null and p_story.expires_at>now() and (p_story.user_id=p_viewer or p_story.visibility='public'
  or (p_story.visibility='friends' and private.are_friends(p_story.user_id,p_viewer))) $$;

-- Para la política de Storage: ¿puede esta persona leer este archivo?
create function private.story_path_visible(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.drink_stories s where s.media_path=p_path and private.story_visible_to(s,auth.uid())) $$;

create function public.story_create(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.economy_user(); v uuid; prod uuid; path text:=input->>'mediaPath'; mtype text:=input->>'mediaType';
 cap text:=btrim(coalesce(input->>'caption','')); vis text:=coalesce(input->>'visibility','friends'); s public.drink_stories; ext text;
begin
 if not private.is_adult(uid) then raise exception 'ADULT_REQUIRED'; end if;
 begin v:=(input->>'venueId')::uuid; prod:=nullif(input->>'productId','')::uuid; exception when invalid_text_representation then raise exception 'INVALID_INPUT'; end;
 if path is null or split_part(path,'/',1)<>uid::text or mtype not in ('image','video') or vis not in ('friends','public') or length(cap)>200 then raise exception 'INVALID_INPUT'; end if;
 ext:=lower(substring(path from '\.([a-z0-9]+)$'));
 if (mtype='image' and ext not in ('jpg','png','webp')) or (mtype='video' and ext not in ('mp4','webm')) then raise exception 'INVALID_INPUT'; end if;
 if not exists(select 1 from public.venues x where x.id=v and x.demo_listed) then raise exception 'NOT_FOUND'; end if;
 if not coalesce((select stories_enabled from public.venue_social_settings where venue_id=v),true) then raise exception 'VENUE_STORIES_DISABLED'; end if;
 if prod is not null and not exists(select 1 from public.products p where p.id=prod and p.venue_id=v) then raise exception 'PRODUCT_NOT_FOUND'; end if;
 if not private.limit_action('story_create',10) then raise exception 'RATE_LIMITED'; end if;
 begin
  insert into public.drink_stories(user_id,venue_id,product_id,media_path,media_type,caption,visibility) values(uid,v,prod,path,mtype,cap,vis) returning * into s;
 exception when unique_violation then raise exception 'ALREADY_EXISTS'; when check_violation then raise exception 'INVALID_INPUT'; end;
 perform private.economy_event(uid,'story_posted',s.id::text,v);
 perform private.economy_achievements(uid);
 return jsonb_build_object('id',s.id,'expires_at',s.expires_at);
end $$;

create function public.story_feed(input jsonb default '{}'::jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=private.economy_user(); scope text:=coalesce(input->>'scope','friends'); v uuid;
begin
 if scope not in ('friends','venue') then raise exception 'INVALID_INPUT'; end if;
 begin v:=nullif(input->>'venueId','')::uuid; exception when invalid_text_representation then raise exception 'INVALID_INPUT'; end;
 if scope='venue' and v is null then raise exception 'INVALID_INPUT'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'mine',s.user_id=uid,'author',private.avatar_card(s.user_id),'venue_id',s.venue_id,
    'venue_slug',ve.slug,'venue_name',ve.name,'product_id',s.product_id,'product_link',case when s.product_id is null then null else '/v/'||ve.slug||'/p/'||s.product_id::text end,
    'media_path',s.media_path,'media_type',s.media_type,'caption',s.caption,'created_at',s.created_at,'expires_at',s.expires_at) order by s.created_at desc)
  from (select st.* from public.drink_stories st
        where private.story_visible_to(st,uid)
          and ((scope='friends' and (st.user_id=uid or private.are_friends(st.user_id,uid)))
            or (scope='venue' and st.venue_id=v and st.visibility='public'))
        order by st.created_at desc limit 50) s join public.venues ve on ve.id=s.venue_id),'[]'::jsonb);
end $$;

create function public.story_delete(story uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.economy_user();
begin
 delete from public.drink_stories where id=story and user_id=uid;
 if not found then raise exception 'NOT_FOUND'; end if;
 return jsonb_build_object('id',story,'deleted',true);
end $$;

create function public.story_report(story uuid,reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.economy_user(); s public.drink_stories; n integer;
begin
 select * into s from public.drink_stories where id=story;
 if not found or not private.story_visible_to(s,uid) or s.user_id=uid then raise exception 'NOT_FOUND'; end if;
 begin insert into private.story_reports(story_id,reporter_id,reason) values(story,uid,btrim(reason));
 exception when check_violation then raise exception 'INVALID_INPUT'; when unique_violation then return jsonb_build_object('id',story,'reported',true,'replayed',true); end;
 select count(*) into n from private.story_reports where story_id=story;
 if n>=3 then update public.drink_stories set hidden_at=coalesce(hidden_at,now()),hidden_reason=coalesce(hidden_reason,'reportes') where id=story; end if;
 return jsonb_build_object('id',story,'reported',true,'hidden',n>=3);
end $$;

create function public.story_moderate(story uuid,hide boolean,reason text default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_onza();
 update public.drink_stories set hidden_at=case when hide then coalesce(hidden_at,now()) else null end,hidden_reason=case when hide then coalesce(nullif(btrim(reason),''),'moderación') else null end where id=story;
 if not found then raise exception 'NOT_FOUND'; end if;
 insert into private.economy_audit_log(actor_id,entity,entity_key,action,after_state) values(auth.uid(),'drink_stories',story::text,case when hide then 'hide' else 'unhide' end,jsonb_build_object('reason',reason));
 return jsonb_build_object('id',story,'hidden',hide);
end $$;

create function public.story_admin_reports() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_onza();
 return coalesce((select jsonb_agg(jsonb_build_object('story_id',s.id,'venue_id',s.venue_id,'media_path',s.media_path,'caption',s.caption,'hidden',s.hidden_at is not null,
   'reports',r.n,'reasons',r.reasons,'created_at',s.created_at) order by r.n desc,s.created_at desc)
  from public.drink_stories s join (select story_id,count(*) n,jsonb_agg(reason) reasons from private.story_reports group by story_id) r on r.story_id=s.id),'[]'::jsonb);
end $$;

-- Permisos de ejecución.
revoke execute on function public.social_leaderboard_friends(text),public.venue_leaderboard(uuid),public.social_bar_map(),public.venue_presence(uuid),
 public.venue_social_settings_get(uuid),public.venue_social_settings_save(jsonb),public.gift_propose(jsonb),public.gift_mark_paid(uuid,uuid),
 public.gift_respond(uuid,boolean),public.gift_cancel(uuid),public.gift_overview(),public.story_create(jsonb),public.story_feed(jsonb),
 public.story_delete(uuid),public.story_report(uuid,text),public.story_moderate(uuid,boolean,text),public.story_admin_reports() from public,anon;
grant execute on function public.social_leaderboard_friends(text),public.venue_leaderboard(uuid),public.social_bar_map(),public.venue_presence(uuid),
 public.venue_social_settings_get(uuid),public.venue_social_settings_save(jsonb),public.gift_propose(jsonb),
 public.gift_respond(uuid,boolean),public.gift_cancel(uuid),public.gift_overview(),public.story_create(jsonb),public.story_feed(jsonb),
 public.story_delete(uuid),public.story_report(uuid,text),public.story_moderate(uuid,boolean,text),public.story_admin_reports() to authenticated;
revoke execute on function public.gift_mark_paid(uuid,uuid) from authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  grant execute on function public.gift_mark_paid(uuid,uuid) to service_role;
 end if;
end $$;

do $$ declare f regprocedure; begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname in ('are_friends','is_adult','economy_metric','gift_sweep','story_visible_to','story_path_visible') loop
  execute format('revoke execute on function %s from public,anon,authenticated',f);
 end loop;
end $$;
