-- Bucket PRIVADO para Drink Stories. Cada persona sube solo a `<su user id>/story-<id>.<ext>`; lee sus archivos y los de las
-- historias que la base le permite ver (amigas, públicas, no ocultas ni vencidas). Tamaño y tipo los aplica Storage desde la
-- configuración del bucket (50 MB; jpg/png/webp/mp4/webm; sin SVG). Requiere el esquema storage de Supabase.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('stories','stories',false,52428800,array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Predicado de RLS: la política lo ejecuta con el rol de la persona (como is_staff y can_read_order en el esquema private).
grant execute on function private.story_path_visible(text) to authenticated;

drop policy if exists story_read on storage.objects;
drop policy if exists story_insert on storage.objects;
drop policy if exists story_delete on storage.objects;

create policy story_read on storage.objects for select to authenticated
 using (bucket_id='stories' and ((storage.foldername(name))[1]=auth.uid()::text or private.story_path_visible(name)));
create policy story_insert on storage.objects for insert to authenticated
 with check (
  bucket_id='stories'
  and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
  and array_length(storage.foldername(name),1)=1
  and (storage.foldername(name))[1]=auth.uid()::text
  and name ~* '/story-[A-Za-z0-9_-]{1,64}\.(jpg|png|webp|mp4|webm)$'
 );
create policy story_delete on storage.objects for delete to authenticated
 using (bucket_id='stories' and (storage.foldername(name))[1]=auth.uid()::text);
