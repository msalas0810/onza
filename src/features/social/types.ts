import { z } from "zod";

/** Duraciones permitidas de un check-in (la base solo acepta estas: 202611270027). */
export const checkinMinutes = [60, 120, 180] as const;

const venueRef = z.object({
  name: z.string(),
  slug: z.string(),
  expiresAt: z.string(),
});
export const socialOverviewSchema = z.object({
  me: z.object({ username: z.string(), name: z.string() }).nullable(),
  checkin: z
    .object({
      venueId: z.string(),
      venueName: z.string(),
      venueSlug: z.string(),
      expiresAt: z.string(),
      share: z.boolean(),
    })
    .nullable(),
  friends: z.array(
    z.object({
      id: z.string(),
      username: z.string(),
      name: z.string(),
      venue: venueRef.nullable(),
    }),
  ),
  incoming: z.array(z.object({ id: z.string(), username: z.string(), name: z.string() })),
  outgoing: z.array(z.object({ id: z.string(), username: z.string() })),
});
export type SocialOverview = z.infer<typeof socialOverviewSchema>;

export const activitySchema = z.array(
  z.object({
    venueId: z.string(),
    name: z.string(),
    slug: z.string(),
    zone: z.string().nullable(),
    latitude: z.number(),
    longitude: z.number(),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  }),
);

/** El nivel nunca es un número de personas: es un rango (3–9, 10–24, 25 o más). */
export const activityLevelLabel: Record<1 | 2 | 3, string> = {
  1: "Algo de movimiento",
  2: "Movido",
  3: "Lleno",
};

export const socialActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("checkin"),
    venueId: z.string().uuid(),
    minutes: z.union([z.literal(60), z.literal(120), z.literal(180)]),
    share: z.boolean().default(false),
  }),
  z.object({ action: z.literal("checkout") }),
  z.object({ action: z.literal("share"), share: z.boolean() }),
  z.object({
    action: z.literal("friend_request"),
    username: z.string().trim().min(1).max(40),
  }),
  z.object({
    action: z.literal("friend_respond"),
    requestId: z.string().uuid(),
    accept: z.boolean(),
  }),
  z.object({ action: z.literal("friend_remove"), friendId: z.string().uuid() }),
]);
export type SocialAction = z.infer<typeof socialActionSchema>;
