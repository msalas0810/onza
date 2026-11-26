-- Entrada como invitado junto al acceso con cuenta (opcional, apagada por defecto).
-- Con accounts_required=true un invitado de Supabase (JWT anónimo) pide solo si guests_allowed=true.
-- Migración aditiva (R4): con guests_allowed=false el comportamiento es idéntico al de la 021.
-- La lista de espera y la cuenta personal siguen exigiendo una cuenta.
alter table private.configuration
  add column if not exists guests_allowed boolean not null default false;
comment on column private.configuration.guests_allowed is
  'Espejo de GUEST_ACCESS=true de la app. Solo tiene efecto con accounts_required=true: permite pedir con sesión anónima.';

create or replace function private.guard_order_customer() returns trigger language plpgsql security definer set search_path='' as $$
declare cfg private.configuration; anon boolean;
begin
 if exists(select 1 from public.memberships m where m.user_id=new.customer_id)
    or exists(select 1 from public.staff_accounts s where s.user_id=new.customer_id) then
  raise exception 'STAFF_CANNOT_ORDER';
 end if;
 select * into cfg from private.configuration where id;
 if cfg.accounts_required then
  anon:=coalesce((auth.jwt()->>'is_anonymous')::boolean,false);
  if anon then
   if not cfg.guests_allowed then raise exception 'ACCOUNT_REQUIRED'; end if;
  elsif not exists(select 1 from public.profiles p where p.user_id=new.customer_id) then
   raise exception 'ONBOARDING_REQUIRED';
  end if;
 end if;
 return new;
end $$;
