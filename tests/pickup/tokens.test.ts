import { it, expect, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";
import {
  createPickupToken,
  decryptPickupToken,
  tokenHash,
} from "@/features/pickup/server/tokens";
import {
  BacPaymentProvider,
  assertMockPayments,
} from "@/features/payments/server/provider";
beforeEach(() => {
  process.env.PICKUP_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.PICKUP_TOKEN_KEY_VERSION = "1";
});
it("ticket de 256 bits cifrado, reconstruible y sensible a alteración", () => {
  const value = createPickupToken();
  const token = decryptPickupToken(value.encryptedToken);
  expect(token).toHaveLength(43);
  expect(tokenHash(token)).toBe(value.tokenHash);
  expect(value.encryptedToken).not.toContain(token);
  const pieces = value.encryptedToken.split(".");
  pieces[2] = randomBytes(16).toString("base64url");
  expect(() => decryptPickupToken(pieces.join("."))).toThrow();
});
it("BAC y activación real fallan cerrados", async () => {
  process.env.PAYMENT_PROVIDER = "bac";
  process.env.REAL_PAYMENTS_ENABLED = "true";
  expect(() => assertMockPayments()).toThrow("PROVIDER_NOT_CONFIGURED");
  await expect(
    new BacPaymentProvider().getStatus({
      merchantConfigRef: "x",
      operationId: "x",
      idempotencyKey: "x",
    }),
  ).rejects.toThrow("PROVIDER_NOT_CONFIGURED");
});
