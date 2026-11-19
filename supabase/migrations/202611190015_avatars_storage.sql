-- Bucket PRIVADO para avatares de cuentas personales. Cada persona lee y escribe solo en `<su user id>/`.
-- Requiere el esquema storage de Supabase (en pruebas se usa el stub de tests/db/helpers.ts). Tamaño y tipo los aplica
-- Storage desde la configuración del bucket (1 MB, jpg/png/webp; sin SVG).
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',false,1048576,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists avatar_read on storage.objects;
drop policy if exists avatar_insert on storage.objects;
drop policy if exists avatar_update on storage.objects;
drop policy if exists avatar_delete on storage.objects;

create policy avatar_read on storage.objects for select to authenticated
 using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatar_insert on storage.objects for insert to authenticated
 with check (
  bucket_id='avatars'
  and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
  and array_length(storage.foldername(name),1)=1
  and (storage.foldername(name))[1]=auth.uid()::text
  and name ~* '/avatar-[A-Za-z0-9_-]{1,64}\.(jpg|png|webp)$'
 );
create policy avatar_update on storage.objects for update to authenticated
 using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text)
 with check (bucket_id='avatars' and array_length(storage.foldername(name),1)=1 and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatar_delete on storage.objects for delete to authenticated
 using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
