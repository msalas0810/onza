-- Venue locations only. Customer positions are never stored or sent to the server.
alter table public.venues
 add column if not exists latitude double precision,
 add column if not exists longitude double precision;
alter table public.venues add constraint venue_coordinates_valid check (
 (latitude is null and longitude is null) or
 (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180)
);
create or replace function public.update_venue_branding(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 vid uuid;
 v public.venues;
 image_pattern text;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHORIZED'; end if;
 if input is null or jsonb_typeof(input)<>'object' or input->>'venueId' is null then raise exception 'INVALID_BRANDING'; end if;
 begin vid:=(input->>'venueId')::uuid; exception when others then raise exception 'INVALID_BRANDING'; end;
 if not private.is_staff(vid,true) then raise exception 'NOT_AUTHORIZED'; end if;
 if not private.limit_action('venue_branding',30) then raise exception 'RATE_LIMITED'; end if;
 if input ? 'name' and (jsonb_typeof(input->'name')<>'string' or length(btrim(input->>'name')) not between 1 and 100) then raise exception 'INVALID_BRANDING'; end if;
 if input ? 'zone' and (jsonb_typeof(input->'zone')<>'string' or length(btrim(input->>'zone'))>100) then raise exception 'INVALID_BRANDING'; end if;
 if (input ? 'latitude') <> (input ? 'longitude') then raise exception 'INVALID_LOCATION'; end if;
 if input ? 'latitude' and not (
  (jsonb_typeof(input->'latitude')='null' and jsonb_typeof(input->'longitude')='null') or
  (jsonb_typeof(input->'latitude')='number' and jsonb_typeof(input->'longitude')='number' and
   (input->>'latitude')::double precision between -90 and 90 and (input->>'longitude')::double precision between -180 and 180)
 ) then raise exception 'INVALID_LOCATION'; end if;
 image_pattern:='^https?://[A-Za-z0-9.:-]+/storage/v1/object/public/venue-images/'||vid::text||'/[A-Za-z0-9._-]{1,100}\.(jpg|jpeg|png|webp)$';
 if input ? 'coverUrl' and jsonb_typeof(input->'coverUrl')<>'null' and (jsonb_typeof(input->'coverUrl')<>'string' or input->>'coverUrl' !~ image_pattern) then raise exception 'INVALID_BRANDING'; end if;
 if input ? 'logoUrl' and jsonb_typeof(input->'logoUrl')<>'null' and (jsonb_typeof(input->'logoUrl')<>'string' or input->>'logoUrl' !~ image_pattern) then raise exception 'INVALID_BRANDING'; end if;
 update public.venues set
  latitude=case when input ? 'latitude' then (input->>'latitude')::double precision else latitude end,
  longitude=case when input ? 'longitude' then (input->>'longitude')::double precision else longitude end,
  name=case when input ? 'name' then btrim(input->>'name') else name end,
  zone=case when input ? 'zone' then btrim(input->>'zone') else zone end,
  cover_url=case when input ? 'coverUrl' then input->>'coverUrl' else cover_url end,
  logo_url=case when input ? 'logoUrl' then input->>'logoUrl' else logo_url end
 where id=vid returning * into v;
 if not found then raise exception 'NOT_AUTHORIZED'; end if;
 return to_jsonb(v);
end $$;
revoke all on function public.update_venue_branding(jsonb) from public, anon;
grant execute on function public.update_venue_branding(jsonb) to authenticated;
