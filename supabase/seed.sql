-- Reproducible fictional data. Enables ONLY the mock ledger in this dedicated demo DB.
update private.configuration set demo_enabled=true where id;
insert into public.venues(id,slug,name,zone,open_state,pickup_label) values ('20000000-0000-4000-8000-000000000001','sala-norte','Sala Norte','San José','open','Barra principal') on conflict(id) do nothing;
insert into public.venues(id,slug,name,zone,open_state,pickup_label) values ('20000000-0000-4000-8000-000000000002','patio-central','Patio Central','San José','open','Barra principal') on conflict(id) do nothing;
insert into public.venues(id,slug,name,zone,open_state,pickup_label) values ('20000000-0000-4000-8000-000000000003','club-cero','Club Cero','San José','closed','Barra principal') on conflict(id) do nothing;
insert into public.categories(id,venue_id,label,position) values ('ad46cb30-426b-52bb-8358-ac044919d89a','20000000-0000-4000-8000-000000000001','Cocteles',1) on conflict(id) do nothing;
insert into public.products(id,venue_id,category_id,name,description,price_minor,available) values ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','ad46cb30-426b-52bb-8358-ac044919d89a','Paloma','Tequila, toronja y soda.',450000,true) on conflict(id) do nothing;
insert into public.categories(id,venue_id,label,position) values ('c66615b8-674b-5d7a-bf13-c8d75ffeb0ca','20000000-0000-4000-8000-000000000001','Clásicos',2) on conflict(id) do nothing;
insert into public.products(id,venue_id,category_id,name,description,price_minor,available) values ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','c66615b8-674b-5d7a-bf13-c8d75ffeb0ca','Negroni','Gin, vermut rosso y bitter.',550000,true) on conflict(id) do nothing;
insert into public.products(id,venue_id,category_id,name,description,price_minor,available) values ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','c66615b8-674b-5d7a-bf13-c8d75ffeb0ca','Gin tonic','Gin y agua tónica.',500000,true) on conflict(id) do nothing;
insert into public.products(id,venue_id,category_id,name,description,price_minor,available) values ('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','ad46cb30-426b-52bb-8358-ac044919d89a','Margarita','Tequila, cítricos y licor de naranja.',500000,true) on conflict(id) do nothing;
insert into public.categories(id,venue_id,label,position) values ('9e179d89-8e7c-54d9-8c72-80aae3b973e3','20000000-0000-4000-8000-000000000001','Cervezas',3) on conflict(id) do nothing;
insert into public.products(id,venue_id,category_id,name,description,price_minor,available) values ('30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001','9e179d89-8e7c-54d9-8c72-80aae3b973e3','Cerveza','Botella individual.',250000,true) on conflict(id) do nothing;
insert into public.categories(id,venue_id,label,position) values ('dc6dcc69-40ea-525d-b621-25c181a33478','20000000-0000-4000-8000-000000000001','Sin alcohol',4) on conflict(id) do nothing;
insert into public.products(id,venue_id,category_id,name,description,price_minor,available) values ('30000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000001','dc6dcc69-40ea-525d-b621-25c181a33478','Soda cítrica','Bebida sin alcohol.',200000,true) on conflict(id) do nothing;
insert into public.categories(id,venue_id,label,position) values ('57a7a4df-156f-5704-81a4-2814b80ff10f','20000000-0000-4000-8000-000000000002','Cocteles',5) on conflict(id) do nothing;
insert into public.products(id,venue_id,category_id,name,description,price_minor,available) values ('30000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000002','57a7a4df-156f-5704-81a4-2814b80ff10f','Paloma','Tequila, toronja y soda.',450000,true) on conflict(id) do nothing;
insert into public.categories(id,venue_id,label,position) values ('cb3780dc-2c16-54f9-9d3e-fb3b6fb5beab','20000000-0000-4000-8000-000000000002','Clásicos',6) on conflict(id) do nothing;
insert into public.products(id,venue_id,category_id,name,description,price_minor,available) values ('30000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000002','cb3780dc-2c16-54f9-9d3e-fb3b6fb5beab','Negroni','Gin, vermut rosso y bitter.',550000,false) on conflict(id) do nothing;
insert into public.products(id,venue_id,category_id,name,description,price_minor,available) values ('30000000-0000-4000-8000-000000000009','20000000-0000-4000-8000-000000000002','cb3780dc-2c16-54f9-9d3e-fb3b6fb5beab','Gin tonic','Gin y agua tónica.',500000,true) on conflict(id) do nothing;
insert into public.products(id,venue_id,category_id,name,description,price_minor,available) values ('30000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000002','57a7a4df-156f-5704-81a4-2814b80ff10f','Margarita','Tequila, cítricos y licor de naranja.',500000,true) on conflict(id) do nothing;
insert into public.categories(id,venue_id,label,position) values ('a589fcba-2e8b-5764-9281-a17da14229e5','20000000-0000-4000-8000-000000000002','Cervezas',7) on conflict(id) do nothing;
insert into public.products(id,venue_id,category_id,name,description,price_minor,available) values ('30000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000002','a589fcba-2e8b-5764-9281-a17da14229e5','Cerveza','Botella individual.',250000,true) on conflict(id) do nothing;
insert into public.categories(id,venue_id,label,position) values ('e1658121-b911-56db-9e26-10ec5a248474','20000000-0000-4000-8000-000000000002','Sin alcohol',8) on conflict(id) do nothing;
insert into public.products(id,venue_id,category_id,name,description,price_minor,available) values ('30000000-0000-4000-8000-000000000012','20000000-0000-4000-8000-000000000002','e1658121-b911-56db-9e26-10ec5a248474','Soda cítrica','Bebida sin alcohol.',200000,true) on conflict(id) do nothing;

-- Picnic (demo ficticio): un bar que entrega en la mesa o en la zona del cliente, o lo deja para retirar en la barra.
-- Menú y lugares de ejemplo para recorrer el flujo; no son datos reales del local. Los edita su administración en Entrega.
insert into public.venues(id,slug,name,zone,open_state,pickup_label,delivery_mode,spot_noun) values ('20000000-0000-4000-8000-000000000004','picnic','Picnic','Terraza y jardín','open','Barra principal','both','Mesa') on conflict(id) do nothing;
insert into public.categories(id,venue_id,label,position) values
 ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004','Cocteles',9),
 ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004','Cervezas',10),
 ('40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000004','Sin alcohol',11) on conflict(id) do nothing;
insert into public.products(id,venue_id,category_id,name,description,price_minor,available) values
 ('30000000-0000-4000-8000-000000000013','20000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000001','Spritz','Aperitivo, espumante y soda.',500000,true),
 ('30000000-0000-4000-8000-000000000014','20000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000001','Mojito','Ron, menta, limón y soda.',500000,true),
 ('30000000-0000-4000-8000-000000000015','20000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000001','Gin tonic','Gin y agua tónica.',500000,true),
 ('30000000-0000-4000-8000-000000000016','20000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000002','Cerveza','Botella individual.',250000,true),
 ('30000000-0000-4000-8000-000000000017','20000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000003','Limonada','Limón, hielo y menta.',200000,true) on conflict(id) do nothing;
insert into public.delivery_spots(id,venue_id,label,area,position) select ('50000000-0000-4000-8000-0000000000'||lpad(n::text,2,'0'))::uuid,'20000000-0000-4000-8000-000000000004','Mesa '||n,case when n<=6 then 'Terraza' else 'Jardín' end,n from generate_series(1,10) n on conflict do nothing;
insert into public.delivery_spots(id,venue_id,label,area,position) values
 ('50000000-0000-4000-8000-000000000051','20000000-0000-4000-8000-000000000004','VIP 1','Zona VIP',51),
 ('50000000-0000-4000-8000-000000000052','20000000-0000-4000-8000-000000000004','VIP 2','Zona VIP',52) on conflict do nothing;
-- Mapa de ejemplo de Picnic (plano ilustrativo propio del repo, public/demo-venues/picnic-plano.svg). Mesas = círculos, la pista = zona.
insert into public.venue_maps(id,venue_id,version,image_url,width,height,service_area) values ('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',1,'/demo-venues/picnic-plano.svg',1600,1000,'[{"points": [[0.0375, 0.06], [0.4625, 0.06], [0.4625, 0.64], [0.0375, 0.64]]}, {"points": [[0.4875, 0.06], [0.8375, 0.06], [0.8375, 0.94], [0.4875, 0.94]]}, {"points": [[0.8625, 0.3], [0.9625, 0.3], [0.9625, 0.94], [0.8625, 0.94]]}]'::jsonb) on conflict do nothing;
insert into public.delivery_spots(id,venue_id,label,area,position,shape) values ('50000000-0000-4000-8000-000000000053','20000000-0000-4000-8000-000000000004','Pista de baile','',53,'{"kind": "polygon", "points": [[0.5, 0.6], [0.825, 0.6], [0.825, 0.92], [0.5, 0.92]]}'::jsonb) on conflict do nothing;
update public.delivery_spots set shape='{"kind": "circle", "x": 0.1187, "y": 0.21, "r": 0.026}'::jsonb where id='50000000-0000-4000-8000-000000000001' and shape is null;
update public.delivery_spots set shape='{"kind": "circle", "x": 0.25, "y": 0.21, "r": 0.026}'::jsonb where id='50000000-0000-4000-8000-000000000002' and shape is null;
update public.delivery_spots set shape='{"kind": "circle", "x": 0.3812, "y": 0.21, "r": 0.026}'::jsonb where id='50000000-0000-4000-8000-000000000003' and shape is null;
update public.delivery_spots set shape='{"kind": "circle", "x": 0.1187, "y": 0.45, "r": 0.026}'::jsonb where id='50000000-0000-4000-8000-000000000004' and shape is null;
update public.delivery_spots set shape='{"kind": "circle", "x": 0.25, "y": 0.45, "r": 0.026}'::jsonb where id='50000000-0000-4000-8000-000000000005' and shape is null;
update public.delivery_spots set shape='{"kind": "circle", "x": 0.3812, "y": 0.45, "r": 0.026}'::jsonb where id='50000000-0000-4000-8000-000000000006' and shape is null;
update public.delivery_spots set shape='{"kind": "circle", "x": 0.5875, "y": 0.2, "r": 0.026}'::jsonb where id='50000000-0000-4000-8000-000000000007' and shape is null;
update public.delivery_spots set shape='{"kind": "circle", "x": 0.7375, "y": 0.2, "r": 0.026}'::jsonb where id='50000000-0000-4000-8000-000000000008' and shape is null;
update public.delivery_spots set shape='{"kind": "circle", "x": 0.5875, "y": 0.44, "r": 0.026}'::jsonb where id='50000000-0000-4000-8000-000000000009' and shape is null;
update public.delivery_spots set shape='{"kind": "circle", "x": 0.7375, "y": 0.44, "r": 0.026}'::jsonb where id='50000000-0000-4000-8000-000000000010' and shape is null;
update public.delivery_spots set shape='{"kind": "circle", "x": 0.9125, "y": 0.48, "r": 0.026}'::jsonb where id='50000000-0000-4000-8000-000000000051' and shape is null;
update public.delivery_spots set shape='{"kind": "circle", "x": 0.9125, "y": 0.74, "r": 0.026}'::jsonb where id='50000000-0000-4000-8000-000000000052' and shape is null;
