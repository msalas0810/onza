-- Drink images: one optional image per product. Non-destructive: adds one nullable column and one function.
-- Files live in the existing public venue-images bucket (same 2 MB / jpg-png-webp limits and the same Storage policies:
-- only admins of the venue that owns the first path segment can write). No Storage migration is needed.
alter table public.products
  add column if not exists image_url text check (image_url is null or length(image_url) <= 500);

-- Only admins of the product's venue (or Onza global) can change it. The URL must point at a product-* file inside that
-- venue's own folder of the public venue-images bucket, never at an arbitrary external URL. null clears the image.
-- The product version is NOT bumped: an image change must not invalidate carts that hold the product.
create function public.update_product_image(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 pid uuid;
 p public.products;
 image_pattern text;
begin
 if auth.uid() is null then raise exception 'NOT_AUTHORIZED'; end if;
 if input is null or jsonb_typeof(input)<>'object' or input->>'productId' is null or not (input ? 'imageUrl') then raise exception 'INVALID_PRODUCT_IMAGE'; end if;
 begin pid:=(input->>'productId')::uuid; exception when others then raise exception 'INVALID_PRODUCT_IMAGE'; end;
 select * into p from public.products where id=pid;
 -- Same answer for "does not exist" and "not yours": do not reveal products of other venues.
 if not found or not private.is_staff(p.venue_id,true) then raise exception 'NOT_AUTHORIZED'; end if;
 if not private.limit_action('product_image',60) then raise exception 'RATE_LIMITED'; end if;
 if jsonb_typeof(input->'imageUrl')<>'null' then
  image_pattern:='^https?://[A-Za-z0-9.:-]+/storage/v1/object/public/venue-images/'||p.venue_id::text||'/product-[A-Za-z0-9._-]{1,100}\.(jpg|jpeg|png|webp)$';
  if jsonb_typeof(input->'imageUrl')<>'string' or input->>'imageUrl' !~ image_pattern then raise exception 'INVALID_PRODUCT_IMAGE'; end if;
 end if;
 update public.products set image_url=input->>'imageUrl' where id=pid returning * into p;
 return to_jsonb(p);
end $$;
revoke all on function public.update_product_image(jsonb) from public, anon;
grant execute on function public.update_product_image(jsonb) to authenticated;
