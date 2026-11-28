import { z } from "zod";
import { jsonSchema } from "@/features/game/types";
import { ROLES } from "./schemas";

const uuid = z.string().uuid();
export const panelViewSchema = z.discriminatedUnion("view", [
  z.object({ view: z.literal("my") }),
  z.object({ view: z.literal("summary"), organizationId: uuid, venueId: uuid.optional(), days: z.coerce.number().int().min(1).max(90).optional() }),
  z.object({ view: z.literal("customers"), organizationId: uuid }),
  z.object({ view: z.literal("menu"), venueId: uuid }),
  z.object({ view: z.literal("staff"), organizationId: uuid }),
]);

export const panelCommandSchema = z.discriminatedUnion("command", [
  z.object({ command: z.literal("venue_settings"), venueId: uuid, values: z.record(z.string(), jsonSchema) }),
  z.object({ command: z.literal("invitation_create"), organizationId: uuid, email: z.string().email().max(200), role: z.enum(ROLES), venueIds: z.array(uuid).max(50).optional() }),
  z.object({ command: z.literal("invitation_revoke"), id: uuid }),
  z.object({ command: z.literal("invitation_resend"), id: uuid }),
  z.object({ command: z.literal("member_set"), organizationId: uuid, userId: uuid, role: z.enum(ROLES), venueIds: z.array(uuid).max(50).optional() }),
  z.object({ command: z.literal("member_remove"), organizationId: uuid, userId: uuid }),
]);
