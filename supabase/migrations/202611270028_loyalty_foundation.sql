-- Fidelización · Etapa 1 (cimiento). ADITIVA (R4): tablas, funciones y triggers nuevos. No cambia onza_command,
-- precios, montos cobrados ni permisos existentes. El único trigger nuevo (sobre private.payments) solo actúa cuando el
-- estado pasa a 'captured' (acumular) o 'refunded' (revertir).
--
-- Reglas vigentes:
-- * 1 punto = ₡1 = 100 unidades minor. Puntos enteros.
-- * Programa por local: porcentaje base y reglas. Una regla que coincide con una línea reemplaza el base para esa línea;
--   si coinciden varias, gana la de mayor porcentaje (no se suman). Una regla al 0% excluye la línea.
-- * Reglas: todos los productos, una categoría o un producto; días ISO; franja horaria en hora de Costa Rica (puede
--   cruzar medianoche); importe mínimo del pedido; tope de puntos por pedido; vigencia; campaña opcional.
-- * Ganan puntos solo cuentas con perfil completo (public.profiles), nunca invitados, y solo sobre el importe pagado en
--   efectivo: total menos lo pagado con puntos (canje: etapa 2; hoy siempre 0).
-- * Se acumula al confirmarse el cobro, en la misma transacción. Un reembolso revierte lo que quede sin consumir.
--   Un abono por pedido y fondeador (índice único): repetir el cobro no duplica.
-- * Ledger append-only. Cada asiento guarda su fondeador (local, patrocinador u Onza) y su campaña: editar o desactivar
--   una regla o campaña no cambia puntos ya emitidos. Cambios de configuración quedan en un historial con actor.
-- * Vencimientos: cada abono vence según el programa. El consumo (reversa, vencimiento y, en etapa 2, canje) se asigna
--   por asignaciones explícitas, de forma que el saldo por asiento nunca queda negativo.
-- * Presupuesto por campaña: lo emitido neto (abonos menos reversas) no supera budget_points. Los vencimientos no liberan
--   presupuesto (criterio conservador).
-- * Sin comisiones: no hay ningún asiento de comisión de Pedidos en este esquema.
-- * Acceso: las tablas no tienen permisos directos para anon/authenticated. Todo pasa por RPC con comprobación de
--   administración del local (private.is_staff(venue, true)) o por la propia cuenta (auth.uid()).

-- ---------------------------------------------------------------------------
-- Configuración (editable por el administrador del local, vía RPC)
-- ---------------------------------------------------------------------------

create table if not exists public.loyalty_programs(
  venue_id uuid primary key references public.venues(id),
  enabled boolean not null default false,
  base_percent numeric(5,2) not null default 0 check(base_percent between 0 and 100),
  points_valid_days integer not null default 180 check(points_valid_days between 1 and 3650),
  version integer not null default 1 check(version>0),
  updated_at timestamptz not null default now()
);

create table if not exists public.loyalty_campaigns(
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id),
  name text not null check(length(name) between 1 and 80),
  funder text not null check(funder in ('venue','sponsor','onza')),
  sponsor_name text check(length(sponsor_name) between 1 and 80),
  budget_points integer not null check(budget_points>=0),
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check(ends_at is null or ends_at>starts_at),
  check((funder='sponsor')=(sponsor_name is not null)),
  unique(id,venue_id)
);

create table if not exists public.loyalty_rules(
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id),
  name text not null check(length(name) between 1 and 80),
  kind text not null check(kind in ('all','category','product')),
  scope_id uuid,
  percent numeric(5,2) not null check(percent between 0 and 100),
  weekdays integer[] check(weekdays is null or (cardinality(weekdays) between 1 and 7 and weekdays<@array[1,2,3,4,5,6,7])),
  hour_from integer check(hour_from between 0 and 23),
  hour_to integer check(hour_to between 0 and 23),
  min_amount_minor integer not null default 0 check(min_amount_minor>=0),
  max_points_per_order integer check(max_points_per_order>0),
  campaign_id uuid,
  valid_from timestamptz,
  valid_until timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  -- scope_id se valida contra categorías o productos del mismo local en la RPC (no hay FK polimórfica).
  check((kind='all')=(scope_id is null)),
  check((hour_from is null)=(hour_to is null)),
  check(hour_from is null or hour_from<>hour_to),
  check(valid_until is null or valid_from is null or valid_until>valid_from),
  foreign key(campaign_id,venue_id) references public.loyalty_campaigns(id,venue_id),
  unique(id,venue_id)
);

-- ---------------------------------------------------------------------------
-- Libro de puntos (privado, append-only)
-- ---------------------------------------------------------------------------

create table if not exists private.loyalty_ledger(
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id),
  customer_id uuid not null references auth.users(id),
  order_id uuid references public.orders(id),
  kind text not null check(kind in ('earn','reversal','expire','redeem')),
  points integer not null check(points<>0),
  funder text check(funder in ('venue','sponsor','onza')),
  campaign_id uuid references public.loyalty_campaigns(id),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}',
  check((kind='earn')=(points>0)),
  check((kind='earn')=(expires_at is not null)),
  check(kind<>'earn' or (order_id is not null and funder is not null))
);
create unique index if not exists loyalty_one_earn_per_bucket on private.loyalty_ledger(order_id,coalesce(campaign_id,'00000000-0000-0000-0000-000000000000'::uuid)) where kind='earn';
create unique index if not exists loyalty_one_reversal_per_bucket on private.loyalty_ledger(order_id,coalesce(campaign_id,'00000000-0000-0000-0000-000000000000'::uuid)) where kind='reversal';
create index if not exists loyalty_ledger_customer_idx on private.loyalty_ledger(customer_id,venue_id);
create index if not exists loyalty_ledger_campaign_idx on private.loyalty_ledger(campaign_id) where campaign_id is not null;
create index if not exists loyalty_ledger_expiry_idx on private.loyalty_ledger(venue_id,expires_at) where kind='earn';

-- Cada consumo (reversa, vencimiento, canje futuro) apunta a los abonos de los que sale, con su cantidad.
create table if not exists private.loyalty_allocations(
  consumer_id uuid not null references private.loyalty_ledger(id),
  earn_id uuid not null references private.loyalty_ledger(id),
  points integer not null check(points>0),
  primary key(consumer_id,earn_id)
);
create index if not exists loyalty_allocations_earn_idx on private.loyalty_allocations(earn_id);

-- Historial auditable de configuración: quién cambió qué y cuándo.
create table if not exists private.loyalty_config_log(
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id),
  actor_id uuid references auth.users(id),
  entity text not null check(entity in ('program','rule','campaign')),
  entity_id text not null,
  action text not null check(action in ('insert','update')),
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

alter table public.loyalty_programs enable row level security;
alter table public.loyalty_campaigns enable row level security;
alter table public.loyalty_rules enable row level security;
alter table private.loyalty_ledger enable row level security;
alter table private.loyalty_allocations enable row level security;
alter table private.loyalty_config_log enable row level security;
revoke all on public.loyalty_programs,public.loyalty_campaigns,public.loyalty_rules from public,anon,authenticated;
revoke all on private.loyalty_ledger,private.loyalty_allocations,private.loyalty_config_log from public,anon,authenticated;

create function private.loyalty_append_only() returns trigger language plpgsql set search_path='' as $$
begin
  raise exception 'APPEND_ONLY';
end
$$;
create trigger loyalty_ledger_append_only before update or delete on private.loyalty_ledger for each row execute function private.loyalty_append_only();
create trigger loyalty_allocations_append_only before update or delete on private.loyalty_allocations for each row execute function private.loyalty_append_only();
create trigger loyalty_config_log_append_only before update or delete on private.loyalty_config_log for each row execute function private.loyalty_append_only();

create function private.loyalty_log_config() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb; entity_name text;
begin
  r:=to_jsonb(coalesce(new,old));
  entity_name:=case TG_TABLE_NAME when 'loyalty_programs' then 'program' when 'loyalty_rules' then 'rule' else 'campaign' end;
  insert into private.loyalty_config_log(venue_id,actor_id,entity,entity_id,action,before_state,after_state)
  values((r->>'venue_id')::uuid,auth.uid(),entity_name,coalesce(r->>'id',r->>'venue_id'),lower(TG_OP),case when TG_OP='INSERT' then null else to_jsonb(old) end,to_jsonb(new));
  return null;
end
$$;
create trigger loyalty_programs_log after insert or update on public.loyalty_programs for each row execute function private.loyalty_log_config();
create trigger loyalty_rules_log after insert or update on public.loyalty_rules for each row execute function private.loyalty_log_config();
create trigger loyalty_campaigns_log after insert or update on public.loyalty_campaigns for each row execute function private.loyalty_log_config();

-- ---------------------------------------------------------------------------
-- Funciones auxiliares
-- ---------------------------------------------------------------------------

create function private.loyalty_int_array(j jsonb) returns integer[] language sql immutable set search_path='' as $$
  select case when j is null or jsonb_typeof(j)<>'array' then null
    else array(select x::integer from jsonb_array_elements_text(j) as t(x)) end
$$;

create function private.loyalty_campaign_issued(c uuid) returns integer language sql stable set search_path='' as $$
  select coalesce(sum(points),0)::integer from private.loyalty_ledger where campaign_id=c and kind in ('earn','reversal')
$$;

create function private.loyalty_hour_ok(r public.loyalty_rules, instant timestamptz) returns boolean language plpgsql stable set search_path='' as $$
declare h integer;
begin
  if r.hour_from is null then return true; end if;
  h:=extract(hour from instant at time zone 'America/Costa_Rica')::integer;
  if r.hour_from<r.hour_to then return h>=r.hour_from and h<r.hour_to; end if;
  return h>=r.hour_from or h<r.hour_to;
end
$$;

-- Bloquea el programa del local: serializa acumulaciones, reversas, vencimientos y cambios de configuración.
create function private.loyalty_lock(v uuid) returns void language plpgsql set search_path='' as $$
begin
  insert into public.loyalty_programs(venue_id) values(v) on conflict(venue_id) do nothing;
  perform 1 from public.loyalty_programs where venue_id=v for update;
end
$$;

-- ---------------------------------------------------------------------------
-- Acumulación, reversa y vencimiento
-- ---------------------------------------------------------------------------

create function private.loyalty_award(p_order uuid) returns integer language plpgsql security definer set search_path='' as $$
declare
  o public.orders;
  prog public.loyalty_programs;
  redeemed_points integer;
  cash_base integer;
  granted integer;
begin
  select * into o from public.orders where id=p_order;
  if not found then return 0; end if;
  select * into prog from public.loyalty_programs where venue_id=o.venue_id for update;
  if not found or not prog.enabled then return 0; end if;
  if not exists(select 1 from public.profiles pr where pr.user_id=o.customer_id) then return 0; end if;
  if exists(select 1 from private.loyalty_ledger l where l.order_id=p_order and l.kind='earn') then return 0; end if;
  select coalesce(-sum(l.points),0)::integer into redeemed_points from private.loyalty_ledger l where l.order_id=p_order and l.kind='redeem';
  cash_base:=o.total_minor-redeemed_points*100;
  if o.total_minor<=0 or cash_base<=0 then return 0; end if;

  with lines as (
    select i.line_total_minor, p.category_id, i.product_id
    from public.order_items i join public.products p on p.id=i.product_id
    where i.order_id=p_order
  ), priced as (
    select l.line_total_minor, w.rule_id, w.campaign_id, w.max_points, coalesce(w.percent,prog.base_percent) as pct
    from lines l left join lateral (
      select r.id as rule_id, r.percent, r.campaign_id, r.max_points_per_order as max_points
      from public.loyalty_rules r left join public.loyalty_campaigns c on c.id=r.campaign_id
      where r.venue_id=o.venue_id and r.active
        and (r.kind='all' or (r.kind='category' and r.scope_id=l.category_id) or (r.kind='product' and r.scope_id=l.product_id))
        and (r.valid_from is null or r.valid_from<=o.created_at)
        and (r.valid_until is null or o.created_at<r.valid_until)
        and (r.weekdays is null or extract(isodow from o.created_at at time zone 'America/Costa_Rica')::integer=any(r.weekdays))
        and private.loyalty_hour_ok(r,o.created_at)
        and r.min_amount_minor<=cash_base
        and (r.campaign_id is null or (c.active and c.starts_at<=o.created_at and (c.ends_at is null or o.created_at<c.ends_at)
             and private.loyalty_campaign_issued(c.id)<c.budget_points))
      order by r.percent desc, r.campaign_id nulls last, r.id
      limit 1
    ) w on true
  ), cash_lines as (
    select rule_id, campaign_id, max_points,
      floor(floor(line_total_minor::numeric*cash_base/o.total_minor)*pct/10000)::integer as points
    from priced
  ), rule_totals as (
    select campaign_id, rule_id, max_points, sum(points)::integer as raw
    from cash_lines group by campaign_id, rule_id, max_points
  ), buckets as (
    select campaign_id, sum(case when max_points is null then raw else least(raw,max_points) end)::integer as points
    from rule_totals group by campaign_id
  ), grants as (
    select b.campaign_id,
      case when c.id is null then b.points
           else least(b.points,greatest(c.budget_points-private.loyalty_campaign_issued(c.id),0)) end as points,
      coalesce(c.funder,'venue') as funder
    from buckets b left join public.loyalty_campaigns c on c.id=b.campaign_id
  )
  insert into private.loyalty_ledger(venue_id,customer_id,order_id,kind,points,funder,campaign_id,expires_at,metadata)
  select o.venue_id,o.customer_id,p_order,'earn',g.points,g.funder,g.campaign_id,
    now()+make_interval(days=>prog.points_valid_days),
    jsonb_build_object('cash_base_minor',cash_base,'redeemed_points',redeemed_points)
  from grants g where g.points>0;

  select coalesce(sum(l.points),0)::integer into granted from private.loyalty_ledger l where l.order_id=p_order and l.kind='earn';
  return granted;
end
$$;

-- Consume lo que quede de cada abono del pedido (solo una vez por abono) y registra la reversa.
create function private.loyalty_reverse(p_order uuid) returns integer language plpgsql security definer set search_path='' as $$
declare
  v uuid;
  e record;
  consumer uuid;
  n integer:=0;
begin
  select venue_id into v from public.orders where id=p_order;
  if not found then return 0; end if;
  perform private.loyalty_lock(v);
  for e in
    select l.id,l.venue_id,l.customer_id,l.funder,l.campaign_id,
      l.points-coalesce((select sum(a.points) from private.loyalty_allocations a where a.earn_id=l.id),0) as remaining
    from private.loyalty_ledger l
    where l.order_id=p_order and l.kind='earn'
  loop
    if e.remaining>0 then
      insert into private.loyalty_ledger(venue_id,customer_id,order_id,kind,points,funder,campaign_id,metadata)
      values(e.venue_id,e.customer_id,p_order,'reversal',-e.remaining,e.funder,e.campaign_id,jsonb_build_object('earn_id',e.id))
      returning id into consumer;
      insert into private.loyalty_allocations(consumer_id,earn_id,points) values(consumer,e.id,e.remaining);
      n:=n+1;
    end if;
  end loop;
  return n;
end
$$;

-- Vence los abonos cumplidos. Con p_customer, solo los de esa cuenta.
create function private.loyalty_expire(p_venue uuid, p_customer uuid default null) returns integer language plpgsql security definer set search_path='' as $$
declare
  e record;
  consumer uuid;
  n integer:=0;
begin
  perform private.loyalty_lock(p_venue);
  for e in
    select l.id,l.customer_id,l.funder,l.campaign_id,
      l.points-coalesce((select sum(a.points) from private.loyalty_allocations a where a.earn_id=l.id),0) as remaining
    from private.loyalty_ledger l
    where l.venue_id=p_venue and l.kind='earn' and l.expires_at<=now() and (p_customer is null or l.customer_id=p_customer)
  loop
    if e.remaining>0 then
      insert into private.loyalty_ledger(venue_id,customer_id,order_id,kind,points,funder,campaign_id,metadata)
      values(p_venue,e.customer_id,null,'expire',-e.remaining,e.funder,e.campaign_id,jsonb_build_object('earn_id',e.id))
      returning id into consumer;
      insert into private.loyalty_allocations(consumer_id,earn_id,points) values(consumer,e.id,e.remaining);
      n:=n+1;
    end if;
  end loop;
  return n;
end
$$;

-- Captura de pago: acumula. Reembolso: revierte. Cualquier otro cambio de estado no toca el libro.
create function private.loyalty_on_payment_status() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status is distinct from old.status then
    if new.status='captured' then
      perform private.loyalty_award(new.order_id);
    elsif new.status='refunded' then
      perform private.loyalty_reverse(new.order_id);
    end if;
  end if;
  return null;
end
$$;
create trigger loyalty_payment_status after update of status on private.payments for each row execute function private.loyalty_on_payment_status();

-- ---------------------------------------------------------------------------
-- RPC de administración del local (solo administración, nunca empleado)
-- ---------------------------------------------------------------------------

create function public.loyalty_config(venue uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.is_staff(venue,true) then raise exception 'NOT_AUTHORIZED'; end if;
  return jsonb_build_object(
    'program', coalesce((select to_jsonb(p) from public.loyalty_programs p where p.venue_id=venue),
      jsonb_build_object('venue_id',venue,'enabled',false,'base_percent',0,'points_valid_days',180,'version',0)),
    'rules', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at,r.id) from public.loyalty_rules r where r.venue_id=venue),'[]'::jsonb),
    'campaigns', coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object(
        'issued_points',private.loyalty_campaign_issued(c.id),
        'remaining_points',greatest(c.budget_points-private.loyalty_campaign_issued(c.id),0))
      order by c.created_at,c.id) from public.loyalty_campaigns c where c.venue_id=venue),'[]'::jsonb));
end
$$;

create function public.loyalty_program_save(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  venue uuid;
  enabled_flag boolean;
  base numeric;
  valid_days integer;
  prog public.loyalty_programs;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHORIZED'; end if;
  begin venue:=(input->>'venueId')::uuid; exception when others then raise exception 'INVALID_INPUT'; end;
  if not private.is_staff(venue,true) then raise exception 'NOT_AUTHORIZED'; end if;
  if jsonb_typeof(input->'enabled')<>'boolean' then raise exception 'INVALID_INPUT'; end if;
  enabled_flag:=(input->>'enabled')::boolean;
  base:=(input->>'basePercent')::numeric;
  valid_days:=(input->>'pointsValidDays')::integer;
  if base is null or base<0 or base>100 or valid_days is null or valid_days not between 1 and 3650 then raise exception 'INVALID_INPUT'; end if;
  insert into public.loyalty_programs(venue_id,enabled,base_percent,points_valid_days) values(venue,enabled_flag,base,valid_days)
  on conflict(venue_id) do update set enabled=excluded.enabled,base_percent=excluded.base_percent,
    points_valid_days=excluded.points_valid_days,version=public.loyalty_programs.version+1,updated_at=now()
  returning * into prog;
  return to_jsonb(prog);
end
$$;

create function public.loyalty_campaign_save(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  venue uuid;
  campaign_id uuid;
  cur public.loyalty_campaigns;
  funder text;
  budget integer;
  c public.loyalty_campaigns;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHORIZED'; end if;
  begin venue:=(input->>'venueId')::uuid; exception when others then raise exception 'INVALID_INPUT'; end;
  if not private.is_staff(venue,true) then raise exception 'NOT_AUTHORIZED'; end if;
  campaign_id:=nullif(input->>'id','')::uuid;
  funder:=input->>'funder';
  budget:=(input->>'budgetPoints')::integer;
  if budget is null or budget<0 or funder not in ('venue','sponsor','onza') then raise exception 'INVALID_INPUT'; end if;
  perform private.loyalty_lock(venue);
  if campaign_id is not null then
    select * into cur from public.loyalty_campaigns where id=campaign_id and venue_id=venue;
    if not found then raise exception 'NOT_FOUND'; end if;
    if funder<>cur.funder and private.loyalty_campaign_issued(cur.id)>0 then raise exception 'FUNDER_LOCKED'; end if;
    if budget<private.loyalty_campaign_issued(cur.id) then raise exception 'BUDGET_BELOW_ISSUED'; end if;
  end if;
  insert into public.loyalty_campaigns(id,venue_id,name,funder,sponsor_name,budget_points,active,starts_at,ends_at)
  values(coalesce(campaign_id,gen_random_uuid()),venue,input->>'name',funder,nullif(input->>'sponsorName',''),budget,
    coalesce((input->>'active')::boolean,true),coalesce(nullif(input->>'startsAt','')::timestamptz,now()),nullif(input->>'endsAt','')::timestamptz)
  on conflict(id) do update set name=excluded.name,funder=excluded.funder,sponsor_name=excluded.sponsor_name,
    budget_points=excluded.budget_points,active=excluded.active,starts_at=excluded.starts_at,ends_at=excluded.ends_at
    where public.loyalty_campaigns.venue_id=excluded.venue_id
  returning * into c;
  if not found then raise exception 'NOT_FOUND'; end if;
  return to_jsonb(c)||jsonb_build_object('issued_points',private.loyalty_campaign_issued(c.id));
end
$$;

create function public.loyalty_rule_save(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  venue uuid;
  rule_id uuid;
  kind text;
  scope uuid;
  pct numeric;
  campaign uuid;
  r public.loyalty_rules;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHORIZED'; end if;
  begin venue:=(input->>'venueId')::uuid; exception when others then raise exception 'INVALID_INPUT'; end;
  if not private.is_staff(venue,true) then raise exception 'NOT_AUTHORIZED'; end if;
  rule_id:=nullif(input->>'id','')::uuid;
  kind:=input->>'kind';
  scope:=nullif(input->>'scopeId','')::uuid;
  pct:=(input->>'percent')::numeric;
  campaign:=nullif(input->>'campaignId','')::uuid;
  if pct is null or pct<0 or pct>100 or kind not in ('all','category','product') or (kind='all')<>(scope is null) then raise exception 'INVALID_INPUT'; end if;
  if kind='category' and not exists(select 1 from public.categories where id=scope and venue_id=venue) then raise exception 'INVALID_INPUT'; end if;
  if kind='product' and not exists(select 1 from public.products where id=scope and venue_id=venue) then raise exception 'INVALID_INPUT'; end if;
  if campaign is not null and not exists(select 1 from public.loyalty_campaigns where id=campaign and venue_id=venue) then raise exception 'INVALID_INPUT'; end if;
  perform private.loyalty_lock(venue);
  insert into public.loyalty_rules(id,venue_id,name,kind,scope_id,percent,weekdays,hour_from,hour_to,min_amount_minor,max_points_per_order,campaign_id,valid_from,valid_until,active)
  values(coalesce(rule_id,gen_random_uuid()),venue,input->>'name',kind,scope,pct,
    private.loyalty_int_array(input->'weekdays'),
    nullif(input->>'hourFrom','')::integer,nullif(input->>'hourTo','')::integer,
    coalesce(nullif(input->>'minAmountMinor','')::integer,0),nullif(input->>'maxPointsPerOrder','')::integer,campaign,
    nullif(input->>'validFrom','')::timestamptz,nullif(input->>'validUntil','')::timestamptz,
    coalesce((input->>'active')::boolean,true))
  on conflict(id) do update set name=excluded.name,kind=excluded.kind,scope_id=excluded.scope_id,percent=excluded.percent,
    weekdays=excluded.weekdays,hour_from=excluded.hour_from,hour_to=excluded.hour_to,min_amount_minor=excluded.min_amount_minor,
    max_points_per_order=excluded.max_points_per_order,campaign_id=excluded.campaign_id,valid_from=excluded.valid_from,
    valid_until=excluded.valid_until,active=excluded.active
    where public.loyalty_rules.venue_id=excluded.venue_id
  returning * into r;
  if not found then raise exception 'NOT_FOUND'; end if;
  return to_jsonb(r);
end
$$;

-- Resumen agregado del local (sin datos de clientes): emitido, revertido, vencido, canjeado y pendiente.
create function public.loyalty_summary(venue uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.is_staff(venue,true) then raise exception 'NOT_AUTHORIZED'; end if;
  return (
    select jsonb_build_object(
      'issued',coalesce(sum(points) filter (where kind='earn'),0),
      'reversed',-coalesce(sum(points) filter (where kind='reversal'),0),
      'expired',-coalesce(sum(points) filter (where kind='expire'),0),
      'redeemed',-coalesce(sum(points) filter (where kind='redeem'),0),
      'outstanding',coalesce(sum(points),0),
      'by_funder',coalesce((select jsonb_object_agg(x.funder,x.net) from (
          select funder,sum(points) as net from private.loyalty_ledger
          where venue_id=venue and kind in ('earn','reversal') and funder is not null group by funder) x),'{}'::jsonb))
    from private.loyalty_ledger where venue_id=venue);
end
$$;

-- ---------------------------------------------------------------------------
-- RPC de la cuenta del cliente (solo su propio saldo)
-- ---------------------------------------------------------------------------

create function public.loyalty_account() returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();
  v uuid;
begin
  if uid is null then raise exception 'NOT_AUTHORIZED'; end if;
  for v in select distinct l.venue_id from private.loyalty_ledger l where l.customer_id=uid loop
    perform private.loyalty_expire(v,uid);
  end loop;
  return jsonb_build_object(
    'balances',coalesce((select jsonb_agg(jsonb_build_object('venueId',x.venue_id,'venueName',x.name,'points',x.points) order by x.name) from (
        select l.venue_id,ve.name,sum(l.points)::integer as points from private.loyalty_ledger l join public.venues ve on ve.id=l.venue_id
        where l.customer_id=uid group by l.venue_id,ve.name having sum(l.points)<>0) x),'[]'::jsonb),
    'expiring',coalesce((select jsonb_agg(jsonb_build_object('venueId',x.venue_id,'points',x.remaining,'expiresAt',x.expires_at) order by x.expires_at) from (
        select l.venue_id,l.expires_at,l.points-coalesce((select sum(a.points) from private.loyalty_allocations a where a.earn_id=l.id),0) as remaining
        from private.loyalty_ledger l where l.customer_id=uid and l.kind='earn' and l.expires_at>now()
        order by l.expires_at limit 20) x where x.remaining>0),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(jsonb_build_object('venueId',x.venue_id,'venueName',x.name,'kind',x.kind,'points',x.points,'createdAt',x.created_at) order by x.created_at desc) from (
        select l.venue_id,ve.name,l.kind,l.points,l.created_at from private.loyalty_ledger l join public.venues ve on ve.id=l.venue_id
        where l.customer_id=uid order by l.created_at desc limit 50) x),'[]'::jsonb));
end
$$;

-- ---------------------------------------------------------------------------
-- Permisos: las RPC solo para authenticated (cada una comprueba su propia autorización); el resto, privado.
-- ---------------------------------------------------------------------------

revoke execute on function
  private.loyalty_int_array(jsonb), private.loyalty_campaign_issued(uuid), private.loyalty_hour_ok(public.loyalty_rules,timestamptz),
  private.loyalty_lock(uuid), private.loyalty_award(uuid), private.loyalty_reverse(uuid), private.loyalty_expire(uuid,uuid),
  private.loyalty_on_payment_status(), private.loyalty_log_config(), private.loyalty_append_only()
from public,anon,authenticated;

revoke execute on function
  public.loyalty_config(uuid), public.loyalty_program_save(jsonb), public.loyalty_campaign_save(jsonb),
  public.loyalty_rule_save(jsonb), public.loyalty_summary(uuid), public.loyalty_account()
from public,anon;
grant execute on function
  public.loyalty_config(uuid), public.loyalty_program_save(jsonb), public.loyalty_campaign_save(jsonb),
  public.loyalty_rule_save(jsonb), public.loyalty_summary(uuid), public.loyalty_account()
to authenticated;
