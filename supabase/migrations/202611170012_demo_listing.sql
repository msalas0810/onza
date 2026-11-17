-- Qué locales se listan en Explorar. ADITIVA (R4): una columna con valor por defecto; el frontend desplegado la ignora
-- (select *). Ocultar un local no borra pedidos, menús ni membresías y se revierte volviendo a poner true.
alter table public.venues add column if not exists demo_listed boolean not null default true;
