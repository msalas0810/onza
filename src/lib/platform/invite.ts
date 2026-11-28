import { createHash, randomBytes } from "node:crypto";

/** Token de invitación de 256 bits. El token viaja solo en el enlace; la base guarda únicamente su hash SHA-256. */
export function newInviteToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}
export const hashInviteToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const validInviteToken = (token: unknown): token is string => typeof token === "string" && /^[A-Za-z0-9_-]{20,100}$/.test(token);

/** Enlace de activación. No hay servicio de correo propio: el administrador copia este enlace y se lo entrega a la persona. */
export function inviteUrl(token: string, origin = process.env.APP_ORIGIN ?? "") {
  return `${origin.replace(/\/+$/, "")}/panel/invitacion/${token}`;
}
