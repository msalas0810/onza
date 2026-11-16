-- Supabase services are configured only by this migration (not the test harness).
alter publication supabase_realtime add table public.orders;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('menu-photos','menu-photos',true,5242880,array['image/webp','image/avif','image/jpeg','image/png']) on conflict(id) do nothing;
create policy menu_photo_read on storage.objects for select using(bucket_id='menu-photos');
create policy menu_photo_write on storage.objects for insert to authenticated with check(bucket_id='menu-photos' and public.has_venue_access((storage.foldername(name))[1]::uuid,true));
create policy menu_photo_update on storage.objects for update to authenticated using(bucket_id='menu-photos' and public.has_venue_access((storage.foldername(name))[1]::uuid,true)) with check(bucket_id='menu-photos' and public.has_venue_access((storage.foldername(name))[1]::uuid,true));
create policy menu_photo_delete on storage.objects for delete to authenticated using(bucket_id='menu-photos' and public.has_venue_access((storage.foldername(name))[1]::uuid,true));
-- Seed tooling uses service_role only outside the web runtime.
grant all on public.memberships,public.venues,public.categories,public.products to service_role;
