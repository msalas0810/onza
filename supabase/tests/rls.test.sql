-- Run against the disposable Supabase local DB: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(5);
select has_table('public','orders','orders exists');
select ok((select relrowsecurity from pg_class where oid='public.orders'::regclass),'orders RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.memberships'::regclass),'membership RLS enabled');
set local role anon;
select throws_ok('select * from private.pickup_tokens','42501',null,'anon cannot read pickup tokens');
select throws_ok('insert into public.memberships(user_id,venue_id,role) values(gen_random_uuid(),gen_random_uuid(),''admin'')','42501',null,'anon cannot grant roles');
reset role;
select * from finish();
rollback;
