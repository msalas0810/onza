# Fuentes primarias y trazabilidad

Consultadas el 15 de noviembre de 2026. Se distinguen hechos de plataforma de propuestas de producto. Los números de espaciado, colores, estados, tiempos y arquitectura Onza son decisiones de diseño de este kit, no valores prescritos por Apple o BAC.

## Diseño

- S1 · Apple HIG, Layout: https://developer.apple.com/design/human-interface-guidelines/layout — adaptación y consistencia.
- S2 · Apple HIG, Typography: https://developer.apple.com/design/human-interface-guidelines/typography — legibilidad y jerarquía. Versión de texto: https://developer.apple.com/design/human-interface-guidelines/typography.md
- S3 · Apple HIG, Motion: https://developer.apple.com/design/human-interface-guidelines/motion — feedback y propósito. Versión de texto: https://developer.apple.com/design/human-interface-guidelines/motion.md
- S4 · Vercel Geist: https://vercel.com/geist/introduction y https://vercel.com/geist/colors — referencia pública de sistema y roles de color.
- S5 · Linear, How we redesigned the Linear UI: https://linear.app/now/how-we-redesigned-the-linear-ui — caso de estudio de simplificación/alineación; no librería oficial reutilizada.
- S8 · Radix Primitives: https://www.radix-ui.com/primitives/docs/overview/introduction y shadcn/ui https://ui.shadcn.com/docs — componentes accesibles/customizables; no garantía automática de accesibilidad de la app completa.
- S9 · Lucide License: https://lucide.dev/license — ISC; iconos derivados de Feather conservan aviso MIT.
- S10 · Lucide Animated: https://lucide-animated.com/ — proyecto separado, basado en Motion/Lucide, licencia MIT publicada.
- S22 · Inter: https://rsms.me/inter/ y https://github.com/rsms/inter/tree/v4.1 — fuente 4.1, SIL OFL. Licencia incluida con el WOFF2 descargado de la distribución oficial.

## Pedidos y avisos

- S6 · me&u, Notifications for Order Status: https://help.meandu.com/hc/en-us/articles/6539937439247-Notifications-for-Order-Status — patrones de avisos pickup/in-app/SMS.
- S7 · GoTab, SMS Opt-In: https://success.gotab.io/knowledge/sms-opt-in — separar avisos transaccionales y marketing.
- S11 · WebKit, Web Push for Web Apps on iOS and iPadOS: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ — Home Screen, permiso y gesto del usuario.
- S12 · Apple, Sending web push notifications: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
- S13 · MDN, Autoplay: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay — reproducción de audio sujeta a políticas y activación.
- S14 · W3C Vibration Implementation Report: https://w3c.github.io/vibration/reports/implementation.html y MDN https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate — disponibilidad y restricciones; WebKit no lo implementa en evidencia revisada.

## Backend y hosting

- S15 · Next.js, Server and Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components — islas interactivas y reducción de bundle.
- S16 · Supabase Anonymous Sign-ins: https://supabase.com/docs/guides/auth/auth-anonymous — UID propio, authenticated role, límites y protección contra abuso.
- S17 · Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security — permisos a nivel de fila.
- S18 · Supabase Postgres Changes: https://supabase.com/docs/guides/realtime/postgres-changes — suscripciones y no exposición de service_role.
- S19 · Supabase Pricing: https://supabase.com/pricing — cuotas Free, pausa por inactividad y ausencia de backups automáticos/SLA en ese plan.
- S20 · Supabase Realtime Pricing: https://supabase.com/docs/guides/realtime/pricing — conexiones y mensajes.
- S21 · Vercel Hobby: https://vercel.com/docs/plans/hobby y https://vercel.com/legal/terms — restricciones de uso personal/no comercial.

## BAC

Ver referencias B1-B4 y alcance en 03-bac-y-pagos.md. Fuentes públicas no equivalen a contrato personalizado ni a manual de certificación. La prohibición de 3.11 se verificó también visualmente en la página 8 del PDF público V5. No afirmar que BAC ha aprobado Onza, ni que el camino técnico necesariamente será Cardinal o FAC: lo define el banco para el producto contratado.
