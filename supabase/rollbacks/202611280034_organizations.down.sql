-- Reversión de 202611280034_organizations.sql. Restaura la política original de `venues` (lectura pública) y quita las columnas.
drop trigger if exists orders_block_unavailable on public.orders;
drop function if exists private.block_orders_when_unavailable();
drop policy if exists venues_read on public.venues;
create policy venues_read on public.venues for select using(true);
drop function if exists private.venue_visible(uuid,uuid,text,timestamptz);
drop policy if exists organizations_read on public.organizations;
drop policy if exists org_memberships_read on public.org_memberships;
drop table if exists public.org_invitations;
drop table if exists public.org_memberships;
drop function if exists private.org_membership_check();
drop index if exists public.venues_organization;
alter table public.venues
 drop column if exists organization_id,
 drop column if exists publication_status,
 drop column if exists suspended_at,
 drop column if exists suspended_reason,
 drop column if exists suspended_by,
 drop column if exists service_modes,
 drop column if exists brand_color;
drop function if exists private.org_venue_access(uuid,text[]);
drop function if exists private.org_has_role(uuid,text[]);
drop function if exists private.org_is_member(uuid);
drop function if exists private.org_role(uuid);
drop function if exists private.org_active(uuid);
drop table if exists private.organization_secrets;
drop table if exists public.organizations;
