-- Plan de pulido · E4: punto focal de la portada, compartido por la tarjeta de Explorar (16:10) y la cabecera móvil del
-- local (3:2). ADITIVA (R4): dos columnas con valor por defecto (centro) y una función nueva; update_venue_branding intacta.
alter table public.venues
  add column if not exists cover_focus_x smallint not null default 50 check (cover_focus_x between 0 and 100),
  add column if not exists cover_focus_y smallint not null default 50 check (cover_focus_y between 0 and 100);

create or replace function public.update_venue_cover_focus(venue uuid,x integer,y integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.venues;
begin
 if auth.uid() is null or not private.is_staff(venue,true) then raise exception 'NOT_AUTHORIZED'; end if;
 if x is null or y is null or x not between 0 and 100 or y not between 0 and 100 then raise exception 'INVALID_BRANDING'; end if;
 update public.venues set cover_focus_x=x,cover_focus_y=y where id=venue returning * into v;
 if not found then raise exception 'NOT_AUTHORIZED'; end if;
 return jsonb_build_object('coverFocusX',v.cover_focus_x,'coverFocusY',v.cover_focus_y);
end $$;
revoke execute on function public.update_venue_cover_focus(uuid,integer,integer) from public,anon;
grant execute on function public.update_venue_cover_focus(uuid,integer,integer) to authenticated;
