import "server-only";

/**
 * Registro estructurado de eventos de servidor (una línea JSON por evento, con ID de correlación). Solo campos de una lista
 * cerrada: nunca contraseñas, JWT, cookies, claves ni códigos o tokens de retiro. Los cambios de permisos y las operaciones de
 * pedido y cobro mock quedan además en la base (order_events, payment_operations, platform_events).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTION = /^[a-z_]{1,40}$/;
const CODE = /^[A-Z_]{1,60}$/;

export type AuditEvent = {
  event: string;
  requestId: string;
  status: number;
  ms?: number;
  action?: string;
  code?: string;
  venueId?: string;
};

export function requestId(request: Request) {
  const given = request.headers.get("x-vercel-id") ?? request.headers.get("x-request-id");
  return given && /^[\w.:-]{1,80}$/.test(given) ? given : crypto.randomUUID();
}

/** Extrae de un cuerpo ya parseado SOLO la acción y el local (si son válidos). Pura. */
export function auditFields(body: unknown): Pick<AuditEvent, "action" | "venueId"> {
  if (typeof body !== "object" || body === null) return {};
  const { action, venueId } = body as Record<string, unknown>;
  return {
    action: typeof action === "string" && ACTION.test(action) ? action : undefined,
    venueId: typeof venueId === "string" && UUID.test(venueId) ? venueId : undefined,
  };
}

export function logEvent(event: AuditEvent) {
  const safe: AuditEvent = {
    event: event.event.slice(0, 40),
    requestId: event.requestId,
    status: event.status,
    ...(event.ms === undefined ? {} : { ms: Math.round(event.ms) }),
    ...(event.action && ACTION.test(event.action) ? { action: event.action } : {}),
    ...(event.code && CODE.test(event.code) ? { code: event.code } : {}),
    ...(event.venueId && UUID.test(event.venueId) ? { venueId: event.venueId } : {}),
  };
  console.log(JSON.stringify({ t: new Date().toISOString(), ...safe }));
}

/** Lee un cuerpo JSON con límite real de tamaño (el encabezado content-length puede omitirse o mentir). */
export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const raw = await request.text();
  if (raw.length > maxBytes) throw new Error("INVALID_INPUT");
  return JSON.parse(raw);
}
