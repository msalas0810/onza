import "server-only";

/** Cuentas demo: solo servidor. Activas únicamente con DEMO_MODE=true; nunca llegan al navegador. */
export type DemoRole = "customer" | "bartender" | "admin";

export function demoEnabled() {
  return process.env.DEMO_MODE === "true";
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
