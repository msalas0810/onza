-- Avatares, tienda virtual e importador CSV. ADITIVA (R4): tablas y funciones nuevas, una columna nullable en `achievements`.
--
-- * El catálogo guarda METADATOS y REFERENCIAS (asset_ref / preview_ref: ruta relativa o URL https). Los archivos gráficos se
--   almacenan aparte; la lógica nunca depende de ellos. Los diseños definitivos entran por CSV y reemplazan a los provisionales
--   sin tocar la lógica de negocio.
-- * La clave de negocio del CSV es `sku`. El `id` (uuid) es estable: actualizar un diseño por sku NUNCA cambia el id, así
--   que compras, inventarios y avatares equipados se conservan. Los artículos no se borran: se retiran (`status='retired'`).
-- * Un artículo se equipa en la ranura de su categoría (una por categoría). `compat.bodies` limita por cuerpo base y
--   `compat.conflicts` quita otras ranuras al equiparlo.
-- * Comprar gasta Avatar Coins (nunca cashback ni dinero) con el libro de 029: sin saldo falla, y el gasto es atómico con el
--   alta en el inventario. Un artículo `exclusive` no se vende: solo se otorga (logro o concesión de ONZA).
-- * Importación en dos pasos: `stage` valida TODO en una transacción de prueba (nada se escribe) y guarda la vista previa;
--   `apply` aplica las filas válidas y deja el resultado en el historial. Las filas con error se omiten y quedan listadas.
-- * Sin permisos directos sobre ninguna tabla nueva: todo pasa por funciones que validan en servidor.

create table public.avatar_items(
 id uuid primary key default gen_random_uuid(),
 sku text not null unique check(sku ~ '^[A-Za-z0-9_.-]{2,64}$'),
 name text not null check(length(btrim(name)) between 2 and 80),
 category text not null check(category in ('hat','glasses','top','jacket','bottom','shoes','hair','accessory','animation','expression','background','effect')),
 price_coins integer not null default 0 check(price_coins>=0),
 rarity text not null default 'common' check(rarity in ('common','rare','epic','legendary')),
 status text not null default 'draft' check(status in ('draft','active','retired')),
 season text check(season is null or length(season) between 1 and 40),
 exclusive boolean not null default false,
 min_level integer not null default 1 check(min_level>=1),
 available_from timestamptz,
 available_until timestamptz,
 compat jsonb not null default '{}' check(jsonb_typeof(compat)='object'),
 asset_ref text check(asset_ref is null or (length(asset_ref)<=500 and asset_ref ~ '^(https://[^[:space:]]+|[A-Za-z0-9_./-]+)$' and asset_ref !~ '\.\.')),
 preview_ref text check(preview_ref is null or (length(preview_ref)<=500 and preview_ref ~ '^(https://[^[:space:]]+|[A-Za-z0-9_./-]+)$' and preview_ref !~ '\.\.')),
 sort integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(available_until is null or available_from is null or available_until>available_from)
);
create index avatar_items_store on public.avatar_items(category,sort) where status='active';

alter table public.achievements add column if not exists reward_item_id uuid references public.avatar_items(id);

create table private.avatar_inventory(
 user_id uuid not null references auth.users(id) on delete cascade,
 item_id uuid not null references public.avatar_items(id) on delete restrict,
 source text not null check(source in ('purchase','reward','grant')),
 price_paid integer not null default 0 check(price_paid>=0),
 acquired_at timestamptz not null default now(),
 primary key(user_id,item_id)
);
create index avatar_inventory_item on private.avatar_inventory(item_id);

create table private.avatar_profiles(
 user_id uuid primary key references auth.users(id) on delete cascade,
 base jsonb not null default '{"skin":"tone-1","body":"a"}' check(jsonb_typeof(base)='object'),
 equipped jsonb not null default '{}' check(jsonb_typeof(equipped)='object'),
 presence text not null default 'friends' check(presence in ('everyone','friends','nobody')),
 show_in_rankings boolean not null default false,
 updated_at timestamptz not null default now()
);

create table private.catalog_imports(
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null,
 filename text not null check(length(filename) between 1 and 200),
 status text not null default 'previewed' check(status in ('previewed','applied','discarded')),
 total_rows integer not null default 0,
 created_count integer not null default 0,
 updated_count integer not null default 0,
 unchanged_count integer not null default 0,
 error_count integer not null default 0,
 parse_errors jsonb not null default '[]',
 errors jsonb not null default '[]',
 preview jsonb not null default '[]',
 rows jsonb not null default '[]' check(jsonb_typeof(rows)='array' and jsonb_array_length(rows)<=5000),
 created_at timestamptz not null default now(),
 applied_at timestamptz
);
create index catalog_imports_recent on private.catalog_imports(created_at desc);

alter table public.avatar_items enable row level security;
alter table private.avatar_inventory enable row level security;
alter table private.avatar_profiles enable row level security;
alter table private.catalog_imports enable row level security;
revoke all on public.avatar_items from public,anon,authenticated;
revoke all on private.avatar_inventory,private.avatar_profiles,private.catalog_imports from public,anon,authenticated;

create trigger avatar_items_log after insert or update on public.avatar_items for each row execute function private.economy_log_config();

-- ---------------------------------------------------------------------------
-- Avatar
-- ---------------------------------------------------------------------------

-- Tarjeta pública del avatar de una persona (sin datos personales más allá del usuario que ya muestra lo social).
create function private.avatar_card(p_user uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('user_id',p.user_id,'username',p.username,
  'level',private.level_for(coalesce((select t.xp from private.xp_totals t where t.user_id=p.user_id),0)),
  'base',coalesce(a.base,'{"skin":"tone-1","body":"a"}'::jsonb),
  'equipped',coalesce((select jsonb_object_agg(i.category,jsonb_build_object('item_id',i.id,'sku',i.sku,'name',i.name,'rarity',i.rarity,'asset_ref',i.asset_ref,'preview_ref',i.preview_ref))
    from jsonb_each_text(coalesce(a.equipped,'{}'::jsonb)) e join public.avatar_items i on i.id=e.value::uuid),'{}'::jsonb))
 from public.profiles p left join private.avatar_profiles a on a.user_id=p.user_id where p.user_id=p_user $$;

create function public.avatar_me() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=private.economy_user(); prof private.avatar_profiles;
begin
 select * into prof from private.avatar_profiles where user_id=uid;
 return private.avatar_card(uid)||jsonb_build_object(
  'presence',coalesce(prof.presence,'friends'),'show_in_rankings',coalesce(prof.show_in_rankings,false),
  'owned',coalesce((select jsonb_agg(jsonb_build_object('item_id',i.id,'sku',i.sku,'name',i.name,'category',i.category,'rarity',i.rarity,
      'asset_ref',i.asset_ref,'preview_ref',i.preview_ref,'compat',i.compat,'status',i.status,'acquired_at',v.acquired_at) order by i.category,i.sort,i.name)
    from private.avatar_inventory v join public.avatar_items i on i.id=v.item_id where v.user_id=uid),'[]'::jsonb));
end $$;

create function public.avatar_base_save(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.economy_user(); skin text:=input->>'skin'; body text:=input->>'body';
begin
 if skin is null or skin !~ '^[a-z0-9-]{1,20}$' or body is null or body !~ '^[a-z0-9-]{1,20}$' then raise exception 'INVALID_INPUT'; end if;
 insert into private.avatar_profiles(user_id) values(uid) on conflict do nothing;
 update private.avatar_profiles set base=jsonb_build_object('skin',skin,'body',body),updated_at=now() where user_id=uid;
 return private.avatar_card(uid);
end $$;

-- Privacidad: quién ve tu avatar en un bar y si apareces en los rankings (apagado por defecto).
create function public.avatar_privacy_save(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.economy_user(); pres text:=coalesce(input->>'presence','friends'); rank boolean;
begin
 if pres not in ('everyone','friends','nobody') then raise exception 'INVALID_INPUT'; end if;
 begin rank:=coalesce((input->>'show_in_rankings')::boolean,false); exception when invalid_text_representation then raise exception 'INVALID_INPUT'; end;
 insert into private.avatar_profiles(user_id) values(uid) on conflict do nothing;
 update private.avatar_profiles set presence=pres,show_in_rankings=rank,updated_at=now() where user_id=uid;
 return jsonb_build_object('presence',pres,'show_in_rankings',rank);
end $$;

create function public.avatar_equip(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.economy_user(); slot text:=input->>'slot'; item uuid; it public.avatar_items; prof private.avatar_profiles; eq jsonb; conf text;
begin
 if slot is null or slot not in ('hat','glasses','top','jacket','bottom','shoes','hair','accessory','animation','expression','background','effect') then raise exception 'INVALID_INPUT'; end if;
 insert into private.avatar_profiles(user_id) values(uid) on conflict do nothing;
 select * into prof from private.avatar_profiles where user_id=uid for update;
 eq:=prof.equipped;
 if coalesce(input->>'itemId','')='' then
  eq:=eq-slot;
 else
  begin item:=(input->>'itemId')::uuid; exception when invalid_text_representation then raise exception 'INVALID_INPUT'; end;
  select * into it from public.avatar_items where id=item;
  if not found or it.category<>slot then raise exception 'ITEM_NOT_FOUND'; end if;
  if not exists(select 1 from private.avatar_inventory where user_id=uid and item_id=item) then raise exception 'ITEM_NOT_OWNED'; end if;
  if it.compat ? 'bodies' and not (it.compat->'bodies') @> to_jsonb(prof.base->>'body') then raise exception 'INCOMPATIBLE_ITEM'; end if;
  eq:=jsonb_set(eq,array[slot],to_jsonb(item::text));
  for conf in select jsonb_array_elements_text(coalesce(it.compat->'conflicts','[]'::jsonb)) loop eq:=eq-conf; end loop;
 end if;
 update private.avatar_profiles set equipped=eq,updated_at=now() where user_id=uid;
 return private.avatar_card(uid);
end $$;

-- ---------------------------------------------------------------------------
-- Tienda
-- ---------------------------------------------------------------------------

create function public.avatar_store(category text default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=private.economy_user(); lvl integer:=private.level_for(coalesce((select xp from private.xp_totals where user_id=uid),0));
begin
 return jsonb_build_object('coins',coalesce((select balance from private.coin_balances where user_id=uid),0),'level',lvl,
  'items',coalesce((select jsonb_agg(jsonb_build_object('item_id',i.id,'sku',i.sku,'name',i.name,'category',i.category,'price_coins',i.price_coins,
      'rarity',i.rarity,'season',i.season,'exclusive',i.exclusive,'min_level',i.min_level,'compat',i.compat,'asset_ref',i.asset_ref,'preview_ref',i.preview_ref,
      'available_until',i.available_until,'owned',v.user_id is not null,'locked_by_level',lvl<i.min_level,
      'equipped',coalesce(p.equipped->>i.category=i.id::text,false)) order by i.category,i.sort,i.price_coins,i.name)
    from public.avatar_items i
    left join private.avatar_inventory v on v.item_id=i.id and v.user_id=uid
    left join private.avatar_profiles p on p.user_id=uid
    where i.status='active' and (avatar_store.category is null or i.category=avatar_store.category)
     and (i.available_from is null or i.available_from<=now()) and (i.available_until is null or i.available_until>now())),'[]'::jsonb));
end $$;

create function public.avatar_item_buy(item uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.economy_user(); it public.avatar_items; lvl integer; spent boolean:=true;
begin
 select * into it from public.avatar_items where id=item;
 if not found or it.status<>'active' or (it.available_from is not null and it.available_from>now()) or (it.available_until is not null and it.available_until<=now()) then
  raise exception 'ITEM_NOT_AVAILABLE';
 end if;
 if it.exclusive then raise exception 'NOT_FOR_SALE'; end if;
 lvl:=private.level_for(coalesce((select xp from private.xp_totals where user_id=uid),0));
 if lvl<it.min_level then raise exception 'LEVEL_TOO_LOW'; end if;
 if exists(select 1 from private.avatar_inventory where user_id=uid and item_id=item) then raise exception 'ALREADY_OWNED'; end if;
 if not private.limit_action('avatar_buy',30) then raise exception 'RATE_LIMITED'; end if;
 if it.price_coins>0 then
  spent:=private.coin_spend(uid,it.price_coins,'Artículo: '||it.name,'avatar_item',it.id::text,'buy:'||it.id::text,jsonb_build_object('sku',it.sku));
 end if;
 if not spent then raise exception 'ALREADY_OWNED'; end if;
 insert into private.avatar_inventory(user_id,item_id,source,price_paid) values(uid,item,'purchase',it.price_coins);
 return jsonb_build_object('item_id',item,'price',it.price_coins,'coins',coalesce((select balance from private.coin_balances where user_id=uid),0));
end $$;

-- ---------------------------------------------------------------------------
-- Logros que otorgan un artículo exclusivo
-- ---------------------------------------------------------------------------

create or replace function private.economy_achievements(p_user uuid) returns integer language plpgsql security definer set search_path='' as $$
declare a public.achievements; n integer:=0;
begin
 for a in select * from public.achievements x where x.enabled and not exists(select 1 from private.user_achievements u where u.user_id=p_user and u.achievement_id=x.id) loop
  if private.economy_metric(p_user,a.metric)>=a.threshold then
   insert into private.user_achievements(user_id,achievement_id) values(p_user,a.id) on conflict do nothing;
   if found then
    perform private.coin_grant(p_user,a.reward_coins,'earn','Logro: '||a.name,'achievement',a.id::text,'ach:'||a.id::text);
    perform private.xp_grant(p_user,a.reward_xp,'Logro: '||a.name,'achievement',a.id::text,'ach:'||a.id::text);
    if a.reward_item_id is not null then
     insert into private.avatar_inventory(user_id,item_id,source) values(p_user,a.reward_item_id,'reward') on conflict do nothing;
    end if;
    n:=n+1;
   end if;
  end if;
 end loop;
 return n;
end $$;

-- ---------------------------------------------------------------------------
-- Alta y actualización de artículos (sirve al editor manual y al importador CSV)
-- ---------------------------------------------------------------------------

-- `r` solo trae las claves que se quieren fijar: una clave ausente conserva el valor actual. Devuelve created|updated|unchanged.
create function private.avatar_item_upsert(r jsonb) returns text language plpgsql security definer set search_path='' as $$
declare k text:=btrim(coalesce(r->>'sku','')); cur public.avatar_items; upd public.avatar_items;
begin
 if k='' then raise exception 'SKU_REQUIRED'; end if;
 select * into cur from public.avatar_items where sku=k;
 if not found then
  insert into public.avatar_items(sku,name,category,price_coins,rarity,status,season,exclusive,min_level,available_from,available_until,compat,asset_ref,preview_ref,sort)
  values(k,r->>'name',r->>'category',coalesce((r->>'price_coins')::integer,0),coalesce(nullif(r->>'rarity',''),'common'),
   coalesce(nullif(r->>'status',''),'draft'),nullif(r->>'season',''),coalesce((r->>'exclusive')::boolean,false),coalesce((r->>'min_level')::integer,1),
   nullif(r->>'available_from','')::timestamptz,nullif(r->>'available_until','')::timestamptz,coalesce(r->'compat','{}'::jsonb),
   nullif(r->>'asset_ref',''),nullif(r->>'preview_ref',''),coalesce((r->>'sort')::integer,0));
  return 'created';
 end if;
 if r ? 'category' and r->>'category' is distinct from cur.category then raise exception 'CATEGORY_CHANGE_NOT_ALLOWED'; end if;
 update public.avatar_items set
  name=case when r ? 'name' then r->>'name' else name end,
  price_coins=coalesce((r->>'price_coins')::integer,price_coins),
  rarity=coalesce(nullif(r->>'rarity',''),rarity),
  status=coalesce(nullif(r->>'status',''),status),
  season=case when r ? 'season' then nullif(r->>'season','') else season end,
  exclusive=coalesce((r->>'exclusive')::boolean,exclusive),
  min_level=coalesce((r->>'min_level')::integer,min_level),
  available_from=case when r ? 'available_from' then nullif(r->>'available_from','')::timestamptz else available_from end,
  available_until=case when r ? 'available_until' then nullif(r->>'available_until','')::timestamptz else available_until end,
  compat=case when r ? 'compat' and jsonb_typeof(r->'compat')='object' then r->'compat' else compat end,
  asset_ref=case when r ? 'asset_ref' then nullif(r->>'asset_ref','') else asset_ref end,
  preview_ref=case when r ? 'preview_ref' then nullif(r->>'preview_ref','') else preview_ref end,
  sort=coalesce((r->>'sort')::integer,sort),
  updated_at=now()
 where id=cur.id returning * into upd;
 return case when (to_jsonb(cur)-'updated_at')=(to_jsonb(upd)-'updated_at') then 'unchanged' else 'updated' end;
end $$;

-- Ejecuta una lista de filas. Con p_commit=false no escribe nada (vista previa exacta, con las mismas validaciones de la base).
create function private.catalog_import_run(p_rows jsonb,p_commit boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare r record; res jsonb:='[]'; errs jsonb:='[]'; c integer:=0; u integer:=0; n integer:=0; act text; cur public.avatar_items; changes jsonb; key text;
begin
 begin
  for r in select value,ordinality as line from jsonb_array_elements(p_rows) with ordinality loop
   begin
    select * into cur from public.avatar_items where sku=btrim(coalesce(r.value->>'sku',''));
    changes:='[]'::jsonb;
    if cur.id is not null then
     foreach key in array array['name','price_coins','rarity','status','season','exclusive','min_level','asset_ref','preview_ref','sort'] loop
      if r.value ? key and nullif(r.value->>key,'') is distinct from (to_jsonb(cur)->>key) then changes:=changes||to_jsonb(key); end if;
     end loop;
    end if;
    act:=private.avatar_item_upsert(r.value);
    res:=res||jsonb_build_object('line',r.line,'sku',r.value->>'sku','action',act,'changes',changes);
    if act='created' then c:=c+1; elsif act='updated' then u:=u+1; else n:=n+1; end if;
   exception when others then
    errs:=errs||jsonb_build_object('line',r.line,'sku',r.value->>'sku','message',sqlerrm);
   end;
  end loop;
  if not p_commit then raise exception 'DRY_RUN'; end if;
 exception when others then
  if sqlerrm<>'DRY_RUN' then raise; end if;
 end;
 return jsonb_build_object('created',c,'updated',u,'unchanged',n,'errors',errs,'results',res);
end $$;

-- ---------------------------------------------------------------------------
-- Administración de ONZA: catálogo e importaciones
-- ---------------------------------------------------------------------------

create function private.require_onza() returns void language plpgsql stable security definer set search_path='' as $$
begin if auth.uid() is null or not private.is_onza() then raise exception 'NOT_AUTHORIZED'; end if; end $$;

create function public.avatar_admin_catalog() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_onza();
 return jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object(
    'owners',(select count(*) from private.avatar_inventory v where v.item_id=i.id),
    'coins_collected',coalesce((select sum(v.price_paid) from private.avatar_inventory v where v.item_id=i.id and v.source='purchase'),0)) order by i.category,i.sort,i.sku)
   from public.avatar_items i),'[]'::jsonb));
end $$;

create function public.avatar_item_save(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare act text;
begin
 perform private.require_onza();
 begin act:=private.avatar_item_upsert(input);
 exception when invalid_text_representation or check_violation or not_null_violation or datetime_field_overflow or numeric_value_out_of_range then raise exception 'INVALID_INPUT'; end;
 return jsonb_build_object('action',act,'item',(select to_jsonb(i) from public.avatar_items i where i.sku=btrim(input->>'sku')));
end $$;

create function public.avatar_item_grant(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid; item uuid;
begin
 perform private.require_onza();
 begin uid:=(input->>'userId')::uuid; item:=(input->>'itemId')::uuid; exception when invalid_text_representation then raise exception 'INVALID_INPUT'; end;
 if not exists(select 1 from public.profiles where user_id=uid) or not exists(select 1 from public.avatar_items where id=item) then raise exception 'NOT_FOUND'; end if;
 insert into private.avatar_inventory(user_id,item_id,source) values(uid,item,'grant') on conflict do nothing;
 insert into private.economy_audit_log(actor_id,entity,entity_key,action,after_state) values(auth.uid(),'avatar_inventory',item::text,'grant',jsonb_build_object('user_id',uid,'item_id',item));
 return jsonb_build_object('granted',found);
end $$;

create function public.achievement_reward_item_set(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare item uuid;
begin
 perform private.require_onza();
 begin item:=nullif(input->>'itemId','')::uuid; exception when invalid_text_representation then raise exception 'INVALID_INPUT'; end;
 update public.achievements set reward_item_id=item where code=input->>'code';
 if not found then raise exception 'NOT_FOUND'; end if;
 return jsonb_build_object('code',input->>'code','item_id',item);
end $$;

create function public.catalog_import_stage(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb:=input->'rows'; app_errors jsonb:=coalesce(input->'errors','[]'::jsonb); fname text:=btrim(coalesce(input->>'filename','')); dry jsonb; id uuid;
begin
 perform private.require_onza();
 if fname='' or length(fname)>200 or jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows)>5000 or jsonb_typeof(app_errors) is distinct from 'array' or jsonb_array_length(app_errors)>500 then raise exception 'INVALID_INPUT'; end if;
 if jsonb_array_length(rows)=0 and jsonb_array_length(app_errors)=0 then raise exception 'EMPTY_IMPORT'; end if;
 if exists(select 1 from jsonb_array_elements(rows) e where jsonb_typeof(e)<>'object') then raise exception 'INVALID_INPUT'; end if;
 dry:=private.catalog_import_run(rows,false);
 insert into private.catalog_imports(actor_id,filename,total_rows,created_count,updated_count,unchanged_count,error_count,parse_errors,errors,preview,rows)
 values(auth.uid(),fname,jsonb_array_length(rows)+jsonb_array_length(app_errors),(dry->>'created')::integer,(dry->>'updated')::integer,(dry->>'unchanged')::integer,
  jsonb_array_length(app_errors)+jsonb_array_length(dry->'errors'),app_errors,app_errors||(dry->'errors'),dry->'results',rows) returning private.catalog_imports.id into id;
 return jsonb_build_object('id',id,'status','previewed','created',dry->'created','updated',dry->'updated','unchanged',dry->'unchanged',
  'errors',app_errors||(dry->'errors'),'preview',dry->'results');
end $$;

create function public.catalog_import_apply(import uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare imp private.catalog_imports; run jsonb;
begin
 perform private.require_onza();
 select * into imp from private.catalog_imports where id=import for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if imp.status<>'previewed' then raise exception 'IMPORT_NOT_PENDING'; end if;
 run:=private.catalog_import_run(imp.rows,true);
 update private.catalog_imports set status='applied',applied_at=now(),created_count=(run->>'created')::integer,updated_count=(run->>'updated')::integer,
  unchanged_count=(run->>'unchanged')::integer,error_count=jsonb_array_length(imp.parse_errors)+jsonb_array_length(run->'errors'),
  errors=imp.parse_errors||(run->'errors'),preview=run->'results'
 where id=imp.id;
 insert into private.economy_audit_log(actor_id,entity,entity_key,action,after_state)
 values(auth.uid(),'catalog_import',imp.id::text,'apply',jsonb_build_object('filename',imp.filename,'created',run->'created','updated',run->'updated','errors',jsonb_array_length(run->'errors')));
 return jsonb_build_object('id',imp.id,'status','applied','created',run->'created','updated',run->'updated','unchanged',run->'unchanged','errors',run->'errors');
end $$;

create function public.catalog_import_discard(import uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_onza();
 update private.catalog_imports set status='discarded' where id=import and status='previewed';
 if not found then raise exception 'IMPORT_NOT_PENDING'; end if;
 return jsonb_build_object('id',import,'status','discarded');
end $$;

create function public.catalog_import_list() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_onza();
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'filename',filename,'status',status,'total_rows',total_rows,'created',created_count,
   'updated',updated_count,'unchanged',unchanged_count,'errors',error_count,'created_at',created_at,'applied_at',applied_at) order by created_at desc)
  from (select * from private.catalog_imports order by created_at desc limit 50) i),'[]'::jsonb);
end $$;

create function public.catalog_import_get(import uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare imp private.catalog_imports;
begin
 perform private.require_onza();
 select * into imp from private.catalog_imports where id=import;
 if not found then raise exception 'NOT_FOUND'; end if;
 return jsonb_build_object('id',imp.id,'filename',imp.filename,'status',imp.status,'total_rows',imp.total_rows,'created',imp.created_count,'updated',imp.updated_count,
  'unchanged',imp.unchanged_count,'error_count',imp.error_count,'errors',imp.errors,'preview',imp.preview,'created_at',imp.created_at,'applied_at',imp.applied_at);
end $$;

-- ---------------------------------------------------------------------------
-- Artículos provisionales (sin diseño definitivo): permiten usar la tienda de punta a punta. Se reemplazan por CSV con el mismo sku.
-- ---------------------------------------------------------------------------

insert into public.avatar_items(sku,name,category,price_coins,rarity,status,min_level,sort) values
 ('prov_hat_01','Gorra provisional','hat',20,'common','active',1,1),
 ('prov_hat_02','Sombrero provisional','hat',60,'rare','active',2,2),
 ('prov_glasses_01','Lentes provisionales','glasses',25,'common','active',1,1),
 ('prov_top_01','Camisa provisional','top',30,'common','active',1,1),
 ('prov_jacket_01','Chaqueta provisional','jacket',80,'rare','active',3,1),
 ('prov_bottom_01','Pantalón provisional','bottom',30,'common','active',1,1),
 ('prov_shoes_01','Zapatos provisionales','shoes',35,'common','active',1,1),
 ('prov_hair_01','Peinado provisional','hair',15,'common','active',1,1),
 ('prov_accessory_01','Accesorio provisional','accessory',120,'epic','active',4,1),
 ('prov_expression_01','Expresión provisional','expression',40,'common','active',1,1),
 ('prov_background_01','Fondo provisional','background',50,'common','active',1,1),
 ('prov_effect_01','Efecto provisional','effect',200,'legendary','active',6,1)
on conflict(sku) do nothing;
insert into public.avatar_items(sku,name,category,price_coins,rarity,status,exclusive,min_level,sort) values
 ('prov_exclusive_hat','Sombrero exclusivo provisional','hat',0,'legendary','active',true,1,99)
on conflict(sku) do nothing;

-- Permisos de ejecución.
revoke execute on function public.avatar_me(),public.avatar_base_save(jsonb),public.avatar_privacy_save(jsonb),public.avatar_equip(jsonb),
 public.avatar_store(text),public.avatar_item_buy(uuid),public.avatar_admin_catalog(),public.avatar_item_save(jsonb),public.avatar_item_grant(jsonb),
 public.achievement_reward_item_set(jsonb),public.catalog_import_stage(jsonb),public.catalog_import_apply(uuid),public.catalog_import_discard(uuid),
 public.catalog_import_list(),public.catalog_import_get(uuid) from public,anon;
grant execute on function public.avatar_me(),public.avatar_base_save(jsonb),public.avatar_privacy_save(jsonb),public.avatar_equip(jsonb),
 public.avatar_store(text),public.avatar_item_buy(uuid),public.avatar_admin_catalog(),public.avatar_item_save(jsonb),public.avatar_item_grant(jsonb),
 public.achievement_reward_item_set(jsonb),public.catalog_import_stage(jsonb),public.catalog_import_apply(uuid),public.catalog_import_discard(uuid),
 public.catalog_import_list(),public.catalog_import_get(uuid) to authenticated;

do $$ declare f regprocedure; begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname in ('avatar_card','economy_achievements','avatar_item_upsert','catalog_import_run','require_onza') loop
  execute format('revoke execute on function %s from public,anon,authenticated',f);
 end loop;
end $$;
