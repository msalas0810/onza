/**
 * Registro estructurado de accesos denegados al panel. Guarda IP, ruta, método, motivo e identificador de la petición.
 * NUNCA guarda el token, las cookies, el correo ni el cuerpo de la petición.
 */
export type DenyReason =
  | "no_session"
  | "session_revoked_operator"
  | "session_revoked_other"
  | "email_unverified"
  | "not_operator"
  | "auth_unavailable"
  | "check_unavailable";

export type DenyLog = {
  event: "platform_access_denied";
  level: "warn";
  at: string;
  requestId: string;
  ip: string;
  path: string;
  method: string;
  reason: DenyReason;
};

type Sink = (line: string) => void;
let sink: Sink = (line) => console.warn(line);
/** Para pruebas. */
export function setPlatformLogSink(next: Sink | null) {
  sink = next ?? ((line) => console.warn(line));
}

export function logPlatformDenied(entry: Omit<DenyLog, "event" | "level" | "at">) {
  const line: DenyLog = { event: "platform_access_denied", level: "warn", at: new Date().toISOString(), ...entry };
  sink(JSON.stringify(line));
}

const SAFE_ID = /^[A-Za-z0-9_.:-]{1,80}$/;
/** Identificador de la petición: el que manda la plataforma (si es seguro) o uno nuevo. */
export function requestIdOf(request: Request) {
  const given = request.headers.get("x-request-id") ?? request.headers.get("cf-ray") ?? "";
  return SAFE_ID.test(given) ? given : crypto.randomUUID();
}

/** IP del cliente (Cloudflare o proxy). Solo caracteres de una dirección; nunca se confía en nada más. */
export function clientIpOf(request: Request) {
  const raw = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "";
  const ip = raw.trim();
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : "unknown";
}
