-- Economía de ONZA: Avatar Coins y XP. ADITIVA (R4): tablas, funciones y dos triggers nuevos; nada anterior se edita.
--
-- Tres sistemas INDEPENDIENTES (cada uno con saldo, libro y reglas propias; ninguno se convierte en otro):
--   1. Cashback (028): puntos con valor monetario (1 punto = ₡1), financiados por cada local.
--   2. Avatar Coins (esta migración): moneda virtual solo para artículos digitales. No convertible a efectivo.
--   3. XP (esta migración): experiencia para niveles, logros y rankings. Sin valor monetario ni intercambiable.
--
-- Reglas de diseño:
-- * Libros APPEND-ONLY (update/delete bloqueados por trigger) con saldo posterior en cada asiento y clave de idempotencia
--   única por persona: repetir un evento nunca premia dos veces.
-- * Se gana al ENTREGAR el pedido (visita verificada = pedido entregado, no un check-in voluntario) y se revierte al
--   reembolsar. Nada de esto toca montos, estados ni permisos de pedidos: solo dos triggers nuevos de lectura/abono.
-- * Anti-exceso de alcohol: tope de pedidos premiados por día, separación mínima entre pedidos premiados, tope de importe
--   que cuenta para premio y topes diarios de monedas y XP. Al limitar se deja una señal de revisión (economy_flags).
-- * Comprar paquetes con dinero real NO acredita nada por sí solo: la compra nace `pending` y solo la ruta de servidor
--   (service_role), tras confirmar el proveedor de pagos, la liquida. Hoy el proveedor es mock; BAC no está habilitado.
-- * Configuración solo por RPC de administración de ONZA, con registro de cambios (antes/después).
-- * Sin permisos directos para anon/authenticated sobre ninguna tabla nueva.

-- ---------------------------------------------------------------------------
-- Configuración
-- ---------------------------------------------------------------------------

create table public.economy_settings(
 id boolean primary key default true check(id),
 crc_per_coin integer not null default 500 check(crc_per_coin>0),
 max_order_reward_minor integer not null default 2000000 check(max_order_reward_minor>=0),
 max_rewarded_orders_per_day integer not null default 2 check(max_rewarded_orders_per_day>=0),
 min_minutes_between_rewarded integer not null default 90 check(min_minutes_between_rewarded>=0),
 xp_per_order integer not null default 10 check(xp_per_order>=0),
 daily_coin_cap integer not null default 40 check(daily_coin_cap>=0),
 daily_xp_cap integer not null default 100 check(daily_xp_cap>=0),
 coin_purchases_enabled boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by uuid
);
insert into public.economy_settings(id) values(true);

create table public.economy_event_rules(
 kind text primary key check(kind in ('first_visit','checkin','friend_accepted','story_posted','gift_sent','gift_received')),
 coins integer not null default 0 check(coins>=0),
 xp integer not null default 0 check(xp>=0),
 daily_cap integer not null default 1 check(daily_cap>=0),
 enabled boolean not null default true
);
insert into public.economy_event_rules(kind,coins,xp,daily_cap) values
 ('first_visit',10,25,3),('checkin',1,5,2),('friend_accepted',2,10,5),('story_posted',2,5,3),('gift_sent',3,10,2),('gift_received',1,5,3);

create table public.economy_campaigns(
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 2 and 80),
 venue_id uuid references public.venues(id),
 coin_multiplier numeric(4,2) not null default 1 check(coin_multiplier between 1 and 5),
 xp_multiplier numeric(4,2) not null default 1 check(xp_multiplier between 1 and 5),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 enabled boolean not null default true,
 created_at timestamptz not null default now(),
 check(ends_at>starts_at)
);

create table public.levels(
 level integer primary key check(level>=1),
 xp_required bigint not null check(xp_required>=0),
 title text not null check(length(btrim(title)) between 1 and 40)
);
insert into public.levels(level,xp_required,title) values
 (1,0,'Nivel 1'),(2,50,'Nivel 2'),(3,150,'Nivel 3'),(4,300,'Nivel 4'),(5,500,'Nivel 5'),
 (6,800,'Nivel 6'),(7,1200,'Nivel 7'),(8,1800,'Nivel 8'),(9,2600,'Nivel 9'),(10,3600,'Nivel 10');

create table public.achievements(
 id uuid primary key default gen_random_uuid(),
 code text not null unique check(code ~ '^[a-z0-9_]{3,40}$'),
 name text not null check(length(btrim(name)) between 2 and 60),
 description text not null default '' check(length(description)<=200),
 metric text not null check(metric in ('orders','venues','checkins','friends','stories','level')),
 threshold integer not null check(threshold>0),
 reward_coins integer not null default 0 check(reward_coins>=0),
 reward_xp integer not null default 0 check(reward_xp>=0),
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
insert into public.achievements(code,name,description,metric,threshold,reward_coins,reward_xp) values
 ('primer_pedido','Primer pedido','Entregaste tu primer pedido.','orders',1,5,20),
 ('explorador_3','Explorador','Visitaste 3 bares distintos.','venues',3,10,40),
 ('habitue_10','De la casa','Diez pedidos entregados.','orders',10,15,60),
 ('social_3','Con compañía','Tenés 3 amistades.','friends',3,5,30);

create table public.coin_packages(
 id uuid primary key default gen_random_uuid(),
 code text not null unique check(code ~ '^[a-z0-9_]{3,30}$'),
 name text not null check(length(btrim(name)) between 2 and 60),
 coins integer not null check(coins>0),
 bonus_coins integer not null default 0 check(bonus_coins>=0),
 price_minor integer not null check(price_minor>0),
 currency text not null default 'CRC' check(currency='CRC'),
 enabled boolean not null default false,
 sort integer not null default 0,
 created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Libros (privados, append-only)
-- ---------------------------------------------------------------------------

create table private.coin_balances(
 user_id uuid primary key references auth.users(id) on delete cascade,
 balance integer not null default 0 check(balance>=0),
 updated_at timestamptz not null default now()
);
create table private.coin_ledger(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('earn','purchase','spend','revoke','adjust')),
 amount integer not null check(amount<>0),
 balance_after integer not null check(balance_after>=0),
 reason text not null,
 source_type text not null,
 source_id text,
 venue_id uuid references public.venues(id),
 idempotency_key text not null,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 unique(user_id,idempotency_key),
 check(kind='adjust' or ((kind in ('earn','purchase'))=(amount>0)))
);
create index coin_ledger_user on private.coin_ledger(user_id,created_at desc);

create table private.xp_totals(
 user_id uuid primary key references auth.users(id) on delete cascade,
 xp bigint not null default 0 check(xp>=0),
 updated_at timestamptz not null default now()
);
create table private.xp_ledger(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('earn','revoke','adjust')),
 amount integer not null check(amount<>0),
 total_after bigint not null check(total_after>=0),
 reason text not null,
 source_type text not null,
 source_id text,
 venue_id uuid references public.venues(id),
 idempotency_key text not null,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 unique(user_id,idempotency_key),
 check(kind='adjust' or ((kind='earn')=(amount>0)))
);
create index xp_ledger_user on private.xp_ledger(user_id,created_at desc);
create index xp_ledger_venue on private.xp_ledger(venue_id,created_at desc) where venue_id is not null;

create table private.venue_visits(
 user_id uuid not null references auth.users(id) on delete cascade,
 venue_id uuid not null references public.venues(id),
 first_visit_at timestamptz not null default now(),
 last_visit_at timestamptz not null default now(),
 visit_count integer not null default 1 check(visit_count>=1),
 primary key(user_id,venue_id)
);
create table private.order_rewards(
 order_id uuid primary key references public.orders(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 venue_id uuid not null references public.venues(id),
 coins integer not null default 0 check(coins>=0),
 xp integer not null default 0 check(xp>=0),
 rewarded_at timestamptz not null default now(),
 reversed_at timestamptz
);
create index order_rewards_user on private.order_rewards(user_id,rewarded_at desc);
create table private.user_achievements(
 user_id uuid not null references auth.users(id) on delete cascade,
 achievement_id uuid not null references public.achievements(id),
 unlocked_at timestamptz not null default now(),
 primary key(user_id,achievement_id)
);
create table private.coin_purchases(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 package_id uuid not null references public.coin_packages(id),
 package_code text not null,
 coins integer not null check(coins>0),
 price_minor integer not null check(price_minor>0),
 status text not null default 'pending' check(status in ('pending','paid','failed','refunded')),
 provider text,
 provider_ref text,
 idempotency_key text not null,
 created_at timestamptz not null default now(),
 paid_at timestamptz,
 refunded_at timestamptz,
 unique(user_id,idempotency_key)
);
create table private.economy_flags(
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users(id) on delete cascade,
 kind text not null check(kind in ('daily_cap','order_reward_limited','reversal_shortfall','purchase_refund_shortfall','trigger_error')),
 details jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create index economy_flags_recent on private.economy_flags(created_at desc);
create table private.economy_audit_log(
 id uuid primary key default gen_random_uuid(),
 actor_id uuid,
 entity text not null,
 entity_key text not null,
 action text not null,
 before_state jsonb,
 after_state jsonb,
 created_at timestamptz not null default now()
);

alter table public.economy_settings enable row level security;
alter table public.economy_event_rules enable row level security;
alter table public.economy_campaigns enable row level security;
alter table public.levels enable row level security;
alter table public.achievements enable row level security;
alter table public.coin_packages enable row level security;
alter table private.coin_balances enable row level security;
alter table private.coin_ledger enable row level security;
alter table private.xp_totals enable row level security;
alter table private.xp_ledger enable row level security;
alter table private.venue_visits enable row level security;
alter table private.order_rewards enable row level security;
alter table private.user_achievements enable row level security;
alter table private.coin_purchases enable row level security;
alter table private.economy_flags enable row level security;
alter table private.economy_audit_log enable row level security;
revoke all on public.economy_settings,public.economy_event_rules,public.economy_campaigns,public.levels,public.achievements,public.coin_packages from public,anon,authenticated;
revoke all on private.coin_balances,private.coin_ledger,private.xp_totals,private.xp_ledger,private.venue_visits,private.order_rewards,
 private.user_achievements,private.coin_purchases,private.economy_flags,private.economy_audit_log from public,anon,authenticated;

create function private.economy_append_only() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'APPEND_ONLY'; end $$;
create trigger coin_ledger_append_only before update or delete on private.coin_ledger for each row execute function private.economy_append_only();
create trigger xp_ledger_append_only before update or delete on private.xp_ledger for each row execute function private.economy_append_only();
create trigger economy_audit_append_only before update or delete on private.economy_audit_log for each row execute function private.economy_append_only();

-- Registro de cambios de configuración.
create function private.economy_log_config() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb:=to_jsonb(new);
begin
 insert into private.economy_audit_log(actor_id,entity,entity_key,action,before_state,after_state)
 values(auth.uid(),TG_TABLE_NAME,coalesce(r->>'id',r->>'kind',r->>'level',r->>'code','settings'),lower(TG_OP),
  case when TG_OP='INSERT' then null else to_jsonb(old) end,r);
 return null;
end $$;
create trigger economy_settings_log after insert or update on public.economy_settings for each row execute function private.economy_log_config();
create trigger economy_event_rules_log after insert or update on public.economy_event_rules for each row execute function private.economy_log_config();
create trigger economy_campaigns_log after insert or update on public.economy_campaigns for each row execute function private.economy_log_config();
create trigger levels_log after insert or update on public.levels for each row execute function private.economy_log_config();
create trigger achievements_log after insert or update on public.achievements for each row execute function private.economy_log_config();
create trigger coin_packages_log after insert or update on public.coin_packages for each row execute function private.economy_log_config();

-- ---------------------------------------------------------------------------
-- Quién participa: una cuenta de cliente con perfil (no invitada, no del equipo). Devuelve su id.
-- ---------------------------------------------------------------------------

create function private.economy_user() returns uuid language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'SESSION_REQUIRED'; end if;
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'ACCOUNT_REQUIRED'; end if;
 if exists(select 1 from public.memberships m where m.user_id=uid) or exists(select 1 from public.staff_accounts s where s.user_id=uid) then
  raise exception 'STAFF_NOT_PLAYER';
 end if;
 if not exists(select 1 from public.profiles p where p.user_id=uid) then raise exception 'ONBOARDING_REQUIRED'; end if;
 return uid;
end $$;

create function private.cr_today() returns date language sql stable set search_path='' as $$
 select (now() at time zone 'America/Costa_Rica')::date $$;

-- ---------------------------------------------------------------------------
-- Operaciones de los libros
-- ---------------------------------------------------------------------------

-- Abona monedas. Devuelve lo realmente abonado (0 si ya existía la clave o el tope diario lo impide).
create function private.coin_grant(p_user uuid,p_amount integer,p_kind text,p_reason text,p_source_type text,p_source_id text,
 p_key text,p_venue uuid default null,p_capped boolean default false,p_meta jsonb default '{}') returns integer
 language plpgsql security definer set search_path='' as $$
declare bal integer; allowed integer:=p_amount; cap integer; earned integer;
begin
 if p_amount<=0 then return 0; end if;
 insert into private.coin_balances(user_id) values(p_user) on conflict do nothing;
 select balance into bal from private.coin_balances where user_id=p_user for update;
 if exists(select 1 from private.coin_ledger where user_id=p_user and idempotency_key=p_key) then return 0; end if;
 if p_capped then
  select daily_coin_cap into cap from public.economy_settings;
  select coalesce(sum(amount),0) into earned from private.coin_ledger
   where user_id=p_user and kind='earn' and (metadata->>'capped')='true' and (created_at at time zone 'America/Costa_Rica')::date=private.cr_today();
  allowed:=greatest(least(p_amount,cap-earned),0);
  if allowed<p_amount then
   insert into private.economy_flags(user_id,kind,details) values(p_user,'daily_cap',jsonb_build_object('currency','coins','wanted',p_amount,'granted',allowed,'source',p_source_type));
  end if;
  if allowed=0 then return 0; end if;
 end if;
 update private.coin_balances set balance=balance+allowed,updated_at=now() where user_id=p_user;
 insert into private.coin_ledger(user_id,kind,amount,balance_after,reason,source_type,source_id,venue_id,idempotency_key,metadata)
 values(p_user,p_kind,allowed,bal+allowed,p_reason,p_source_type,p_source_id,p_venue,p_key,p_meta||jsonb_build_object('capped',p_capped));
 return allowed;
end $$;

-- Gasta monedas (artículos digitales). Falla sin saldo; repetir la clave no gasta dos veces (devuelve false).
create function private.coin_spend(p_user uuid,p_amount integer,p_reason text,p_source_type text,p_source_id text,p_key text,p_meta jsonb default '{}')
 returns boolean language plpgsql security definer set search_path='' as $$
declare bal integer;
begin
 if p_amount<=0 then raise exception 'INVALID_AMOUNT'; end if;
 insert into private.coin_balances(user_id) values(p_user) on conflict do nothing;
 select balance into bal from private.coin_balances where user_id=p_user for update;
 if exists(select 1 from private.coin_ledger where user_id=p_user and idempotency_key=p_key) then return false; end if;
 if bal<p_amount then raise exception 'INSUFFICIENT_COINS'; end if;
 update private.coin_balances set balance=balance-p_amount,updated_at=now() where user_id=p_user;
 insert into private.coin_ledger(user_id,kind,amount,balance_after,reason,source_type,source_id,idempotency_key,metadata)
 values(p_user,'spend',-p_amount,bal-p_amount,p_reason,p_source_type,p_source_id,p_key,p_meta);
 return true;
end $$;

-- Revierte lo ganado o comprado hasta donde alcance el saldo; si no alcanza, deja señal de revisión. Devuelve lo revertido.
create function private.coin_revoke(p_user uuid,p_amount integer,p_reason text,p_source_type text,p_source_id text,p_key text) returns integer
 language plpgsql security definer set search_path='' as $$
declare bal integer; taken integer;
begin
 if p_amount<=0 then return 0; end if;
 insert into private.coin_balances(user_id) values(p_user) on conflict do nothing;
 select balance into bal from private.coin_balances where user_id=p_user for update;
 if exists(select 1 from private.coin_ledger where user_id=p_user and idempotency_key=p_key) then return 0; end if;
 taken:=least(p_amount,bal);
 if taken<p_amount then
  insert into private.economy_flags(user_id,kind,details) values(p_user,'reversal_shortfall',jsonb_build_object('currency','coins','wanted',p_amount,'revoked',taken,'source',p_source_type,'source_id',p_source_id));
 end if;
 if taken=0 then return 0; end if;
 update private.coin_balances set balance=balance-taken,updated_at=now() where user_id=p_user;
 insert into private.coin_ledger(user_id,kind,amount,balance_after,reason,source_type,source_id,idempotency_key)
 values(p_user,'revoke',-taken,bal-taken,p_reason,p_source_type,p_source_id,p_key);
 return taken;
end $$;

create function private.xp_grant(p_user uuid,p_amount integer,p_reason text,p_source_type text,p_source_id text,p_key text,
 p_venue uuid default null,p_capped boolean default false) returns integer language plpgsql security definer set search_path='' as $$
declare tot bigint; allowed integer:=p_amount; cap integer; earned integer;
begin
 if p_amount<=0 then return 0; end if;
 insert into private.xp_totals(user_id) values(p_user) on conflict do nothing;
 select xp into tot from private.xp_totals where user_id=p_user for update;
 if exists(select 1 from private.xp_ledger where user_id=p_user and idempotency_key=p_key) then return 0; end if;
 if p_capped then
  select daily_xp_cap into cap from public.economy_settings;
  select coalesce(sum(amount),0) into earned from private.xp_ledger
   where user_id=p_user and kind='earn' and (metadata->>'capped')='true' and (created_at at time zone 'America/Costa_Rica')::date=private.cr_today();
  allowed:=greatest(least(p_amount,cap-earned),0);
  if allowed<p_amount then
   insert into private.economy_flags(user_id,kind,details) values(p_user,'daily_cap',jsonb_build_object('currency','xp','wanted',p_amount,'granted',allowed,'source',p_source_type));
  end if;
  if allowed=0 then return 0; end if;
 end if;
 update private.xp_totals set xp=xp+allowed,updated_at=now() where user_id=p_user;
 insert into private.xp_ledger(user_id,kind,amount,total_after,reason,source_type,source_id,venue_id,idempotency_key,metadata)
 values(p_user,'earn',allowed,tot+allowed,p_reason,p_source_type,p_source_id,p_venue,p_key,jsonb_build_object('capped',p_capped));
 return allowed;
end $$;

create function private.xp_revoke(p_user uuid,p_amount integer,p_reason text,p_source_type text,p_source_id text,p_key text) returns integer
 language plpgsql security definer set search_path='' as $$
declare tot bigint; taken integer;
begin
 if p_amount<=0 then return 0; end if;
 insert into private.xp_totals(user_id) values(p_user) on conflict do nothing;
 select xp into tot from private.xp_totals where user_id=p_user for update;
 if exists(select 1 from private.xp_ledger where user_id=p_user and idempotency_key=p_key) then return 0; end if;
 taken:=least(p_amount,tot);
 if taken=0 then return 0; end if;
 update private.xp_totals set xp=xp-taken,updated_at=now() where user_id=p_user;
 insert into private.xp_ledger(user_id,kind,amount,total_after,reason,source_type,source_id,idempotency_key)
 values(p_user,'revoke',-taken,tot-taken,p_reason,p_source_type,p_source_id,p_key);
 return taken;
end $$;

create function private.level_for(p_xp bigint) returns integer language sql stable set search_path='' as $$
 select coalesce(max(level),1) from public.levels where xp_required<=p_xp $$;

-- ---------------------------------------------------------------------------
-- Logros
-- ---------------------------------------------------------------------------

create function private.economy_metric(p_user uuid,p_metric text) returns integer language plpgsql stable security definer set search_path='' as $$
begin
 return case p_metric
  when 'orders' then (select count(*) from public.orders where customer_id=p_user and status='delivered')
  when 'venues' then (select count(*) from private.venue_visits where user_id=p_user)
  when 'checkins' then (select count(*) from public.venue_checkins where user_id=p_user)
  when 'friends' then (select count(*) from public.friendships where status='accepted' and p_user in (requester,addressee))
  when 'level' then private.level_for(coalesce((select xp from private.xp_totals where user_id=p_user),0))
  else 0 end;
end $$;

create function private.economy_achievements(p_user uuid) returns integer language plpgsql security definer set search_path='' as $$
declare a public.achievements; n integer:=0;
begin
 for a in select * from public.achievements x where x.enabled and not exists(select 1 from private.user_achievements u where u.user_id=p_user and u.achievement_id=x.id) loop
  if private.economy_metric(p_user,a.metric)>=a.threshold then
   insert into private.user_achievements(user_id,achievement_id) values(p_user,a.id) on conflict do nothing;
   if found then
    perform private.coin_grant(p_user,a.reward_coins,'earn','Logro: '||a.name,'achievement',a.id::text,'ach:'||a.id::text);
    perform private.xp_grant(p_user,a.reward_xp,'Logro: '||a.name,'achievement',a.id::text,'ach:'||a.id::text);
    n:=n+1;
   end if;
  end if;
 end loop;
 return n;
end $$;

-- ---------------------------------------------------------------------------
-- Ganar por eventos sociales y por pedidos
-- ---------------------------------------------------------------------------

create function private.economy_event(p_user uuid,p_kind text,p_ref text,p_venue uuid default null) returns void
 language plpgsql security definer set search_path='' as $$
declare r public.economy_event_rules; done integer;
begin
 select * into r from public.economy_event_rules where kind=p_kind and enabled;
 if not found then return; end if;
 select count(*) into done from private.xp_ledger
  where user_id=p_user and source_type='event:'||p_kind and kind='earn' and (created_at at time zone 'America/Costa_Rica')::date=private.cr_today();
 if done>=r.daily_cap then return; end if;
 perform private.coin_grant(p_user,r.coins,'earn','Actividad: '||p_kind,'event:'||p_kind,p_ref,p_kind||':'||p_ref,p_venue,true);
 perform private.xp_grant(p_user,r.xp,'Actividad: '||p_kind,'event:'||p_kind,p_ref,p_kind||':'||p_ref,p_venue,true);
 perform private.economy_achievements(p_user);
end $$;

-- Pedido entregado: visita verificada + monedas y XP, con topes anti-exceso. Idempotente por pedido.
create function private.economy_award_order(p_order uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; s public.economy_settings; today integer; last_at timestamptz; base integer; cm numeric:=1; xm numeric:=1;
 v_coins integer:=0; v_xp integer:=0; new_visit boolean; limited boolean:=false;
begin
 select * into o from public.orders where id=p_order and status='delivered';
 if not found then return; end if;
 if not exists(select 1 from public.profiles where user_id=o.customer_id) then return; end if;
 if exists(select 1 from private.order_rewards where order_id=p_order) then return; end if;
 select * into s from public.economy_settings;
 new_visit:=not exists(select 1 from private.venue_visits where user_id=o.customer_id and venue_id=o.venue_id);
 insert into private.venue_visits(user_id,venue_id) values(o.customer_id,o.venue_id)
  on conflict(user_id,venue_id) do update set last_visit_at=now(),visit_count=private.venue_visits.visit_count+1;
 select count(*),max(rewarded_at) into today,last_at from private.order_rewards
  where user_id=o.customer_id and reversed_at is null and (coins>0 or xp>0) and (rewarded_at at time zone 'America/Costa_Rica')::date=private.cr_today();
 if today>=s.max_rewarded_orders_per_day or (last_at is not null and last_at>now()-make_interval(mins=>s.min_minutes_between_rewarded)) then
  limited:=true;
  insert into private.economy_flags(user_id,kind,details) values(o.customer_id,'order_reward_limited',jsonb_build_object('order_id',p_order,'rewarded_today',today));
 else
  select coalesce(max(coin_multiplier),1),coalesce(max(xp_multiplier),1) into cm,xm from public.economy_campaigns
   where enabled and now() between starts_at and ends_at and (venue_id is null or venue_id=o.venue_id);
  base:=least(o.total_minor,s.max_order_reward_minor);
  v_coins:=floor((base/100)/s.crc_per_coin::numeric*cm);
  v_xp:=floor(s.xp_per_order*xm);
  v_coins:=private.coin_grant(o.customer_id,v_coins,'earn','Pedido entregado','order',p_order::text,'order:'||p_order::text,o.venue_id,true);
  v_xp:=private.xp_grant(o.customer_id,v_xp,'Pedido entregado','order',p_order::text,'order:'||p_order::text,o.venue_id,true);
 end if;
 insert into private.order_rewards(order_id,user_id,venue_id,coins,xp) values(p_order,o.customer_id,o.venue_id,v_coins,v_xp);
 if new_visit then perform private.economy_event(o.customer_id,'first_visit',o.venue_id::text,o.venue_id); end if;
 perform private.economy_achievements(o.customer_id);
end $$;

-- Reembolso: revierte lo otorgado por ese pedido (hasta donde alcance el saldo).
create function private.economy_revoke_order(p_order uuid) returns void language plpgsql security definer set search_path='' as $$
declare r private.order_rewards;
begin
 select * into r from private.order_rewards where order_id=p_order and reversed_at is null for update;
 if not found then return; end if;
 perform private.coin_revoke(r.user_id,r.coins,'Reembolso del pedido','order',p_order::text,'order-rev:'||p_order::text);
 perform private.xp_revoke(r.user_id,r.xp,'Reembolso del pedido','order',p_order::text,'order-rev:'||p_order::text);
 update private.order_rewards set reversed_at=now() where order_id=p_order;
end $$;

-- Los triggers de la economía NUNCA bloquean un pedido: ante cualquier error dejan una señal (trigger_error) y el pedido sigue.
create function private.economy_on_order_status() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='delivered' and old.status is distinct from 'delivered' then
  begin perform private.economy_award_order(new.id);
  exception when others then
   insert into private.economy_flags(user_id,kind,details) values(new.customer_id,'trigger_error',jsonb_build_object('fn','award_order','order_id',new.id,'sqlstate',sqlstate,'message',sqlerrm));
  end;
 end if;
 return null;
end $$;
create trigger economy_order_status after update of status on public.orders for each row execute function private.economy_on_order_status();

create function private.economy_on_payment_status() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='refunded' and old.status is distinct from 'refunded' then
  begin perform private.economy_revoke_order(new.order_id);
  exception when others then
   insert into private.economy_flags(kind,details) values('trigger_error',jsonb_build_object('fn','revoke_order','order_id',new.order_id,'sqlstate',sqlstate,'message',sqlerrm));
  end;
 end if;
 return null;
end $$;
create trigger economy_payment_status after update of status on private.payments for each row execute function private.economy_on_payment_status();

-- Señales sociales ya existentes (027): se premian por trigger sin reescribir sus funciones.
create function private.economy_on_checkin() returns trigger language plpgsql security definer set search_path='' as $$
begin
 begin perform private.economy_event(new.user_id,'checkin',new.id::text,new.venue_id);
 exception when others then
  insert into private.economy_flags(user_id,kind,details) values(new.user_id,'trigger_error',jsonb_build_object('fn','checkin','sqlstate',sqlstate,'message',sqlerrm));
 end;
 return null;
end $$;
create trigger economy_checkin after insert on public.venue_checkins for each row execute function private.economy_on_checkin();

create function private.economy_on_friendship() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='accepted' and old.status is distinct from 'accepted' then
  begin
   perform private.economy_event(new.requester,'friend_accepted',new.id::text||':'||new.requester::text);
   perform private.economy_event(new.addressee,'friend_accepted',new.id::text||':'||new.addressee::text);
  exception when others then
   insert into private.economy_flags(user_id,kind,details) values(new.requester,'trigger_error',jsonb_build_object('fn','friendship','sqlstate',sqlstate,'message',sqlerrm));
  end;
 end if;
 return null;
end $$;
create trigger economy_friendship after update of status on public.friendships for each row execute function private.economy_on_friendship();

-- ---------------------------------------------------------------------------
-- Compra de paquetes de monedas (dinero real). Solo se liquida desde el servidor tras confirmar el proveedor.
-- ---------------------------------------------------------------------------

create function public.coin_packages_list() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.economy_user();
 return jsonb_build_object('purchases_enabled',(select coin_purchases_enabled from public.economy_settings),
  'packages',coalesce((select jsonb_agg(jsonb_build_object('code',code,'name',name,'coins',coins,'bonus_coins',bonus_coins,'price_minor',price_minor,'currency',currency) order by sort,price_minor)
   from public.coin_packages where enabled),'[]'::jsonb));
end $$;

create function public.coins_purchase_create(package text,idempotency text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.economy_user(); p public.coin_packages; k text:=btrim(idempotency); existing private.coin_purchases; created private.coin_purchases;
begin
 if k is null or length(k) not between 8 and 80 then raise exception 'INVALID_INPUT'; end if;
 if not (select coin_purchases_enabled from public.economy_settings) then raise exception 'COIN_PURCHASES_DISABLED'; end if;
 select * into existing from private.coin_purchases where user_id=uid and idempotency_key=k;
 if found then return jsonb_build_object('id',existing.id,'status',existing.status,'coins',existing.coins,'price_minor',existing.price_minor,'replayed',true); end if;
 if not private.limit_action('coin_purchase',10) then raise exception 'RATE_LIMITED'; end if;
 select * into p from public.coin_packages where code=package and enabled;
 if not found then raise exception 'PACKAGE_NOT_FOUND'; end if;
 insert into private.coin_purchases(user_id,package_id,package_code,coins,price_minor,idempotency_key)
 values(uid,p.id,p.code,p.coins+p.bonus_coins,p.price_minor,k) returning * into created;
 return jsonb_build_object('id',created.id,'status',created.status,'coins',created.coins,'price_minor',created.price_minor,'replayed',false);
end $$;

-- Solo servidor (service_role): confirma el pago y acredita. Idempotente.
create function public.coins_purchase_settle(purchase uuid,provider text,provider_ref text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p private.coin_purchases;
begin
 select * into p from private.coin_purchases where id=purchase for update;
 if not found then raise exception 'PURCHASE_NOT_FOUND'; end if;
 if p.status='paid' then return jsonb_build_object('id',p.id,'status','paid','replayed',true); end if;
 if p.status<>'pending' then raise exception 'PURCHASE_NOT_PENDING'; end if;
 update private.coin_purchases set status='paid',provider=coins_purchase_settle.provider,provider_ref=coins_purchase_settle.provider_ref,paid_at=now() where id=p.id;
 perform private.coin_grant(p.user_id,p.coins,'purchase','Compra de paquete '||p.package_code,'purchase',p.id::text,'purchase:'||p.id::text);
 return jsonb_build_object('id',p.id,'status','paid','coins',p.coins,'replayed',false);
end $$;

create function public.coins_purchase_refund(purchase uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p private.coin_purchases; taken integer;
begin
 select * into p from private.coin_purchases where id=purchase for update;
 if not found then raise exception 'PURCHASE_NOT_FOUND'; end if;
 if p.status='refunded' then return jsonb_build_object('id',p.id,'status','refunded','replayed',true); end if;
 if p.status<>'paid' then raise exception 'PURCHASE_NOT_PAID'; end if;
 taken:=private.coin_revoke(p.user_id,p.coins,'Reembolso de compra','purchase',p.id::text,'purchase-rev:'||p.id::text);
 if taken<p.coins then
  insert into private.economy_flags(user_id,kind,details) values(p.user_id,'purchase_refund_shortfall',jsonb_build_object('purchase_id',p.id,'coins',p.coins,'revoked',taken));
 end if;
 update private.coin_purchases set status='refunded',refunded_at=now() where id=p.id;
 return jsonb_build_object('id',p.id,'status','refunded','revoked',taken,'replayed',false);
end $$;

-- ---------------------------------------------------------------------------
-- Cuenta del jugador
-- ---------------------------------------------------------------------------

create function public.economy_wallet() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=private.economy_user(); xp bigint; lvl integer; cur public.levels; nxt public.levels;
begin
 xp:=coalesce((select t.xp from private.xp_totals t where t.user_id=uid),0);
 lvl:=private.level_for(xp);
 select * into cur from public.levels where level=lvl;
 select * into nxt from public.levels where level>lvl order by level limit 1;
 return jsonb_build_object(
  'coins',coalesce((select balance from private.coin_balances where user_id=uid),0),
  'xp',xp,'level',lvl,'level_title',cur.title,'level_xp',cur.xp_required,
  'next_level',case when nxt.level is null then null else jsonb_build_object('level',nxt.level,'title',nxt.title,'xp_required',nxt.xp_required) end,
  'venues_unlocked',(select count(*) from private.venue_visits where user_id=uid),
  'coin_history',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'amount',amount,'balance_after',balance_after,'reason',reason,'at',created_at) order by created_at desc)
    from (select * from private.coin_ledger where user_id=uid order by created_at desc limit 30) c),'[]'::jsonb),
  'xp_history',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'amount',amount,'total_after',total_after,'reason',reason,'at',created_at) order by created_at desc)
    from (select * from private.xp_ledger where user_id=uid order by created_at desc limit 30) x),'[]'::jsonb),
  'achievements',coalesce((select jsonb_agg(jsonb_build_object('code',a.code,'name',a.name,'description',a.description,'metric',a.metric,'threshold',a.threshold,
      'progress',least(private.economy_metric(uid,a.metric),a.threshold),'unlocked_at',u.unlocked_at) order by a.threshold,a.code)
    from public.achievements a left join private.user_achievements u on u.achievement_id=a.id and u.user_id=uid where a.enabled),'[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- Administración de ONZA (megaadministrador)
-- ---------------------------------------------------------------------------

create function public.economy_admin_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.is_onza() then raise exception 'NOT_AUTHORIZED'; end if;
 return jsonb_build_object(
  'settings',(select to_jsonb(s) from public.economy_settings s),
  'event_rules',coalesce((select jsonb_agg(to_jsonb(r) order by r.kind) from public.economy_event_rules r),'[]'::jsonb),
  'packages',coalesce((select jsonb_agg(to_jsonb(p) order by p.sort,p.price_minor) from public.coin_packages p),'[]'::jsonb),
  'campaigns',coalesce((select jsonb_agg(to_jsonb(c) order by c.starts_at desc) from public.economy_campaigns c),'[]'::jsonb),
  'levels',coalesce((select jsonb_agg(to_jsonb(l) order by l.level) from public.levels l),'[]'::jsonb),
  'achievements',coalesce((select jsonb_agg(to_jsonb(a) order by a.threshold,a.code) from public.achievements a),'[]'::jsonb),
  'stats',jsonb_build_object(
   'coins_earned',coalesce((select sum(amount) from private.coin_ledger where kind='earn'),0),
   'coins_purchased',coalesce((select sum(amount) from private.coin_ledger where kind='purchase'),0),
   'coins_spent',coalesce((select -sum(amount) from private.coin_ledger where kind='spend'),0),
   'coins_revoked',coalesce((select -sum(amount) from private.coin_ledger where kind='revoke'),0),
   'coins_in_circulation',coalesce((select sum(balance) from private.coin_balances),0),
   'xp_earned',coalesce((select sum(amount) from private.xp_ledger where kind='earn'),0),
   'players',(select count(*) from private.xp_totals),
   'purchases_paid',(select count(*) from private.coin_purchases where status='paid'),
   'revenue_minor',coalesce((select sum(price_minor) from private.coin_purchases where status='paid'),0)),
  'flags',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'user_id',user_id,'details',details,'at',created_at) order by created_at desc)
    from (select * from private.economy_flags order by created_at desc limit 50) f),'[]'::jsonb),
  'audit',coalesce((select jsonb_agg(jsonb_build_object('entity',entity,'key',entity_key,'action',action,'at',created_at,'actor',actor_id) order by created_at desc)
    from (select * from private.economy_audit_log order by created_at desc limit 50) a),'[]'::jsonb));
end $$;

create function public.economy_admin_command(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare e text:=input->>'entity'; v jsonb:=coalesce(input->'values','{}'::jsonb); out jsonb;
begin
 if auth.uid() is null or not private.is_onza() then raise exception 'NOT_AUTHORIZED'; end if;
 begin
  if e='settings' then
   update public.economy_settings set
    crc_per_coin=coalesce((v->>'crc_per_coin')::integer,crc_per_coin),
    max_order_reward_minor=coalesce((v->>'max_order_reward_minor')::integer,max_order_reward_minor),
    max_rewarded_orders_per_day=coalesce((v->>'max_rewarded_orders_per_day')::integer,max_rewarded_orders_per_day),
    min_minutes_between_rewarded=coalesce((v->>'min_minutes_between_rewarded')::integer,min_minutes_between_rewarded),
    xp_per_order=coalesce((v->>'xp_per_order')::integer,xp_per_order),
    daily_coin_cap=coalesce((v->>'daily_coin_cap')::integer,daily_coin_cap),
    daily_xp_cap=coalesce((v->>'daily_xp_cap')::integer,daily_xp_cap),
    coin_purchases_enabled=coalesce((v->>'coin_purchases_enabled')::boolean,coin_purchases_enabled),
    updated_at=now(),updated_by=auth.uid()
   returning to_jsonb(economy_settings.*) into out;
  elsif e='event_rule' then
   update public.economy_event_rules set coins=coalesce((v->>'coins')::integer,coins),xp=coalesce((v->>'xp')::integer,xp),
    daily_cap=coalesce((v->>'daily_cap')::integer,daily_cap),enabled=coalesce((v->>'enabled')::boolean,enabled)
   where kind=v->>'kind' returning to_jsonb(economy_event_rules.*) into out;
   if out is null then raise exception 'NOT_FOUND'; end if;
  elsif e='package' then
   insert into public.coin_packages(code,name,coins,bonus_coins,price_minor,enabled,sort)
   values(v->>'code',v->>'name',(v->>'coins')::integer,coalesce((v->>'bonus_coins')::integer,0),(v->>'price_minor')::integer,
    coalesce((v->>'enabled')::boolean,false),coalesce((v->>'sort')::integer,0))
   on conflict(code) do update set name=excluded.name,coins=excluded.coins,bonus_coins=excluded.bonus_coins,
    price_minor=excluded.price_minor,enabled=excluded.enabled,sort=excluded.sort
   returning to_jsonb(coin_packages.*) into out;
  elsif e='campaign' then
   if v->>'id' is null then
    insert into public.economy_campaigns(name,venue_id,coin_multiplier,xp_multiplier,starts_at,ends_at,enabled)
    values(v->>'name',(v->>'venue_id')::uuid,coalesce((v->>'coin_multiplier')::numeric,1),coalesce((v->>'xp_multiplier')::numeric,1),
     (v->>'starts_at')::timestamptz,(v->>'ends_at')::timestamptz,coalesce((v->>'enabled')::boolean,true))
    returning to_jsonb(economy_campaigns.*) into out;
   else
    update public.economy_campaigns set name=coalesce(v->>'name',name),coin_multiplier=coalesce((v->>'coin_multiplier')::numeric,coin_multiplier),
     xp_multiplier=coalesce((v->>'xp_multiplier')::numeric,xp_multiplier),starts_at=coalesce((v->>'starts_at')::timestamptz,starts_at),
     ends_at=coalesce((v->>'ends_at')::timestamptz,ends_at),enabled=coalesce((v->>'enabled')::boolean,enabled)
    where id=(v->>'id')::uuid returning to_jsonb(economy_campaigns.*) into out;
    if out is null then raise exception 'NOT_FOUND'; end if;
   end if;
  elsif e='level' then
   insert into public.levels(level,xp_required,title) values((v->>'level')::integer,(v->>'xp_required')::bigint,v->>'title')
   on conflict(level) do update set xp_required=excluded.xp_required,title=excluded.title returning to_jsonb(levels.*) into out;
  elsif e='achievement' then
   insert into public.achievements(code,name,description,metric,threshold,reward_coins,reward_xp,enabled)
   values(v->>'code',v->>'name',coalesce(v->>'description',''),v->>'metric',(v->>'threshold')::integer,coalesce((v->>'reward_coins')::integer,0),
    coalesce((v->>'reward_xp')::integer,0),coalesce((v->>'enabled')::boolean,true))
   on conflict(code) do update set name=excluded.name,description=excluded.description,metric=excluded.metric,threshold=excluded.threshold,
    reward_coins=excluded.reward_coins,reward_xp=excluded.reward_xp,enabled=excluded.enabled
   returning to_jsonb(achievements.*) into out;
  else
   raise exception 'INVALID_INPUT';
  end if;
 exception when invalid_text_representation or check_violation or not_null_violation or foreign_key_violation or numeric_value_out_of_range or datetime_field_overflow then
  raise exception 'INVALID_INPUT';
 end;
 return out;
end $$;

-- Permisos de ejecución.
revoke execute on function public.coin_packages_list(),public.coins_purchase_create(text,text),public.economy_wallet(),
 public.economy_admin_overview(),public.economy_admin_command(jsonb),public.coins_purchase_settle(uuid,text,text),public.coins_purchase_refund(uuid) from public,anon;
grant execute on function public.coin_packages_list(),public.coins_purchase_create(text,text),public.economy_wallet(),
 public.economy_admin_overview(),public.economy_admin_command(jsonb) to authenticated;
revoke execute on function public.coins_purchase_settle(uuid,text,text),public.coins_purchase_refund(uuid) from authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  grant execute on function public.coins_purchase_settle(uuid,text,text),public.coins_purchase_refund(uuid) to service_role;
 end if;
end $$;

-- Las funciones internas nunca se ejecutan desde el cliente (el esquema private es visible por los predicados de RLS,
-- y una función nueva nace ejecutable por PUBLIC): se revoca de forma explícita, función por función.
do $$ declare f regprocedure; begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname in ('economy_append_only','economy_log_config','economy_user','cr_today','coin_grant','coin_spend',
   'coin_revoke','xp_grant','xp_revoke','level_for','economy_metric','economy_achievements','economy_event','economy_award_order',
   'economy_revoke_order','economy_on_order_status','economy_on_payment_status','economy_on_checkin','economy_on_friendship') loop
  execute format('revoke execute on function %s from public,anon,authenticated',f);
 end loop;
end $$;
