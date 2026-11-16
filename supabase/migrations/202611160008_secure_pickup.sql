-- INC-001: additive function replacement. No table data, encryption key or existing ticket changes.
-- Keep order/payment locks, idempotent ledger and staff-session claims from the original function.
create or replace function public.onza_command(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 action text:=input->>'action'; uid uuid:=auth.uid(); sid text:=auth.jwt()->>'session_id';
 v public.venues; o public.orders; product public.products; p private.payments; c private.pickup_claims;
 item jsonb; total integer:=0; units integer:=0; payload jsonb; previous private.commands; event_id uuid; scenario text; next_state text; op private.payment_operations; key text:=input->>'idempotencyKey'; count_active integer; token private.pickup_tokens; result jsonb;
begin
 if uid is null then raise exception 'NOT_AUTHORIZED';end if;
 if not (select demo_enabled from private.configuration where id) then raise exception 'DEMO_NOT_ENABLED';end if;
 perform public.sweep_orders();
 if action='create' then
  if key is null or length(key) not between 1 and 128 then raise exception 'INVALID_INPUT';end if;
  payload:=input-'idempotencyKey'-'tokenHash'-'encryptedToken';
  perform pg_advisory_xact_lock(hashtextextended(uid::text||key,0));
  select * into previous from private.commands where actor_id=uid and command_key=key;
  if found then if previous.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return private.order_view(previous.order_id);end if;
  if not private.limit_action('create',12) then return jsonb_build_object('error','RATE_LIMITED');end if;
  select * into v from public.venues where id=(input->>'venueId')::uuid for update;
  if not found then raise exception 'RESOURCE_NOT_FOUND';end if;
  if v.open_state<>'open' then raise exception 'VENUE_CLOSED';end if;
  if v.paused then raise exception 'VENUE_PAUSED';end if;
  select count(*) into count_active from public.orders where venue_id=v.id and status in ('pending_authorization','queued','preparing','ready');
  if count_active>=v.capacity then raise exception 'VENUE_CAPACITY';end if;
  if input->>'termsVersion' is distinct from 'demo-v1' or input->>'privacyVersion' is distinct from 'demo-v1' or coalesce((input->>'adult')::boolean,false)=false then raise exception 'POLICY_REQUIRED';end if;
  if jsonb_typeof(input->'items')<>'array' or jsonb_array_length(input->'items') not between 1 and 20 then raise exception 'INVALID_INPUT';end if;
  if (select count(*) from jsonb_array_elements(input->'items'))<>(select count(distinct x->>'productId') from jsonb_array_elements(input->'items') x) then raise exception 'INVALID_INPUT';end if;
  for item in select * from jsonb_array_elements(input->'items') loop
   if not(item?'productId' and item?'quantity' and item?'expectedProductVersion') then raise exception 'INVALID_INPUT';end if;
   if (item->>'quantity')::numeric<>trunc((item->>'quantity')::numeric) or (item->>'quantity')::integer not between 1 and 10 then raise exception 'INVALID_QUANTITY';end if;
   select * into product from public.products where id=(item->>'productId')::uuid and venue_id=v.id for share;
   if not found or not product.available or product.archived then raise exception 'OUT_OF_STOCK';end if;
   if product.version is distinct from (item->>'expectedProductVersion')::integer then raise exception 'PRICE_CHANGED';end if;
   total:=total+product.price_minor*(item->>'quantity')::integer;units:=units+(item->>'quantity')::integer;
  end loop;
  if units>v.max_units then raise exception 'INVALID_QUANTITY';end if;
  if length(input->>'tokenHash')<>64 or coalesce(length(input->>'encryptedToken'),0)<1 then raise exception 'INVALID_TOKEN';end if;
  scenario:=coalesce(input->>'scenario','approved');
  if scenario not in ('approved','declined','requires_action','timeout') then raise exception 'INVALID_INPUT';end if;
  next_state:=case scenario when 'approved' then 'queued' when 'declined' then 'canceled' else 'pending_authorization' end;
  insert into public.orders(venue_id,customer_id,public_code,status,total_minor,deadline) values(v.id,uid,upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),next_state,total,now()+interval '2 minutes') returning * into o;
  for item in select * from jsonb_array_elements(input->'items') loop
   select * into product from public.products where id=(item->>'productId')::uuid;
   insert into public.order_items(order_id,venue_id,product_id,name_snapshot,unit_price_minor_snapshot,quantity,line_total_minor) values(o.id,v.id,product.id,product.name,product.price_minor,(item->>'quantity')::integer,product.price_minor*(item->>'quantity')::integer);
  end loop;
  insert into private.payments(order_id,merchant_config_ref,status,authorized_minor,provider_reference) values(o.id,'mock:'||v.id,case scenario when 'approved' then 'authorized' when 'declined' then 'failed' when 'timeout' then 'unknown' else 'authorizing' end,case when scenario='approved' then total else 0 end,case when scenario<>'timeout' then 'mock-'||o.id else null end) returning * into p;
  insert into private.payment_operations(payment_id,type,idempotency_key,status,provider_state,amount_minor) values(p.id,'authorize','authorize:'||o.id,p.status,case scenario when 'approved' then 'authorized' when 'declined' then 'declined' when 'requires_action' then 'requires_action' else 'unknown' end,total);
  insert into private.pickup_tokens(order_id,token_hash,encrypted_token) values(o.id,input->>'tokenHash',input->>'encryptedToken');
  insert into private.policy_acceptances(order_id,customer_id,terms_version,privacy_version) values(o.id,uid,input->>'termsVersion',input->>'privacyVersion');
  insert into private.commands values(uid,key,payload,o.id);
  perform private.event(o,'created');return private.order_view(o.id);
 end if;
 if action='venue_update' then
  if not private.is_staff((input->>'venueId')::uuid) then raise exception 'NOT_AUTHORIZED';end if;
  if input-'action'-'venueId'-'paused'<>'{}'::jsonb and not private.is_staff((input->>'venueId')::uuid,true) then raise exception 'NOT_AUTHORIZED';end if;
  update public.venues set paused=coalesce((input->>'paused')::boolean,paused),name=coalesce(nullif(input->>'name',''),name),zone=coalesce(input->>'zone',zone),pickup_label=coalesce(input->>'pickupLabel',pickup_label),support_contact=coalesce(input->>'supportContact',support_contact),hours=coalesce(input->>'hours',hours),open_state=coalesce(input->>'openState',open_state),eta_minutes=coalesce((input->>'etaMinutes')::integer,eta_minutes),capacity=coalesce((input->>'capacity')::integer,capacity) where id=(input->>'venueId')::uuid returning * into v;
  return to_jsonb(v);
 end if;
 if action='product_save' then
  if not private.is_staff((input->>'venueId')::uuid,true) then raise exception 'NOT_AUTHORIZED';end if;
  if input->>'productId' is null then
   insert into public.products(venue_id,category_id,name,description,price_minor,size,allergens,available,photo_path) values((input->>'venueId')::uuid,(input->>'categoryId')::uuid,input->>'name',coalesce(input->>'description',''),(input->>'priceMinor')::integer,coalesce(input->>'size',''),coalesce(input->>'allergens','No informado por el local'),coalesce((input->>'available')::boolean,true),input->>'photoPath') returning * into product;
  else
   update public.products set name=coalesce(input->>'name',name),description=coalesce(input->>'description',description),price_minor=coalesce((input->>'priceMinor')::integer,price_minor),category_id=coalesce((input->>'categoryId')::uuid,category_id),size=coalesce(input->>'size',size),allergens=coalesce(input->>'allergens',allergens),photo_path=case when input?'photoPath' then input->>'photoPath' else photo_path end,available=coalesce((input->>'available')::boolean,available),archived=coalesce((input->>'archived')::boolean,archived),version=version+1 where id=(input->>'productId')::uuid and venue_id=(input->>'venueId')::uuid and version=(input->>'expectedVersion')::integer returning * into product;
   if not found then raise exception 'VERSION_CONFLICT';end if;
  end if;return to_jsonb(product);
 end if;
 if action='resolve' then
  if not private.limit_action('resolve',10) then return jsonb_build_object('error','RATE_LIMITED');end if;
  -- Manual credential is 48 unpredictable bits derived from the private 256-bit token digest.
  -- Works with existing encrypted tickets, without rotating keys or replacing credentials.
  -- Never resolve using the public order number. Reject ambiguous digest prefixes.
  select * into o from public.orders where venue_id=(input->>'venueId')::uuid and id in(
   select order_id from private.pickup_tokens where
    (input->>'tokenHash' ~ '^[a-f0-9]{64}$' and token_hash=input->>'tokenHash') or
    (input->>'code' ~ '^[A-Fa-f0-9]{12}$' and left(token_hash,12)=lower(input->>'code') and
     (select count(*) from private.pickup_tokens t2 where left(t2.token_hash,12)=lower(input->>'code'))=1)
  );
  if not found or not private.is_staff(o.venue_id) then return jsonb_build_object('error','INVALID_PICKUP');end if;
 else
  select * into o from public.orders where id=(input->>'orderId')::uuid;
  if not found or not(o.customer_id=uid or private.is_staff(o.venue_id)) then raise exception 'NOT_AUTHORIZED';end if;
 end if;
 -- Serialize all mutations on one order, including cancellation/capture races.
 select * into o from public.orders where id=o.id for update;
 select * into p from private.payments where private.payments.order_id=o.id for update;
 select * into c from private.pickup_claims where private.pickup_claims.order_id=o.id;
 if action='get' then return private.order_view(o.id);end if;
 if action='reconcile_authorization' then
  if not private.is_staff(o.venue_id,true) then raise exception 'NOT_AUTHORIZED';end if;
  if o.status<>'pending_authorization' or p.status<>'unknown' or coalesce((input->>'providerResultConfirmed')::boolean,false)=false or length(coalesce(input->>'reason',''))<5 or coalesce(input->>'outcome','') not in ('authorized','voided') then raise exception 'INVALID_TRANSITION';end if;
  -- Explicit simulated provider evidence; no second authorize attempt is performed.
  update private.payment_operations set status=input->>'outcome',provider_state=input->>'outcome' where payment_id=p.id and type='authorize';
  update private.payments set status=input->>'outcome',authorized_minor=case when input->>'outcome'='authorized' then o.total_minor else 0 end,provider_reference='mock-reconciled-'||o.id where id=p.id;
  update public.orders set status=case when input->>'outcome'='authorized' then 'queued' else 'canceled' end,deadline=now()+interval '2 minutes',version=version+1 where id=o.id returning * into o;
  perform private.event(o,'authorization_reconciled',null,jsonb_build_object('reason',input->>'reason','evidence','simulated_provider_result'));return private.order_view(o.id);
 end if;
 if action='authorize_action' then
  if o.customer_id<>uid or o.status<>'pending_authorization' or p.status<>'authorizing' then raise exception 'INVALID_TRANSITION';end if;
  update private.payments set status='authorized',authorized_minor=o.total_minor where id=p.id;
  update private.payment_operations set status='authorized',provider_state='authorized' where payment_id=p.id and type='authorize';
  update public.orders set status='queued',version=version+1,deadline=now()+interval '2 minutes' where id=o.id returning * into o;
  perform private.event(o,'authorization_confirmed');return private.order_view(o.id);
 end if;
 if action in ('accept','ready','cancel') then
  if key is null or input->>'expectedVersion' is null then raise exception 'INVALID_INPUT';end if;
  payload:=input-'idempotencyKey';select * into previous from private.commands where actor_id=uid and command_key=key;
  if found then if previous.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return private.order_view(previous.order_id);end if;
  if o.version<>(input->>'expectedVersion')::integer then raise exception 'VERSION_CONFLICT';end if;
  next_state:=o.status;
  if action='accept' then
   if not private.is_staff(o.venue_id) then raise exception 'NOT_AUTHORIZED';end if;
   if o.status<>'queued' or p.status<>'authorized' then raise exception 'INVALID_TRANSITION';end if;
   next_state:='preparing';
  elsif action='ready' then
   if not private.is_staff(o.venue_id) then raise exception 'NOT_AUTHORIZED';end if;
   if o.status<>'preparing' or p.status<>'authorized' then raise exception 'INVALID_TRANSITION';end if;
   next_state:='ready';
  else
   if length(trim(coalesce(input->>'reason','')))<3 then raise exception 'REASON_REQUIRED';end if;
   if o.status not in ('queued','preparing','ready','pending_authorization') or p.status in ('captured','capture_pending','unknown','refunded') or (c.id is not null and not exists(select 1 from private.payment_operations where payment_id=p.id and type='capture' and provider_state='declined')) then raise exception 'PAYMENT_UNCONFIRMED';end if;
   if not private.is_staff(o.venue_id) and o.status<>'queued' then raise exception 'INVALID_TRANSITION';end if;
   next_state:='canceled';
   update private.payments set status='voided' where id=p.id;
   insert into private.payment_operations(payment_id,type,idempotency_key,status,provider_state,amount_minor) values(p.id,'void','void:'||o.id,'voided','voided',o.total_minor) on conflict do nothing;
  end if;
  update public.orders set status=next_state,version=version+1,preparing_at=case when next_state='preparing' then now() else preparing_at end,ready_at=case when next_state='ready' then now() else ready_at end,deadline=case when next_state='ready' then now()+interval '20 minutes' when next_state='preparing' then now()+interval '2 hours' else deadline end where id=o.id returning * into o;
  event_id:=private.event(o,action,case action when 'accept' then 'queued' when 'ready' then 'preparing' else null end,jsonb_build_object('reason',input->>'reason'));
  if action='ready' then insert into private.notifications(order_id,event_id) values(o.id,event_id);end if;
  insert into private.commands values(uid,key,payload,o.id);
  return private.order_view(o.id);
 end if;
 if action in ('resolve','capture','complete','reconcile','transfer','refund') then
  if not private.is_staff(o.venue_id) or coalesce(sid,'')='' then raise exception 'NOT_AUTHORIZED';end if;
  if action='resolve' then
   if o.status='delivered' then return jsonb_build_object('error','ALREADY_DELIVERED');end if;
   select * into token from private.pickup_tokens where private.pickup_tokens.order_id=o.id;
   if token.consumed_at is not null or token.expires_at<=now() or o.status<>'ready' or p.expires_at<=now() then return jsonb_build_object('error','EXPIRED');end if;
   if c.id is not null and c.claimed_at<now()-interval '2 minutes' and not exists(select 1 from private.payment_operations where payment_id=p.id and type='capture') then update private.pickup_claims set owner_user_id=uid,owner_staff_session_id=sid,claimed_at=now() where id=c.id;end if;
   if c.id is null then insert into private.pickup_claims(order_id,owner_user_id,owner_staff_session_id) values(o.id,uid,sid) returning * into c;end if;
   return private.order_view(o.id);
  end if;
  if action='transfer' then
   if not private.is_staff(o.venue_id,true) or input->>'physicalCheck'<>'not_delivered' or length(coalesce(input->>'reason',''))<5 or c.id is null or o.status<>'ready' then raise exception 'SUPERVISOR_REVIEW_REQUIRED';end if;
   update private.pickup_claims set owner_user_id=uid,owner_staff_session_id=sid where id=c.id;
   perform private.event(o,'claim_transferred',null,jsonb_build_object('previous_owner',c.owner_user_id,'reason',input->>'reason','physical_check','not_delivered'));
   return private.order_view(o.id);
  end if;
  if action='refund' then
   if not private.is_staff(o.venue_id,true) then raise exception 'NOT_AUTHORIZED';end if;
   if p.status='refunded' then return private.order_view(o.id);end if;
   if not private.is_staff(o.venue_id,true) or p.status<>'captured' or length(coalesce(input->>'reason',''))<5 then raise exception 'INVALID_TRANSITION';end if;
   update private.payments set status='refunded',refunded_minor=captured_minor where id=p.id;
   insert into private.payment_operations(payment_id,type,idempotency_key,status,provider_state,amount_minor) values(p.id,'refund','refund:'||o.id,'refunded','refunded',p.captured_minor) on conflict do nothing;
   if o.status<>'delivered' then update public.orders set status='canceled',version=version+1 where id=o.id returning * into o;end if;
   perform private.event(o,'refunded',null,jsonb_build_object('reason',input->>'reason'));return private.order_view(o.id);
  end if;
  if input->>'claimId' is null or c.id is null or c.owner_user_id<>uid or c.owner_staff_session_id<>sid or c.id<>(input->>'claimId')::uuid then raise exception 'CLAIM_OWNED_ELSEWHERE';end if;
  if action in ('complete','capture','reconcile') and o.status='delivered' then return private.order_view(o.id);end if;
  if o.status<>'ready' then raise exception 'INVALID_TRANSITION';end if;
  if action='capture' then
   if p.status='captured' then return private.order_view(o.id);end if;
   if p.status<>'authorized' then raise exception 'PAYMENT_UNCONFIRMED';end if;
   if p.expires_at<=now() then raise exception 'EXPIRED';end if;
   scenario:=coalesce(input->>'scenario','approved');if scenario not in ('approved','declined','timeout_after_success','unknown') then raise exception 'INVALID_INPUT';end if;
   insert into private.payment_operations(payment_id,type,idempotency_key,status,provider_state,amount_minor) values(p.id,'capture','capture:'||o.id,case when scenario='approved' then 'captured' when scenario='declined' then 'failed' else 'unknown' end,case when scenario in ('approved','timeout_after_success') then 'captured' when scenario='declined' then 'declined' else 'unknown' end,o.total_minor) on conflict(payment_id,type) do nothing returning * into op;
   if not found then raise exception 'PAYMENT_UNCONFIRMED';end if;
   update private.payments set status=case when scenario='approved' then 'captured' when scenario='declined' then 'authorized' else 'unknown' end,captured_minor=case when scenario='approved' then o.total_minor else 0 end where id=p.id;
   perform private.event(o,'capture_attempt');return private.order_view(o.id);
  elsif action='reconcile' then
   select * into op from private.payment_operations where payment_id=p.id and type='capture';
   if op.provider_state='captured' then update private.payments set status='captured',captured_minor=op.amount_minor where id=p.id;update private.payment_operations set status='captured' where id=op.id;perform private.event(o,'capture_reconciled');end if;
   return private.order_view(o.id);
  elsif action='complete' then
   if p.status<>'captured' then raise exception 'PAYMENT_UNCONFIRMED';end if;
   if coalesce((input->>'physicalHandoff')::boolean,false)=false then raise exception 'PHYSICAL_HANDOFF_REQUIRED';end if;
   update public.orders set status='delivered',delivered_at=now(),version=version+1 where id=o.id returning * into o;
   update private.pickup_tokens set consumed_at=now() where private.pickup_tokens.order_id=o.id;
   update private.pickup_claims set status='completed' where id=c.id;
   perform private.event(o,'delivered','ready');return private.order_view(o.id);
  end if;
 end if;
 raise exception 'INVALID_INPUT';
end $$;


create index if not exists pickup_manual_lookup on private.pickup_tokens ((left(token_hash,12)));
