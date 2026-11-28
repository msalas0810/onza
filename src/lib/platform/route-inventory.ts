/**
 * Inventario de rutas: toda ruta de la aplicación debe estar clasificada como pública, de empresa o de plataforma.
 * Una ruta sin clasificar se DENIEGA (404): el proxy la bloquea y una prueba falla si se agrega una ruta sin clasificar.
 *
 *  - public:   cara al consumidor, acceso, catálogo, estáticos y llamadas por token (la sesión de cada pantalla se exige en la ruta).
 *  - company:  personal de un local o de una empresa; la ruta exige una membresía.
 *  - platform: solo el superadministrador.
 *
 * `gate` documenta la comprobación REAL de cada ruta (no solo su etiqueta):
 *  - operator:    guardPlatformRequest / requirePlatformPage (un solo correo, verificado, sesión viva, segundo factor en acciones sensibles).
 *  - legacy-onza: el acceso anterior por membresía con rol `onza` (/onza y sus API). NO es el control de un solo correo: deuda registrada.
 *  - member:      membresía de local o de empresa.
 *  - session:     cuenta de cliente con sesión.
 *  - token:       invitación o enlace con token secreto.
 *  - none:        sin control (catálogo, estáticos, acceso).
 */
export type RouteClass = "public" | "company" | "platform";
export type RouteGate = "operator" | "legacy-onza" | "member" | "session" | "token" | "none";
export type RouteRule = { pattern: RegExp; cls: RouteClass; gate: RouteGate; note?: string };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** Páginas estáticas del panel de plataforma (conviven con /admin/[venueId], que es un uuid). */
export const PLATFORM_PAGES = ["seguridad", "empresas", "establecimientos", "usuarios", "auditoria", "nueva-empresa", "nuevo-establecimiento"] as const;

export const ROUTE_RULES: readonly RouteRule[] = [
  // --- Plataforma (superadministrador) ---
  { pattern: /^\/admin$/, cls: "platform", gate: "operator" },
  { pattern: new RegExp(`^/admin/(${PLATFORM_PAGES.join("|")})(/[A-Za-z0-9-]+)*$`), cls: "platform", gate: "operator" },
  { pattern: /^\/api\/platform-admin\/(data|commands)$/, cls: "platform", gate: "operator" },
  { pattern: /^\/onza(\/[a-z]+)?$/, cls: "platform", gate: "legacy-onza", note: "Acceso anterior por rol `onza`; pendiente de unificar con el operador único." },
  { pattern: /^\/api\/(onza|platform)$/, cls: "platform", gate: "legacy-onza", note: "Idem." },

  // --- Públicas por diseño (acceso del operador y de empresas, invitaciones por token) ---
  { pattern: /^\/admin\/acceso$/, cls: "public", gate: "none", note: "Inicio de sesión del operador: no revela nada del panel." },
  { pattern: /^\/panel\/acceso$/, cls: "public", gate: "none" },
  { pattern: /^\/panel\/invitacion\/[A-Za-z0-9_-]{20,100}$/, cls: "public", gate: "token" },
  { pattern: /^\/api\/panel\/invitations\/(lookup|accept)$/, cls: "public", gate: "token" },

  // --- Empresa ---
  { pattern: /^\/panel(\/(clientes|personal|menu|horarios))?$/, cls: "company", gate: "member" },
  { pattern: /^\/api\/panel\/(data|commands|invitations\/accept-self)$/, cls: "company", gate: "member" },
  { pattern: new RegExp(`^/(admin|staff)/${UUID}(/qr)?$`), cls: "company", gate: "member" },
  { pattern: /^\/equipo(\/(locales|clave))$/, cls: "company", gate: "member" },
  { pattern: /^\/api\/(team|team\/password|summary|export|waitlist|delivery|loyalty)$/, cls: "company", gate: "member" },

  // --- Públicas: consumidor, acceso, catálogo y estáticos ---
  { pattern: /^\/$/, cls: "public", gate: "none" },
  { pattern: /^\/equipo\/acceso$/, cls: "public", gate: "none" },
  { pattern: /^\/(acceso|confirmar|recuperar|restablecer|login|onboarding|sesion-activa|policies|design-system)$/, cls: "public", gate: "none" },
  { pattern: /^\/v\/[A-Za-z0-9-]+(\/p\/[0-9a-f-]{36})?$/, cls: "public", gate: "none" },
  { pattern: /^\/(cart|checkout|cuenta|settings|amigos|actividad|avatar|bares|historias|juego|ranking|tienda)$/, cls: "public", gate: "session" },
  { pattern: new RegExp(`^/orders(/${UUID})?$`), cls: "public", gate: "session" },
  { pattern: /^\/auth\/callback$/, cls: "public", gate: "none" },
  { pattern: /^\/api\/(catalog|commands|orders|social|game|game\/coins|health)$/, cls: "public", gate: "session" },
  { pattern: /^\/api\/demo-session$/, cls: "public", gate: "none", note: "Solo con DEMO_MODE=true." },
  { pattern: /^\/(_next|access|brand|fonts|demo-venues|demo-products)\//, cls: "public", gate: "none", note: "Archivos estáticos." },
  { pattern: /^\/(favicon\.ico|manifest\.webmanifest)$/, cls: "public", gate: "none" },
  { pattern: /^\/__nextjs/, cls: "public", gate: "none", note: "Herramientas internas de Next en desarrollo." },
];

/** Clasificación de una ruta concreta; `null` si no está en el inventario (se deniega). */
export function classifyRoute(path: string): RouteRule | null {
  const clean = path.split("?")[0].replace(/\/+$/, "") || "/";
  return ROUTE_RULES.find((rule) => rule.pattern.test(clean)) ?? null;
}

/** Denegar por defecto: solo pasa lo que está en el inventario. */
export const isRouteInventoried = (path: string) => classifyRoute(path) !== null;
