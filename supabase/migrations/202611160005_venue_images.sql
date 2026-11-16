-- Venue branding: cover photo and logo shown on the venue cards. Non-destructive: only adds nullable columns and one function.
-- Storage (bucket and object policies) lives in 202611160006_venue_images_storage.sql because the SQL test harness has no storage schema.
alter table public.venues
  add column if not exists cover_url text check (cover_url is null or length(cover_url) <= 500),
  add column if not exists logo_url text check (logo_url is null or length(logo_url) <= 500);

-- Only admins of that venue (or Onza global) can change branding. Image URLs must point at this venue's own folder in the
-- public venue-images bucket: no arbitrary external URLs. Keys that are absent are left unchanged; null clears an image.
create function public.update_venue_branding(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 image_pattern:='^https?://[A-Za-z0-9.:-]+/storage/v1/object/public/venue-images/'||vid::text||'/[A-Za-z0-9._-]{1,100}\.(jpg|jpeg|png|webp)$';
 if input ? 'coverUrl' and jsonb_typeof(input->'coverUrl')<>'null' and (jsonb_typeof(input->'coverUrl')<>'string' or input->>'coverUrl' !~ image_pattern) then raise exception 'INVALID_BRANDING'; end if;
 if input ? 'logoUrl' and jsonb_typeof(input->'logoUrl')<>'null' and (jsonb_typeof(input->'logoUrl')<>'string' or input->>'logoUrl' !~ image_pattern) then raise exception 'INVALID_BRANDING'; end if;
 update public.venues set
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
