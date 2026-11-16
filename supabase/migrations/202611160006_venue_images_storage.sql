-- Public bucket for venue cover photos and logos. Reading is public; writing is limited to admins of the venue that owns
-- the first path segment (<venue_id>/<file>). Needs the Supabase storage schema (not available in the SQL test harness).
-- File size and MIME type are enforced by the Storage service from the bucket settings below (2 MB, jpg/png/webp). SVG is
-- intentionally excluded because it can carry scripts.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('venue-images','venue-images',true,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists venue_image_read on storage.objects;
drop policy if exists venue_image_insert on storage.objects;
drop policy if exists venue_image_update on storage.objects;
drop policy if exists venue_image_delete on storage.objects;

create policy venue_image_read on storage.objects for select to anon, authenticated
 using (bucket_id='venue-images');

-- A venue admin can only touch objects stored directly under their own venue id folder, with an allowed extension.
create policy venue_image_insert on storage.objects for insert to authenticated
 with check (
  bucket_id='venue-images'
  and array_length(storage.foldername(name),1)=1
  and name ~* '\.(jpg|jpeg|png|webp)$'
  and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.has_venue_access(((storage.foldername(name))[1])::uuid,true) else false end
 );
create policy venue_image_update on storage.objects for update to authenticated
 using (
  bucket_id='venue-images'
  and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.has_venue_access(((storage.foldername(name))[1])::uuid,true) else false end
 )
 with check (
  bucket_id='venue-images'
  and array_length(storage.foldername(name),1)=1
  and name ~* '\.(jpg|jpeg|png|webp)$'
  and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.has_venue_access(((storage.foldername(name))[1])::uuid,true) else false end
 );
create policy venue_image_delete on storage.objects for delete to authenticated
 using (
  bucket_id='venue-images'
  and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.has_venue_access(((storage.foldername(name))[1])::uuid,true) else false end
 );
