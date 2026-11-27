// El orden importa: errorCode toma la primera clave contenida en el texto (ORDER_EXPIRED antes que EXPIRED).
export const messages: Record<string, string> = {
  STAFF_NOT_SOCIAL:
    "Amigos y actividad son para cuentas personales. Entrá con tu cuenta de cliente.",
  FRIEND_NOT_FOUND: "No encontramos a nadie con ese @usuario. Revisalo y volvé a intentar.",
  FRIEND_SELF: "Ese es tu propio @usuario.",
  CHECKIN_REQUIRED: "Primero marcá en qué local estás para poder compartirlo.",
  ORDER_EXPIRED:
    "Pasaron los cinco minutos para aceptar este pedido. Venció y la reserva quedó liberada.",
  PRODUCT_ARCHIVED:
    "Este producto está archivado. Restauralo antes de habilitarlo para vender.",
  PICKUP_KEY_NOT_CONFIGURED:
    "El ticket no está disponible en este momento. Volvé a consultar o pedí ayuda al local.",
  SUPABASE_NOT_CONFIGURED:
    "El servicio no está disponible en este momento. Intentá nuevamente más tarde.",
  SESSION_REQUIRED: "Tu sesión venció. Volvé a entrar para continuar.",
  PASSWORD_CHANGE_REQUIRED:
    "Cambiá tu contraseña temporal para continuar. Hasta entonces no podés operar.",
  CONNECTION_ERROR:
    "No pudimos conectar con el servicio. Revisá tu conexión y volvé a consultar el estado.",
  RESOURCE_NOT_FOUND:
    "No encontramos este recurso. Volvé a Explorar para elegir un local.",
  VENUE_CLOSED:
    "Este local está cerrado. Tu carrito sigue disponible para cuando vuelva a abrir.",
  ALREADY_DELIVERED:
    "Este retiro ya fue utilizado. El pedido está entregado; no lo entregués otra vez.",
  SPOT_REQUIRED:
    "Este local entrega en tu lugar: elegí dónde recibir tu pedido.",
  SPOT_INVALID:
    "Ese lugar ya no está disponible en este local. Elegí otro y volvé a pedir.",
  DELIVERY_UNAVAILABLE:
    "Este local no entrega en el lugar. Retirá tu pedido en la barra.",
  SPOT_DUPLICATE: "Ya existe un lugar con ese nombre en este local.",
  SPOT_IN_USE:
    "Ese lugar ya recibió pedidos, así que no se puede borrar. Deshabilitalo y el historial lo conserva.",
  NO_SPOTS:
    "Cargá el mapa o habilitá al menos un lugar antes de activar la entrega en el lugar.",
  MAP_OUTDATED:
    "El mapa del local cambió. Volvé a marcar dónde estás y pedí otra vez.",
  OUTSIDE_AREA:
    "Ahí no llegamos. Marcá un punto dentro de la zona de entrega del mapa.",
  INVALID_SHAPE:
    "Esa forma no es válida. Dibujala de nuevo dentro de la imagen.",
  NO_MAP: "Primero cargá el mapa del local.",
  LAST_SPOT:
    "Es el último lugar habilitado. Volvé primero a «Solo barra» o habilitá otro lugar.",
  TOO_MANY_SPOTS: "Un local puede tener hasta 300 lugares.",
  INVALID_INPUT: "Revisá los datos e intentá nuevamente.",
  INVALID_LOCATION:
    "Ingresá latitud entre -90 y 90 y longitud entre -180 y 180, o dejá ambas vacías.",
  NOT_AUTHORIZED: "Tu sesión no tiene permiso para este pedido o local.",
  VENUE_PAUSED:
    "El local no está recibiendo pedidos. Tu carrito sigue disponible.",
  VENUE_CAPACITY:
    "La barra está llena. Podés entrar en la lista de espera y conservar tu carrito.",
  CANCEL_COOLDOWN:
    "Cancelaste varios pedidos seguidos. Podés volver a pedir en unos minutos; tu carrito se conserva.",
  WAITLIST_DISABLED: "La lista de espera no está disponible en este local.",
  PRICE_CHANGED:
    "El menú cambió. Volvé al carrito, revisá los precios y confirmá otra vez.",
  OUT_OF_STOCK: "Un producto ya no está disponible. Revisá el carrito.",
  INVALID_TOKEN: "No pudimos preparar el ticket. Intentá de nuevo.",
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
    "Los pedidos no están habilitados en este momento.",
  POLICY_REQUIRED: "Aceptá las políticas y confirmá tu mayoría de edad.",
  INVALID_QUANTITY:
    "Usá entre 1 y 10 unidades por producto, hasta 20 por pedido.",
  PROVIDER_NOT_CONFIGURED: "Los pagos reales no están configurados.",
  SCENARIO_DISABLED:
    "Esa opción no está disponible.",
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
  INVALID_AVATAR: "La foto no es válida. Elegí una imagen JPG, PNG o WebP.",
  INVALID_NAME: "Ingresá tu nombre (entre 2 y 100 caracteres).",
  INVALID_USERNAME:
    "Usá de 3 a 20 letras minúsculas, números, punto o guion bajo.",
  USERNAME_TAKEN: "Ese @usuario ya existe. Elegí otro.",
  INVALID_PHONE: "Ingresá un teléfono válido con su código de país.",
  INVALID_BIRTH_DATE: "Ingresá una fecha de nacimiento válida.",
  UNDERAGE: "Necesitás tener 18 años o más para usar Onza.",
  TERMS_REQUIRED: "Aceptá las condiciones y la política de privacidad.",
  INVALID_PROFILE: "Revisá los datos del perfil.",
  TEAM_ADMIN_NOT_CONFIGURED:
    "Agregar personas no está configurado en este entorno. Falta la clave de servidor del proyecto.",
  CUSTOMER_EMAIL:
    "Ese correo ya es de una cuenta personal. Usá otro correo para la cuenta laboral.",
  ALREADY_MEMBER: "Esa persona ya es parte del equipo de este local.",
  INVALID_EMAIL: "Escribí un correo válido.",
  INVALID_ROLE: "El permiso no es válido.",
  NOT_MEMBER: "Esa persona ya no es parte del equipo de este local.",
  SELF_CHANGE: "No podés cambiar tu propio permiso ni quitarte el acceso.",
  LAST_ADMIN: "El local necesita al menos un administrador.",
  WEAK_PASSWORD: "Usá al menos 10 caracteres.",
  SAME_PASSWORD: "La contraseña nueva tiene que ser distinta de la temporal.",
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

/** Detalle seguro de un rechazo del servidor (qué línea revisar). Nunca incluye datos personales ni de pago. */
export type FailureDetail = {
  productId?: string;
  priceMinor?: number;
  version?: number;
  retryAt?: string;
};
export class CommandFailure extends Error {
  constructor(
    code: string,
    public detail?: FailureDetail,
  ) {
    super(code);
  }
}
/** Toma solo los campos conocidos de una respuesta de error de la base. */
export function failureDetail(value: Record<string, unknown>) {
  const detail: FailureDetail = {};
  if (typeof value.productId === "string") detail.productId = value.productId;
  if (typeof value.priceMinor === "number") detail.priceMinor = value.priceMinor;
  if (typeof value.version === "number") detail.version = value.version;
  if (typeof value.retryAt === "string") detail.retryAt = value.retryAt;
  return Object.keys(detail).length ? detail : undefined;
}
