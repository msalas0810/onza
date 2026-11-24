-- Bucket de planos de los locales (mapa interactivo). Necesita el esquema storage de Supabase (no existe en el arnés SQL).
-- Lectura pública: los clientes cargan el plano con <img>; los nombres de objeto son `<local>/<uuid>.<ext>` (UUID aleatorio, no
-- adivinable) y el listado de planos solo lo entregan las funciones de la migración 025, con permisos. Escritura: solo
-- administradores del local dueño de la carpeta. Límite de 3 MB; los rasters ya llegan optimizados desde el navegador.
-- NO hay política de actualización: un objeto nunca se sobrescribe, así una versión publicada conserva siempre SU imagen.
-- Borrar: solo imágenes que ninguna versión publicada usa.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('venue-maps','venue-maps',true,3145728,array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.map_image_in_use(path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.venue_map_versions v where v.image_path=path)
$$;
revoke all on function public.map_image_in_use(text) from public, anon;
grant execute on function public.map_image_in_use(text) to authenticated;

drop policy if exists venue_map_read on storage.objects;
drop policy if exists venue_map_insert on storage.objects;
drop policy if exists venue_map_delete on storage.objects;

create policy venue_map_read on storage.objects for select to anon, authenticated
 using (bucket_id='venue-maps');

create policy venue_map_insert on storage.objects for insert to authenticated
 with check (
  bucket_id='venue-maps'
  and array_length(storage.foldername(name),1)=1
  and name ~* '\.(jpg|jpeg|png|webp|svg)$'
  and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.has_venue_access(((storage.foldername(name))[1])::uuid,true) else false end
 );

create policy venue_map_delete on storage.objects for delete to authenticated
 using (
  bucket_id='venue-maps'
  and not public.map_image_in_use(name)
  and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.has_venue_access(((storage.foldername(name))[1])::uuid,true) else false end
 );
