import "server-only";
import { serverDb } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.generated";
import { commandSchema, type Command } from "./command-schema";
import {
  createPickupToken,
  tokenHash,
  decryptPickupToken,
  pickupCode,
} from "@/features/pickup/server/tokens";
import { assertMockPayments } from "@/features/payments/server/provider";
import { orderSchema } from "../types";
import QRCode from "qrcode";
import { accountsRequired } from "@/lib/access-policy";
import { scenariosEnabled } from "@/features/payments/server/provider";
export async function executeCommand(raw: unknown) {
  assertMockPayments();
  const command = commandSchema.parse(raw);
  const db = await serverDb();
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (
    authError &&
    ((authError.status && authError.status >= 500) ||
      authError.name === "AuthRetryableFetchError")
  )
    throw new Error("CONNECTION_ERROR");
  if (authError || !user) throw new Error("SESSION_REQUIRED");
  if (command.action === "create") await assertCanOrder(db, user.is_anonymous);
  let input: Json = command;
  // Simulated outcomes are for tests only: never selectable from the customer or bar UI.
  if (!scenariosEnabled() && "scenario" in command)
    input = { ...command, scenario: "approved" };
  if (command.action === "create")
    input = { ...(input as object), ...createPickupToken() };
  if (command.action === "resolve" && command.token) {
    const { token, ...rest } = command;
    input = { ...rest, tokenHash: tokenHash(token) };
  }
  if (command.action === "venue_branding") {
    const { data, error } = await db.rpc("update_venue_branding", { input });
    if (error) throw new Error(error.message);
    return data;
  }
  if (command.action === "product_image") {
    const { data, error } = await db.rpc("update_product_image", { input });
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
/** Work accounts never buy; with accounts required a customer needs a session and a completed profile. */
async function assertCanOrder(
  db: Awaited<ReturnType<typeof serverDb>>,
  anonymous: boolean | undefined,
) {
  const { data: membership } = await db
    .from("memberships")
    .select("venue_id")
    .limit(1);
  if (membership?.length) throw new Error("STAFF_CANNOT_ORDER");
  if (!accountsRequired()) return;
  if (anonymous) throw new Error("ACCOUNT_REQUIRED");
  const { data: profile } = await db
    .from("profiles")
    .select("user_id")
    .maybeSingle();
  if (!profile) throw new Error("ONBOARDING_REQUIRED");
}
export async function enrichOrder(data: unknown) {
  const order = orderSchema.parse(data);
  const { encrypted_token, ...safe } = order;
  if (encrypted_token) {
    let token: string;
    try {
      token = decryptPickupToken(encrypted_token);
    } catch {
      // One unreadable old ticket must not hide the order, its state or other orders.
      // Do not log the credential, change keys or silently issue another token.
      return { ...safe, ticket_error: "unavailable" };
    }
    const ticket = { ...safe, pickup_code: pickupCode(token) };
    try {
      return {
        ...ticket,
        qr_data_url: await QRCode.toDataURL(`onza:${token}`, {
          width: 256,
          margin: 3,
          errorCorrectionLevel: "M",
        }),
      };
    } catch {
      return { ...ticket, ticket_error: "qr_unavailable" };
    }
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
    error: authError,
  } = await db.auth.getUser();
  if (
    authError &&
    ((authError.status && authError.status >= 500) ||
      authError.name === "AuthRetryableFetchError")
  )
    throw new Error("CONNECTION_ERROR");
  if (!user) throw new Error("SESSION_REQUIRED");
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
