-- Customer accounts: profile, onboarding, consent record and preferences.
-- ADDITIVE ONLY (R4): no existing table, column, policy or function signature changes.
-- The deployed demo keeps working before and after this migration. Apply it BEFORE
-- deploying a frontend that sets ACCOUNTS_REQUIRED=true.
create table public.profiles(
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null check(length(btrim(full_name)) between 2 and 100),
 username text not null check(username ~ '^[a-z0-9_.]{3,20}$'),
 phone_country text not null check(phone_country ~ '^\+[0-9]{1,3}$'),
 phone_e164 text not null check(phone_e164 ~ '^\+[0-9]{8,15}$'),
 phone_verified boolean not null default false check(phone_verified=false),
 birth_date date not null,
 adult_declared boolean not null default true check(adult_declared),
 terms_version text not null,
 privacy_version text not null,
 terms_accepted_at timestamptz not null,
 news_opt_in boolean not null default false,
 offers_opt_in boolean not null default false,
 onboarded_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index profiles_username_key on public.profiles(lower(username));
alter table public.profiles enable row level security;
revoke all on public.profiles from public,anon,authenticated;
grant select on public.profiles to authenticated;
-- Personal data is readable only by its owner (never by venue staff).
create policy own_profile on public.profiles for select to authenticated using(user_id=auth.uid());

-- Which kind of account is this? Staff = any venue membership. Never trusts the client.
create function public.current_account() returns jsonb language sql stable security definer set search_path='' as $$
 select case
  when auth.uid() is null then jsonb_build_object('kind','none','onboarded',false)
  when coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then jsonb_build_object('kind','guest','onboarded',false)
  when exists(select 1 from public.memberships m where m.user_id=auth.uid()) then jsonb_build_object('kind','staff','onboarded',false)
  else jsonb_build_object('kind','customer','onboarded',exists(select 1 from public.profiles p where p.user_id=auth.uid()))
 end
$$;

-- Onboarding. Server-side 18+ check from the declared birth date (not a document check).
-- Phone is normalised and explicitly NOT verified. Terms acceptance is recorded with date and version.
create function public.complete_onboarding(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid();
 nm text; un text; cc text; nat text; e164 text; bd date; tv text; pv text;
 p public.profiles;
begin
 if uid is null then raise exception 'SESSION_REQUIRED'; end if;
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'NOT_AUTHORIZED'; end if;
 if exists(select 1 from public.memberships m where m.user_id=uid) then raise exception 'STAFF_ACCOUNT'; end if;
 if input is null or jsonb_typeof(input)<>'object' then raise exception 'INVALID_PROFILE'; end if;
 nm:=btrim(coalesce(input->>'fullName',''));
 un:=lower(btrim(coalesce(input->>'username','')));
 cc:=btrim(coalesce(input->>'phoneCountry',''));
 nat:=regexp_replace(coalesce(input->>'phone',''),'[^0-9]','','g');
 tv:=coalesce(input->>'termsVersion',''); pv:=coalesce(input->>'privacyVersion','');
 if length(nm) not between 2 and 100 then raise exception 'INVALID_NAME'; end if;
 if un !~ '^[a-z0-9_.]{3,20}$' then raise exception 'INVALID_USERNAME'; end if;
 if cc !~ '^\+[0-9]{1,3}$' then raise exception 'INVALID_PHONE'; end if;
 e164:=cc||nat;
 if e164 !~ '^\+[0-9]{8,15}$' then raise exception 'INVALID_PHONE'; end if;
 begin bd:=(input->>'birthDate')::date; exception when others then raise exception 'INVALID_BIRTH_DATE'; end;
 if bd is null or bd>current_date or bd<date '1900-01-01' then raise exception 'INVALID_BIRTH_DATE'; end if;
 if bd>(current_date-interval '18 years')::date then raise exception 'UNDERAGE'; end if;
 if tv='' or pv='' or length(tv)>40 or length(pv)>40 or (input->>'accepted') is distinct from 'true' then raise exception 'TERMS_REQUIRED'; end if;
 if exists(select 1 from public.profiles x where lower(x.username)=un and x.user_id<>uid) then raise exception 'USERNAME_TAKEN'; end if;
 insert into public.profiles(user_id,full_name,username,phone_country,phone_e164,birth_date,terms_version,privacy_version,terms_accepted_at,news_opt_in,offers_opt_in)
 values(uid,nm,un,cc,e164,bd,tv,pv,now(),coalesce((input->>'news')='true',false),coalesce((input->>'offers')='true',false))
 on conflict(user_id) do update set full_name=excluded.full_name,username=excluded.username,phone_country=excluded.phone_country,phone_e164=excluded.phone_e164,
  birth_date=excluded.birth_date,terms_version=excluded.terms_version,privacy_version=excluded.privacy_version,terms_accepted_at=excluded.terms_accepted_at,
  news_opt_in=excluded.news_opt_in,offers_opt_in=excluded.offers_opt_in,updated_at=now()
 returning * into p;
 return jsonb_build_object('onboarded',true,'username',p.username);
end $$;

-- Preferences only. A new terms version is NOT recorded here (R5): it needs complete_onboarding / an explicit acceptance.
create function public.update_preferences(news boolean,offers boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'SESSION_REQUIRED'; end if;
 update public.profiles set news_opt_in=coalesce(news,false),offers_opt_in=coalesce(offers,false),updated_at=now() where user_id=auth.uid();
 if not found then raise exception 'PROFILE_REQUIRED'; end if;
end $$;

revoke execute on function public.current_account(),public.complete_onboarding(jsonb),public.update_preferences(boolean,boolean) from public,anon;
grant execute on function public.current_account(),public.complete_onboarding(jsonb),public.update_preferences(boolean,boolean) to authenticated;
