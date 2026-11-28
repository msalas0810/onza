import "server-only";

/** Cuentas demo: solo servidor; las credenciales nunca llegan al navegador.
 * Cualquiera que vea el botón entra sin contraseña (también como admin del local), así que tiene indicador propio:
 * DEMO_MODE por sí solo no alcanza, porque hoy está activo en el despliegue público.
 */
export type DemoRole = "customer" | "bartender" | "admin";

export function demoEnabled() {
  return process.env.DEMO_MODE === "true" && process.env.DEMO_LOGIN_ENABLED === "true";
}

export function demoCredentials(
  role: DemoRole,
): { email: string; password: string } | null {
  const pair =
    role === "customer"
      ? {
          email: process.env.DEMO_CUSTOMER_EMAIL,
          password: process.env.DEMO_CUSTOMER_PASSWORD,
        }
      : role === "bartender"
        ? {
            email: process.env.DEMO_BARTENDER_EMAIL,
            password: process.env.DEMO_BARTENDER_PASSWORD,
          }
        : {
            email: process.env.DEMO_ADMIN_EMAIL,
            password: process.env.DEMO_ADMIN_PASSWORD,
          };
  return pair.email && pair.password
    ? { email: pair.email, password: pair.password }
    : null;
}
