# Bocetos navegables de Onza

> **Son bocetos visuales para aprobar, no funciones implementadas.** Nada de esta carpeta toca la aplicación real, Supabase, dominios ni Vercel. Decisiones de producto: sección 0 de [`Onza-Product-Blueprint-v3.md`](../../Onza-Product-Blueprint-v3.md).

## Cómo abrirlo

No necesita instalación ni servidor. Abrí `index.html` en el navegador (doble clic), o desde la raíz del repo:

```bash
python3 -m http.server 8080 --directory design/bocetos
```

y entrá a `http://localhost:8080`. La barra oscura superior es del boceto, no del producto: **Ir a…** salta a cualquier pantalla, **Avanzar pedido** simula la acción de la barra sobre tu último pedido y **Reiniciar** vuelve al estado inicial.

Parámetros opcionales de la URL, útiles para revisar: `?sesion=cliente|empleado|admin`, `?tema=claro|oscuro`, `?carrito=1`. Ejemplo: `index.html?sesion=cliente&tema=oscuro#/explorar`.

## Limitaciones

- **Datos ficticios en memoria.** Recargar la página reinicia todo.
- **Sin autenticación, pagos ni solicitudes de red.** Cualquier correo y contraseña "ingresan"; el correo y el código de confirmación son simulados; Google es un botón de demostración. No se llama a Supabase ni a ningún servicio.
- El QR del ticket es un dibujo ficticio, no un código válido.
- Condiciones y privacidad son textos de ejemplo marcados como borrador.
- Fuera de los bocetos: los borradores recuperables tras sesión vencida (R6), la reautenticación real y el estado "Eliminación en curso" de R3. Las reglas R1–R6 están especificadas en el blueprint; aquí solo se representa R2 (sesión en el acceso equivocado) y la separación cliente/equipo.

## Recorridos

| Recorrido | Pantallas |
| --- | --- |
| Cliente | Acceso → Crear cuenta → Confirmar correo → Completar perfil → Explorar → Menú → Carrito → Checkout → Recibido → Preparando → Listo (ticket) → Entregado |
| Cuenta | Apariencia (Sistema / Claro / Oscuro), preferencias, condiciones y privacidad (borrador), eliminar cuenta, cerrar sesión |
| Otros accesos | Recuperar contraseña; QR de un local (conserva destino); sesión activa en el acceso equivocado |
| Equipo | `/equipo/acceso` → Barra (Nuevos / Preparando / Listos, validar retiro). Correo con "marta" o "admin" entra como administrador; cualquier otro como empleado |
| Administración | Resumen, Pedidos, Menú, Local, Equipo |

Un pedido del cliente aparece en la barra y viceversa: aceptá desde **Barra** (o usá **Avanzar pedido**) y volvé a **Pedido**. Para validar un retiro en la barra, usá el código del ticket (`K7M2-X9PQ-4RTA`); el pedido sembrado #0424 usa `H4NP-7WQ2-MX8D`. El número público (#0427) no sirve como código.

## Contenido

- `index.html`, `assets/app.js` (pantallas y datos), `assets/app.css` (componentes compartidos).
- `assets/tokens.css` y `assets/fonts.css`: copias de `design/tokens.css` y `design/fonts.css` (ruta de la fuente ajustada). Si cambian los tokens, volver a copiarlos.
- `assets/brand`, `assets/fonts` (Inter, licencia OFL), `assets/products`, `assets/venues`: copias de los recursos existentes del repo.
- `capturas/`: capturas representativas (390 px y 1440 px, claro y oscuro).

Sin dependencias, sin bibliotecas externas, sin red.
