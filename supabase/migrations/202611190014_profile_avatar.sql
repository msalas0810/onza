-- Plan de pulido · E2: avatar de la cuenta personal. ADITIVA (R4): una columna nullable y una función nueva.
-- La foto es privada: vive en el bucket privado `avatars` (migración 015) bajo la carpeta de la persona y solo ella la lee.
-- Nunca la ve el personal del local; el perfil social con foto pública queda para una fase propia.
alter table public.profiles
  add column if not exists avatar_path text
  check (avatar_path is null or avatar_path ~ '^[0-9a-f-]{36}/avatar-[A-Za-z0-9_-]{1,64}\.(jpg|png|webp)$');

-- Fija o quita (null) la foto propia. El camino debe estar en la carpeta de la persona: no se puede apuntar a otra.
create or replace function public.update_profile_avatar(path text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); previous text;
begin
 if uid is null then raise exception 'SESSION_REQUIRED'; end if;
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'NOT_AUTHORIZED'; end if;
 if path is not null and (split_part(path,'/',1)<>uid::text or path !~ '^[0-9a-f-]{36}/avatar-[A-Za-z0-9_-]{1,64}\.(jpg|png|webp)$') then
  raise exception 'INVALID_AVATAR';
 end if;
 select avatar_path into previous from public.profiles where user_id=uid for update;
 if not found then raise exception 'PROFILE_REQUIRED'; end if;
 update public.profiles set avatar_path=path,updated_at=now() where user_id=uid;
 return jsonb_build_object('avatarPath',path,'previousPath',previous);
end $$;
revoke execute on function public.update_profile_avatar(text) from public,anon;
grant execute on function public.update_profile_avatar(text) to authenticated;
