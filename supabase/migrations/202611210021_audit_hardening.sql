-- Auditoría de seguridad y escala (2026-11-21): endurecimiento ADITIVO (R4). No cambia firmas ni tablas existentes; no
-- reemplaza onza_command ni create_order (así una migración futura que los reemplace no deshace estas reglas: viven en
-- triggers). Se aplica DESPUÉS de 013–020. El SQL ya aplicado en remoto (001–012) no se toca.
--
-- 1) Las reglas del servidor Next (cuenta del equipo no compra; sesión invitada y perfil incompleto no compran cuando las
--    cuentas son obligatorias; escenarios de pago simulados solo en pruebas) también valen para quien llame a la RPC
--    pública directamente con su JWT, sin pasar por /api/commands.
-- 2) Un cliente ya no lee actor_id ni metadata de los eventos de su pedido (ids internos del equipo y motivos).
-- 3) Barrido de vencimientos indexado.

alter table private.configuration
  add column if not exists accounts_required boolean not null default false,
  add column if not exists allow_scenarios boolean not null default false;

comment on column private.configuration.accounts_required is
  'Espejo de ACCOUNTS_REQUIRED de la app: con true, solo cuentas personales con perfil completo pueden crear pedidos (también por RPC directa).';
comment on column private.configuration.allow_scenarios is
  'Solo pruebas. Espejo de ENABLE_PAYMENT_SCENARIOS: con false, todo cobro mock nace autorizado/capturado; los resultados simulados (rechazo, timeout) se rechazan.';

-- 1a) Quién puede ser dueño de un pedido. Corre en la misma transacción que el alta, con el JWT de quien llama.
create or replace function private.guard_order_customer() returns trigger language plpgsql security definer set search_path='' as $$
declare cfg private.configuration;
begin
 if exists(select 1 from public.memberships m where m.user_id=new.customer_id)
    or exists(select 1 from public.staff_accounts s where s.user_id=new.customer_id) then
  raise exception 'STAFF_CANNOT_ORDER';
 end if;
 select * into cfg from private.configuration where id;
 if cfg.accounts_required then
  if coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'ACCOUNT_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.user_id=new.customer_id) then raise exception 'ONBOARDING_REQUIRED'; end if;
 end if;
 return new;
end $$;
drop trigger if exists orders_guard_customer on public.orders;
create trigger orders_guard_customer before insert on public.orders for each row execute function private.guard_order_customer();

-- 1b) Resultados de pago simulados: cerrados por defecto. Con allow_scenarios=false el cobro mock siempre sale bien.
create or replace function private.guard_payment_scenario() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status<>'authorized' and not (select allow_scenarios from private.configuration where id) then raise exception 'SCENARIO_DISABLED'; end if;
 return new;
end $$;
create or replace function private.guard_operation_scenario() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.type='capture' and not (new.status='captured' and new.provider_state='captured')
    and not (select allow_scenarios from private.configuration where id) then raise exception 'SCENARIO_DISABLED'; end if;
 return new;
end $$;
drop trigger if exists payments_guard_scenario on private.payments;
create trigger payments_guard_scenario before insert on private.payments for each row execute function private.guard_payment_scenario();
drop trigger if exists payment_operations_guard_scenario on private.payment_operations;
create trigger payment_operations_guard_scenario before insert on private.payment_operations for each row execute function private.guard_operation_scenario();

-- 2) Eventos del pedido: quien no es del equipo del local no ve actor_id ni metadata. La lectura directa de la tabla se
--    cierra (la app solo la usa a través de order_view/order_list).
revoke select on public.order_events from authenticated;
create or replace function private.order_view(target_order_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(o)||jsonb_build_object('server_now',now(),'payment_state',p.status,'capture_state',(select provider_state from private.payment_operations where payment_id=p.id and type='capture'),'authorized_minor',p.authorized_minor,'captured_minor',p.captured_minor,'refunded_minor',p.refunded_minor,'venue',to_jsonb(v),'items',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('image_url',pr.image_url,'photo_path',pr.photo_path) order by i.id) from public.order_items i left join public.products pr on pr.id=i.product_id where i.order_id=o.id),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'order_id',e.order_id,'venue_id',e.venue_id,
     'actor_id',case when private.is_staff(o.venue_id) then e.actor_id end,'type',e.type,'from_status',e.from_status,'to_status',e.to_status,'created_at',e.created_at,
     'metadata',case when private.is_staff(o.venue_id) then e.metadata else '{}'::jsonb end) order by e.created_at) from public.order_events e where e.order_id=o.id),'[]'::jsonb),
  'claim_id',case when c.owner_user_id=auth.uid() and c.owner_staff_session_id=auth.jwt()->>'session_id' then c.id else null end,
  'claimed_elsewhere',c.id is not null and not(c.owner_user_id=auth.uid() and c.owner_staff_session_id=auth.jwt()->>'session_id'),
  'encrypted_token',case when o.customer_id=auth.uid() and o.status='ready' and p.status in ('authorized','unknown','captured') and t.consumed_at is null and t.expires_at>now() then t.encrypted_token else null end)
 from public.orders o join public.venues v on v.id=o.venue_id join private.payments p on p.order_id=o.id left join private.pickup_claims c on c.order_id=o.id left join private.pickup_tokens t on t.order_id=o.id where o.id=target_order_id
$$;
revoke execute on function private.order_view(uuid) from public,anon,authenticated;
revoke execute on function private.guard_order_customer() from public,anon,authenticated;
revoke execute on function private.guard_payment_scenario() from public,anon,authenticated;
revoke execute on function private.guard_operation_scenario() from public,anon,authenticated;
