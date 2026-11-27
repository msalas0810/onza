/** Códigos de Supabase Auth que la persona puede entender o resolver. El resto no muestra el mensaje crudo del proveedor. */
const messages: Record<string, string> = {
  over_email_send_rate_limit:
    "No pudimos crear la cuenta: se alcanzó el límite de envío de correos. Probá más tarde.",
  over_request_rate_limit: "Demasiados intentos. Esperá unos minutos y volvé a probar.",
  user_already_exists: "Ese correo ya tiene cuenta. Ingresá con tu contraseña.",
  email_exists: "Ese correo ya tiene cuenta. Ingresá con tu contraseña.",
  email_address_invalid: "Ese correo no es válido. Revisalo.",
  email_address_not_authorized: "No podemos enviar correos a esa dirección todavía. Avisanos.",
  signup_disabled: "Por ahora no se pueden crear cuentas nuevas.",
  weak_password: "La contraseña es muy débil. Usá una más larga y difícil de adivinar.",
};
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return (typeof code === "string" && messages[code]) || "No pudimos completar el registro. Intentá de nuevo.";
}
