export const messages: Record<string, string> = {
  PICKUP_KEY_NOT_CONFIGURED:
    "El ticket no está disponible en este momento. Volvé a consultar o pedí ayuda al local.",
  SUPABASE_NOT_CONFIGURED:
    "El servicio no está disponible en este momento. Intentá nuevamente más tarde.",
  SESSION_REQUIRED:
    "No hay una sesión activa. Abrí tus pedidos desde el navegador donde hiciste el pedido o iniciá sesión si sos del personal.",
  CONNECTION_ERROR:
    "No pudimos conectar con el servicio. Revisá tu conexión y volvé a consultar el estado.",
  RESOURCE_NOT_FOUND:
    "No encontramos este recurso. Volvé a Explorar para elegir un local.",
  VENUE_CLOSED:
    "Este local está cerrado. Tu carrito sigue disponible para cuando vuelva a abrir.",
  ALREADY_DELIVERED:
    "Este retiro ya fue utilizado. El pedido está entregado; no lo entregués otra vez.",
  INVALID_INPUT: "Revisá los datos e intentá nuevamente.",
  INVALID_LOCATION:
    "Ingresá latitud entre -90 y 90 y longitud entre -180 y 180, o dejá ambas vacías.",
  NOT_AUTHORIZED: "Tu sesión no tiene permiso para este pedido o local.",
  VENUE_PAUSED:
    "El local no está recibiendo pedidos. Tu carrito sigue disponible.",
  VENUE_CAPACITY:
    "La barra está al máximo de pedidos activos. Intentá más tarde.",
  PRICE_CHANGED:
    "El menú cambió. Volvé al carrito, revisá los precios y confirmá otra vez.",
  OUT_OF_STOCK: "Un producto ya no está disponible. Revisá el carrito.",
  VERSION_CONFLICT:
    "El pedido cambió en otra sesión. Actualizá para ver su estado.",
  INVALID_TRANSITION: "Esta acción no está disponible en el estado actual.",
  PAYMENT_UNCONFIRMED:
    "No pudimos confirmar el cobro. Consultá el estado; no entregués ni cobrés otra vez.",
  CLAIM_OWNED_ELSEWHERE:
    "Otra persona está atendiendo este retiro. Solo esa sesión puede entregar.",
  INVALID_PICKUP:
    "El QR o código de retiro no es válido para este local. Pedile al cliente su ticket; el número de pedido no sirve para retirar.",
  EXPIRED: "El ticket o la reserva venció. Consultá al local.",
  RATE_LIMITED: "Demasiados intentos. Esperá un minuto y volvé a intentar.",
  IDEMPOTENCY_CONFLICT:
    "Ese intento corresponde a otro contenido. Revisá el pedido antes de iniciar uno nuevo.",
  DEMO_NOT_ENABLED:
    "Esta base no tiene habilitado el demo. Los pagos reales permanecen desactivados.",
  POLICY_REQUIRED: "Aceptá las políticas y confirmá tu mayoría de edad.",
  INVALID_QUANTITY:
    "Usá entre 1 y 10 unidades por producto, hasta 20 por pedido.",
  PROVIDER_NOT_CONFIGURED: "Los pagos reales no están configurados.",
  INVALID_BRANDING:
    "Los datos del local o la imagen no son válidos. Usá una imagen JPG, PNG o WebP de hasta 2 MB subida desde esta pantalla.",
  INVALID_PRODUCT_IMAGE:
    "La imagen del trago no es válida. Usá una imagen JPG, PNG o WebP de hasta 2 MB subida desde esta pantalla.",
  SUPERVISOR_REVIEW_REQUIRED:
    "Un supervisor debe verificar físicamente si se entregó antes de transferir el retiro.",
  STAFF_CANNOT_ORDER:
    "Las cuentas del equipo no pueden pedir. Usá tu cuenta personal.",
  STAFF_ACCOUNT:
    "Esta cuenta es del equipo y no puede usarse como cuenta de cliente.",
  ACCOUNT_REQUIRED: "Ingresá con tu cuenta para pedir.",
  ONBOARDING_REQUIRED: "Completá tu perfil para poder pedir.",
  PROFILE_REQUIRED: "Completá tu perfil primero.",
  INVALID_NAME: "Ingresá tu nombre (entre 2 y 100 caracteres).",
  INVALID_USERNAME:
    "Usá de 3 a 20 letras minúsculas, números, punto o guion bajo.",
  USERNAME_TAKEN: "Ese @usuario ya existe. Elegí otro.",
  INVALID_PHONE: "Ingresá un teléfono válido con su código de país.",
  INVALID_BIRTH_DATE: "Ingresá una fecha de nacimiento válida.",
  UNDERAGE: "Necesitás tener 18 años o más para usar Onza.",
  TERMS_REQUIRED: "Aceptá las condiciones y la política de privacidad.",
  INVALID_PROFILE: "Revisá los datos del perfil.",
};
export function errorCode(error: unknown) {
  if (error instanceof Error && error.name === "AuthSessionMissingError")
    return "SESSION_REQUIRED";
  if (
    error instanceof Error &&
    (error.name === "AuthRetryableFetchError" ||
      (error.name === "TypeError" && /fetch|network/i.test(error.message)))
  )
    return "CONNECTION_ERROR";
  const text = error instanceof Error ? error.message : String(error);
  return (
    Object.keys(messages).find((code) => text.includes(code)) ?? "UNKNOWN_ERROR"
  );
}
export function errorMessage(error: unknown) {
  return (
    messages[errorCode(error)] ??
    "No pudimos completar la operación. Revisá tu conexión y consultá el estado antes de reintentar."
  );
}
