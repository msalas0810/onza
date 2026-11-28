/** Correo del token SIN verificar. Solo sirve para elegir el mensaje de una sesión muerta; no concede nada. */
export function unverifiedEmailOf(accessToken: string | undefined | null) {
  try {
    const payload = accessToken?.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { email?: unknown };
    return typeof json.email === "string" ? json.email.toLowerCase() : null;
  } catch {
    return null;
  }
}
