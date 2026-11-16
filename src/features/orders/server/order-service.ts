import "server-only";
import { serverDb } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.generated";
import { commandSchema, type Command } from "./command-schema";
import {
  createPickupToken,
  tokenHash,
  decryptPickupToken,
} from "@/features/pickup/server/tokens";
import { assertMockPayments } from "@/features/payments/server/provider";
import { orderSchema } from "../types";
import QRCode from "qrcode";
export async function executeCommand(raw: unknown) {
  assertMockPayments();
  const command = commandSchema.parse(raw);
  const db = await serverDb();
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user) throw new Error("NOT_AUTHORIZED");
  let input: Json = command;
  if (command.action === "create")
    input = { ...command, ...createPickupToken() };
  if (command.action === "resolve" && command.token) {
    const { token, ...rest } = command;
    input = { ...rest, tokenHash: tokenHash(token) };
  }
  if (command.action === "venue_branding") {
    const { data, error } = await db.rpc("update_venue_branding", { input });
    if (error) throw new Error(error.message);
    return data;
  }
  const { error: sweepError } = await db.rpc("sweep_orders");
  if (sweepError) throw new Error(sweepError.message);
  const { data, error } = await db.rpc("onza_command", { input });
  if (error) throw new Error(error.message);
  if (
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    "error" in data
  )
    throw new Error(String(data.error));
  if (command.action === "venue_update" || command.action === "product_save")
    return data;
  return enrichOrder(data);
}
async function enrichOrder(data: unknown) {
  const order = orderSchema.parse(data);
  const { encrypted_token, ...safe } = order;
  if (encrypted_token) {
    const token = decryptPickupToken(encrypted_token);
    return {
      ...safe,
      pickup_token: token,
      qr_data_url: await QRCode.toDataURL(`onza:${token}`, {
        width: 256,
        margin: 3,
        errorCorrectionLevel: "M",
      }),
    };
  }
  return safe;
}
export async function createOrder(
  input: Extract<Command, { action: "create" }>,
) {
  return executeCommand(input);
}
export async function acceptOrder(input: Command) {
  return executeCommand(input);
}
export async function readyOrder(input: Command) {
  return executeCommand(input);
}
export async function cancelOrder(input: Command) {
  return executeCommand(input);
}
export async function listOrders(
  venueId?: string,
  orderId?: string,
  before?: string,
) {
  const db = await serverDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return [];
  assertMockPayments();
  const { error: sweepError } = await db.rpc("sweep_orders");
  if (sweepError) throw new Error(sweepError.message);
  const { data, error } = await db.rpc("order_list", {
    venue_filter: venueId,
    order_filter: orderId,
    before_time: before,
  });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) throw new Error("INVALID_RESPONSE");
  return Promise.all(data.map(enrichOrder));
}
