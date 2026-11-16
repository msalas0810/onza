import { z } from "zod";
const uuid = z.string().uuid();
const key = z.string().min(1).max(128);
const version = z.number().int().positive();
export const createSchema = z.object({
  action: z.literal("create"),
  venueId: uuid,
  items: z
    .array(
      z.object({
        productId: uuid,
        quantity: z.number().int().min(1).max(10),
        expectedProductVersion: version,
      }),
    )
    .min(1)
    .max(20),
  idempotencyKey: key,
  termsVersion: z.literal("demo-v1"),
  privacyVersion: z.literal("demo-v1"),
  adult: z.literal(true),
  scenario: z
    .enum(["approved", "declined", "requires_action", "timeout"])
    .default("approved"),
});
export const commandSchema = z.discriminatedUnion("action", [
  createSchema,
  z.object({
    action: z.literal("reconcile_authorization"),
    orderId: uuid,
    outcome: z.enum(["authorized", "voided"]),
    reason: z.string().min(5).max(200),
    providerResultConfirmed: z.literal(true),
  }),
  z.object({ action: z.enum(["get", "authorize_action"]), orderId: uuid }),
  z.object({
    action: z.enum(["accept", "ready", "cancel"]),
    orderId: uuid,
    expectedVersion: version,
    idempotencyKey: key,
    reason: z.string().min(3).max(200).optional(),
  }),
  z
    .object({
      action: z.literal("resolve"),
      venueId: uuid,
      code: z
        .string()
        .regex(/^[A-Fa-f0-9]{6}$/)
        .optional(),
      token: z
        .string()
        .regex(/^[A-Za-z0-9_-]{43}$/)
        .optional(),
    })
    .refine((x) => !!x.code !== !!x.token),
  z.object({
    action: z.enum(["capture", "complete", "reconcile"]),
    orderId: uuid,
    claimId: uuid,
    scenario: z
      .enum(["approved", "declined", "timeout_after_success", "unknown"])
      .optional(),
    physicalHandoff: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("transfer"),
    orderId: uuid,
    physicalCheck: z.literal("not_delivered"),
    reason: z.string().min(5).max(200),
  }),
  z.object({
    action: z.literal("refund"),
    orderId: uuid,
    reason: z.string().min(5).max(200),
  }),
  z.object({
    action: z.literal("venue_update"),
    venueId: uuid,
    paused: z.boolean().optional(),
    name: z.string().min(1).max(100).optional(),
    zone: z.string().max(100).optional(),
    pickupLabel: z.string().min(1).max(100).optional(),
    supportContact: z.string().max(100).optional(),
    hours: z.string().max(200).optional(),
    openState: z.enum(["open", "closed"]).optional(),
    etaMinutes: z.number().int().min(1).max(120).optional(),
    capacity: z.number().int().min(1).max(100).optional(),
  }),
  z.object({
    action: z.literal("product_save"),
    venueId: uuid,
    productId: uuid.optional(),
    expectedVersion: version.optional(),
    categoryId: uuid.optional(),
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    priceMinor: z.number().int().min(0).max(100000000).optional(),
    size: z.string().max(100).optional(),
    allergens: z.string().max(200).optional(),
    available: z.boolean().optional(),
    archived: z.boolean().optional(),
    photoPath: z.string().max(300).nullable().optional(),
  }),
]);
export type Command = z.infer<typeof commandSchema>;
