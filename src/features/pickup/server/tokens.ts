import "server-only";
import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
function encryptionKey() {
  const raw = process.env.PICKUP_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("PICKUP_KEY_NOT_CONFIGURED");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("PICKUP_KEY_NOT_CONFIGURED");
  return key;
}
export function createPickupToken() {
  const token = randomBytes(32).toString("base64url");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return {
    tokenHash: tokenHash(token),
    encryptedToken: [
      process.env.PICKUP_TOKEN_KEY_VERSION ?? "1",
      iv.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      encrypted.toString("base64url"),
    ].join("."),
  };
}
export function decryptPickupToken(encrypted: string) {
  const [version, iv, tag, data] = encrypted.split(".");
  if (
    version !== (process.env.PICKUP_TOKEN_KEY_VERSION ?? "1") ||
    !iv ||
    !tag ||
    !data
  )
    throw new Error("INVALID_TOKEN");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
