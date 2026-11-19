-- Rescate · C09: nombre y @usuario editables desde Cuenta. ADITIVA (R4): una función nueva, sin tocar tablas.
-- Mismas reglas que `complete_onboarding` (nombre 2–100, @usuario 3–20 en minúsculas, único sin distinguir mayúsculas).
-- Teléfono y fecha de nacimiento no se cambian acá: siguen la ruta del alta. Personal laboral no usa perfil de cliente.
create or replace function public.update_profile_details(full_name text, username text) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid();
 nm text:=btrim(coalesce(full_name,''));
 un text:=lower(btrim(coalesce(username,'')));
begin
 if uid is null then raise exception 'SESSION_REQUIRED'; end if;
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'NOT_AUTHORIZED'; end if;
 if length(nm) not between 2 and 100 then raise exception 'INVALID_NAME'; end if;
 if un !~ '^[a-z0-9_.]{3,20}$' then raise exception 'INVALID_USERNAME'; end if;
 perform 1 from public.profiles where user_id=uid for update;
 if not found then raise exception 'PROFILE_REQUIRED'; end if;
 if exists(select 1 from public.profiles x where lower(x.username)=un and x.user_id<>uid) then raise exception 'USERNAME_TAKEN'; end if;
 update public.profiles set full_name=nm,username=un,updated_at=now() where user_id=uid;
 return jsonb_build_object('fullName',nm,'username',un);
end $$;
revoke execute on function public.update_profile_details(text,text) from public,anon;
grant execute on function public.update_profile_details(text,text) to authenticated;
