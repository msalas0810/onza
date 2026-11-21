-- Auditoría de seguridad (2026-11-21): cierre explícito de permisos de escritura en las tablas públicas. ADITIVA.
-- En un proyecto Supabase, cada tabla nueva de `public` recibe por defecto TODOS los privilegios para anon y authenticated
-- (ALTER DEFAULT PRIVILEGES del rol postgres). Las tablas de 001 solo concedían SELECT "además", sin quitar lo heredado:
-- hoy la escritura la frena únicamente RLS (que no cubre TRUNCATE ni REFERENCES/TRIGGER). Esta migración deja los permisos
-- exactamente como se pretendía en 001: lectura, y nada más. Las escrituras siguen pasando por funciones SECURITY DEFINER.
-- Idempotente y sin efecto sobre la app: ninguna ruta escribe estas tablas directo con el JWT del usuario.
revoke all on public.venues, public.categories, public.products, public.memberships, public.orders, public.order_items, public.order_events
  from anon, authenticated;
grant select on public.venues, public.categories, public.products to anon, authenticated;
grant select on public.memberships, public.orders, public.order_items to authenticated;
-- order_events: sin acceso directo (021); se lee a través de order_view/order_list.
