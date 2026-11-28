/**
 * Access policy for the customer area and the team portal (pure, testable).
 * Source of truth for decisions: Onza-Product-Blueprint-v3.md, section 0.
 * Customer area (/acceso) and team portal (/equipo/acceso) are separate; a valid session of
 * the wrong kind is never closed automatically: the person chooses (/sesion-activa).
 */
export type AccountKind = "none" | "guest" | "customer" | "staff";
export type Account = {
  kind: AccountKind;
  onboarded: boolean;
  /** Cuenta del equipo con contraseña temporal pendiente: no opera hasta cambiarla. */
  mustChangePassword?: boolean;
};

export const accountsRequired = (
  env: Record<string, string | undefined> = process.env,
) => env.ACCOUNTS_REQUIRED === "true";

const CUSTOMER = /^\/(v|cart|checkout|orders|cuenta|settings|amigos|actividad|juego|tienda|avatar|ranking|bares|historias)(\/|$)|^\/$/;
const STAFF = /^\/(staff|admin|onza)(\/|$)|^\/equipo\/(locales|clave)$/;
const CUSTOMER_ENTRY = /^\/(acceso|confirmar|recuperar)$/;
/**
 * Panel del superadministrador (`/admin`, `/admin/empresas`, …) y panel de empresa (`/panel`): cada página decide su acceso en el
 * servidor (operador único o membresía de empresa). El operador y las personas de una empresa no son «cuenta de cliente» ni
 * necesariamente «cuenta del equipo» del modelo anterior, así que esta decisión por tipo de cuenta no se les aplica.
 * `/admin/<uuid>` (administrador de un local) NO entra acá: sigue siendo del equipo del local.
 */
const OWN_GATE = /^\/admin(\/(acceso|seguridad|empresas|establecimientos|usuarios|auditoria|nueva-empresa|nuevo-establecimiento)(\/[A-Za-z0-9-]+)*)?$|^\/panel(\/[A-Za-z0-9_-]+)*$/;

/** Only same-site relative paths survive as post-login destinations. */
export function safeNext(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//"))
    return fallback;
  if (value.includes("\\") || /[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}

/**
 * Returns a redirect target, or null when the request may continue. `search` (con su «?») viaja en el destino posterior al
 * acceso: el QR de una mesa (/v/local?spot=…) debe volver con su lugar después de entrar o crear la cuenta.
 */
export function decideAccess(
  path: string,
  account: Account,
  search = "",
): string | null {
  const here = encodeURIComponent(path + search);
  const signedOutCustomer = account.kind === "none" || account.kind === "guest";
  if (path === "/login") return "/equipo/acceso";
  if (OWN_GATE.test(path)) return null;
  if (path === "/onboarding") {
    if (signedOutCustomer) return "/acceso";
    if (account.kind === "staff") return "/sesion-activa?want=cliente";
    return account.onboarded ? "/" : null;
  }
  if (CUSTOMER.test(path)) {
    if (signedOutCustomer) return `/acceso?next=${here}`;
    if (account.kind === "staff") return "/sesion-activa?want=cliente";
    if (!account.onboarded) return `/onboarding?next=${here}`;
    return null;
  }
  if (STAFF.test(path)) {
    if (signedOutCustomer) return `/equipo/acceso?next=${here}`;
    if (account.kind === "customer") return "/sesion-activa?want=equipo";
    // Contraseña temporal pendiente: lo único permitido es cambiarla, en la navegación y en la API.
    if (account.mustChangePassword && path !== "/equipo/clave")
      return "/equipo/clave";
    return null;
  }
  if (CUSTOMER_ENTRY.test(path)) {
    if (account.kind === "staff") return "/sesion-activa?want=cliente";
    if (account.kind === "customer")
      return account.onboarded ? "/" : "/onboarding";
    return null;
  }
  if (path === "/equipo/acceso" && account.kind === "customer")
    return "/sesion-activa?want=equipo";
  if (path === "/sesion-activa" && signedOutCustomer) return "/acceso";
  return null;
}
