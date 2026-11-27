# Noche en Onza: Picnic, barra, administración, actividad y amigos

Rama `feat/noche-picnic-social` · 2026-11-27 · entrada del diario D-2026-11-27-01. Nota corta: qué se miró, qué se decidió y qué falta.

## 1 · Base de la que se partió

- `main` (`e415735`) no tenía Picnic. `feat/entrega-mesa-admin` = `d8a596d` (lugares nombrados, migración 025).
- El **mapa con pin** (migración 026, plano de Picnic, edición en admin) estaba **sin commit** en `feat/entrega-mapa` sobre `d8a596d`, con 50/50 en su verificación. Se comprobó (tipos, lint, 245 pruebas) y se guardó tal cual en `920be7c`, separado del trabajo nuevo. Respaldo previo del árbol en `~/Documents/Onza/Onza-respaldo-ramas/2026-11-27-wip-entrega-mapa/`.
- Había un `next dev` (:3100) y un shim (:54321) de la sesión anterior. No se tocaron: esta sesión verificó con su propio shim (:54322) y un build servido en :3200.

## 2 · Referencias (lo observado, con fuente)

La búsqueda web general quedó bloqueada en esta sesión, así que se leyeron páginas concretas. Lo marcado como *hipótesis* no sale de una fuente.

| Patrón | Qué resuelve | Fuente (leída el 2026-11-27) | Qué se adoptó |
| --- | --- | --- | --- |
| Actividad agregada y anónima, visible «solo si hay suficientes datos» | Mostrar movimiento sin exponer a nadie | [Google, horarios concurridos](https://support.google.com/business/answer/6263531): «aggregated and anonymized data», «appears only if Google has sufficient visit data» | Nivel por local (nunca conteos) y umbral mínimo de 5 personas (ver la fila siguiente). Google no publica el suyo |
| Suprimir conteos chicos (k-anonimato) | Que un local con 2 o 3 personas no las delate | [SharedStreets](https://medium.com/sharedstreets/aggregating-trip-data-using-k-anonymization-727d5a6413f3) usa 5 como mínimo; [un estudio de series de ubicación agregadas](https://arxiv.org/pdf/1902.07456) encontró que suprimir bajo 10 no protege bien contra inferencia de pertenencia; [Transport for NSW](https://arxiv.org/pdf/1704.08547): un valor suprimido se recalcula si se publica el total | El mínimo subió de 3 a **5** (2026-11-27, D-2026-11-27-04). No se publica ningún total, así que no hay de dónde restar. *Hipótesis:* con poco volumen, 5 más niveles gruesos alcanza para el demo; con volumen real conviene revisar subir a 10 |
| Compartir ubicación apagado por defecto, por persona y cortable | Consentimiento explícito y reversible | [Google, compartir ubicación](https://support.google.com/accounts/answer/9363497): «off by default», dejar de compartir por persona | Compartir el local es un interruptor apagado por defecto, con «Me fui» y corte inmediato |
| Duración elegida al compartir y «dejar de compartir» por persona | Que no quede encendido para siempre | [Apple, compartir tu ubicación](https://support.apple.com/guide/iphone/share-your-location-iph01954dc44/ios): elegir cuánto tiempo, «Stop Sharing My Location» | Check-in de 1, 2 o 3 h con hora de vencimiento a la vista |
| Visible solo entre amistades bidireccionales; desaparece si no se usa | Nadie ve a quien no aceptó | [Snap, privacidad por producto](https://values.snap.com/privacy/privacy-by-product): «until you are bidirectional friends», invisible tras 24 h sin abrir la app | Solo amistades **aceptadas** ven el local compartido; todo vence |
| Temporizadores y alertas por ticket; modo expedidor | El equipo ve qué se atrasa sin buscarlo | [Square KDS](https://squareup.com/us/en/point-of-sale/restaurants/kitchen-display-system): «timers, and alerts», «Expeditor Mode» | La cola ya tenía tiempos; «Ahora» del admin resume nuevos, preparando, listos y activos frente a la capacidad, con el atajo al lado |
| Un QR para pedir otra ronda sin llamar a nadie | Quitar pasos al pedir en la mesa | [sunday](https://sundayapp.com/): «Guests scan, order, reorder and pay - one QR code» | El QR de la mesa precarga el pin y lo conserva a través del acceso y el checkout (ya estaba; se verificó) |
| Costa Rica: Rappi CR es entrega a domicilio | Contexto local | [Rappi CR](https://www.rappi.co.cr/): portada solo de «Delivery … a domicilio» | *Hipótesis:* el pedido en el local (barra o mesa) no está cubierto por las apps de delivery locales. No se verificó con usuarios |

No se pudieron leer: el artículo de Uber Eats sobre ajustar el pin y dos artículos de ayuda de Toast (pausa de pedidos en línea y resumen de ventas); los tres dieron 404.

## 3 · Crítica (Hallmark, auditoría de pantalla de app) y qué se corrigió

Capturas «antes» en `docs/evidence/noche/antes/`, «después» en `docs/evidence/noche/despues/`.

1. **La barra no veía el pin sin abrir un modal** → la tarjeta muestra un recorte del mismo plano, centrado en el punto del cliente (`order-map-button.tsx`). La posición se calcula con `background-position` en %: el punto (x, y) de la imagen cae en el mismo % de la caja, así que es exacto sin JavaScript.
2. **El checkout repetía el lugar** (resumen arriba con «Editar», texto del mapa y segmented control) → el lugar se confirma solo junto a «Pedir».
3. **El admin estaba ordenado por tipo de dato** → navegación por momento: *Durante la noche* (Ahora, Pedidos), *Antes de abrir* (Menú y precios, Capacidad, Entrega y QR, Perfil y horario, Equipo) y *Al cerrar* (Resumen y CSV). «Ahora» es la entrada, con pausa, agotados y el pulso del local en la misma pantalla.
4. **Sistema:** etiqueta `.eyebrow` en mayúsculas espaciadas → sentence case; 30 literales de color → tokens `--onza-fixed-*`; deshabilitados solo con opacidad → tinta, fondo y cursor; pestañas del admin en teléfono bajo la cabecera fija.
5. **Excepciones con motivo:** el QR sigue en blanco puro (lo exige el lector). Los campos de código (`.code-input`) siguen en mayúsculas espaciadas porque son entradas de un código, no etiquetas. `.hdr` y `.shdr` nunca conviven (cliente y equipo tienen marcos distintos). El sello de Hallmark no aplica: la app no la construyó Hallmark.

## 4 · Actividad y amigos (migración 027)

- **Señal:** check-in voluntario «Estoy acá» (60/120/180 min), solo cuentas de cliente con perfil, uno activo por persona. **Pedir no crea check-in**, y la migración no lee pedidos.
- **Mapa:** `venue_activity()` devuelve solo locales con coordenadas y **5 o más** personas activas, como nivel (1: 5–9, 2: 10–24, 3: 25+), nunca el número. El resto no aparece.
- **Amigos:** solicitud por @usuario o por enlace (`/amigos?agregar=usuario`); aceptar, rechazar o quitar. El local compartido solo lo ven amistades aceptadas; vence con el check-in; «dejar de compartir» y «Me fui» son inmediatos.
- **Fuera de lo social:** el pin de entrega, el GPS, el historial, los contactos y los pedidos. Las tablas no tienen permisos directos y todo pasa por funciones que validan en servidor.
- **Simulado:** `/actividad?ejemplo=1`, con lugares ficticios sobre un plano esquemático, rotulado «Simulado» y sin mezclarse con datos reales (`src/features/social/activity-fixtures.ts`).

### Qué falta para datos reales

1. **Coordenadas verificadas.** Hoy ningún local real las tiene (el seed las deja en `null` sin fuente verificada), así que el mapa real muestra «Todavía no hay actividad visible». Se cargan con fuente y fecha en `fixtures/real-venues.json` (`coordinates.verified_on` y `source`) o desde Administración → Perfil.
2. **Mapa base de calles.** Hoy es un plano esquemático sin calles. Para un mapa real hace falta elegir un proveedor de teselas (por ejemplo MapLibre con un estilo propio) con su clave en una variable pública, y sumar ese origen a `img-src` y `connect-src` en `next.config.ts`. No se instaló nada.
3. ~~Migración 027 en un proyecto aislado y en el remoto~~: hecho el 2026-11-27 (D-2026-11-27-05).
4. Revisar con volumen real si el mínimo de 5 sube a 10 (la investigación citada sugiere que 5 protege poco ante inferencia de pertenencia).
