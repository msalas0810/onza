import "server-only";
import { executeCommand } from "@/features/orders/server/order-service";
export async function claimPickup(input: {
  venueId: string;
  code?: string;
  token?: string;
}) {
  return executeCommand({ action: "resolve", ...input });
}
export async function capturePickup(input: {
  orderId: string;
  claimId: string;
  scenario?: "approved" | "declined" | "timeout_after_success" | "unknown";
}) {
  return executeCommand({ action: "capture", ...input });
}
export async function completePickup(input: {
  orderId: string;
  claimId: string;
  physicalHandoff: boolean;
}) {
  return executeCommand({ action: "complete", ...input });
}
