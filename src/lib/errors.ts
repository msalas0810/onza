export const messages: Record<string, string> = {
  PICKUP_KEY_NOT_CONFIGURED:
    "Falta configurar PICKUP_TOKEN_ENCRYPTION_KEY con 32 bytes aleatorios en base64. Seguí el setup del README.",
  SUPABASE_NOT_CONFIGURED:
    "Falta conectar Supabase. Seguí README: configurá .env.local, iniciá Supabase y aplicá las migraciones. No se guardan pedidos hasta conectarlo.",
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
  INVALID_PICKUP: "No encontramos un retiro válido para este local.",
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
  SUPERVISOR_REVIEW_REQUIRED:
    "Un supervisor debe verificar físicamente si se entregó antes de transferir el retiro.",
};
export function errorCode(error: unknown) {
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
