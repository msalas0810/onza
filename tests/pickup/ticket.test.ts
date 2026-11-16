import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { enrichOrder } from "@/features/orders/server/order-service";
import { createPickupToken } from "@/features/pickup/server/tokens";
const ready = {
  id: "o",
  venue_id: "v",
  customer_id: "c",
  public_code: "ABCDEF",
  status: "ready",
  total_minor: 100,
  currency: "CRC",
  version: 3,
  payment_state: "authorized",
  authorized_minor: 100,
  captured_minor: 0,
  refunded_minor: 0,
  created_at: "2026-11-16",
  preparing_at: null,
  ready_at: null,
  delivered_at: null,
  deadline: "2026-11-17",
  business_date: "2026-11-16",
  claim_id: null,
  claimed_elsewhere: false,
  venue: {
    id: "v",
    name: "Local",
    pickup_label: "Barra",
    support_contact: "",
    eta_minutes: 15,
  },
  items: [],
  events: [],
};
beforeEach(() => {
  vi.stubEnv("PICKUP_TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
  vi.stubEnv("PICKUP_TOKEN_KEY_VERSION", "1");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
it("QR failure preserves a distinct safe manual credential without returning token/ciphertext", async () => {
  vi.spyOn(QRCode, "toDataURL").mockRejectedValue(new Error("render failed"));
  const result = await enrichOrder({
    ...ready,
    encrypted_token: createPickupToken().encryptedToken,
  });
  expect("encrypted_token" in result).toBe(false);
  expect("pickup_token" in result).toBe(false);
  expect(
    "pickup_code" in result && /^[A-F0-9]{12}$/.test(result.pickup_code ?? ""),
  ).toBe(true);
  expect("ticket_error" in result && result.ticket_error).toBe(
    "qr_unavailable",
  );
});
it("unreadable historical ticket preserves the order and offers a recoverable error", async () => {
  const result = await enrichOrder({
    ...ready,
    encrypted_token: "unreadable-old-cipher",
  });
  expect(result.status).toBe("ready");
  expect("pickup_code" in result).toBe(false);
  expect("encrypted_token" in result).toBe(false);
  expect("ticket_error" in result && result.ticket_error).toBe("unavailable");
});
