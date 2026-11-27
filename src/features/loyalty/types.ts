import { z } from "zod";

// Contratos de entrada de los RPC de fidelización (supabase/migrations/202611270025_loyalty_foundation.sql).
// La base decide autorización y reglas de negocio; estos esquemas solo dan forma y rango a lo que llega del navegador.

const uuid = z.string().uuid();
const percent = z.number().min(0).max(100);
const hour = z.number().int().min(0).max(23);
const isoDate = z.iso.datetime({ offset: true });

export const loyaltyFunderSchema = z.enum(["venue", "sponsor", "onza"]);
export const loyaltyRuleKindSchema = z.enum(["all", "category", "product"]);

export const programInputSchema = z.object({
  venueId: uuid,
  enabled: z.boolean(),
  basePercent: percent,
  pointsValidDays: z.number().int().min(1).max(3650),
});
export type ProgramInput = z.infer<typeof programInputSchema>;

export const campaignInputSchema = z
  .object({
    venueId: uuid,
    id: uuid.optional(),
    name: z.string().trim().min(1).max(80),
    funder: loyaltyFunderSchema,
    sponsorName: z.string().trim().min(1).max(80).nullable().optional(),
    budgetPoints: z.number().int().min(0),
    active: z.boolean().default(true),
    startsAt: isoDate.nullable().optional(),
    endsAt: isoDate.nullable().optional(),
  })
  .refine((c) => (c.funder === "sponsor") === Boolean(c.sponsorName), {
    message: "sponsorName solo con patrocinador",
    path: ["sponsorName"],
  })
  .refine(
    (c) =>
      !c.startsAt || !c.endsAt || Date.parse(c.endsAt) > Date.parse(c.startsAt),
    {
      message: "endsAt debe ser posterior a startsAt",
      path: ["endsAt"],
    },
  );
export type CampaignInput = z.infer<typeof campaignInputSchema>;

export const ruleInputSchema = z
  .object({
    venueId: uuid,
    id: uuid.optional(),
    name: z.string().trim().min(1).max(80),
    kind: loyaltyRuleKindSchema,
    scopeId: uuid.nullable().optional(),
    percent,
    weekdays: z
      .array(z.number().int().min(1).max(7))
      .min(1)
      .max(7)
      .nullable()
      .optional(),
    hourFrom: hour.nullable().optional(),
    hourTo: hour.nullable().optional(),
    minAmountMinor: z.number().int().min(0).default(0),
    maxPointsPerOrder: z.number().int().positive().nullable().optional(),
    campaignId: uuid.nullable().optional(),
    validFrom: isoDate.nullable().optional(),
    validUntil: isoDate.nullable().optional(),
    active: z.boolean().default(true),
  })
  .refine((r) => (r.kind === "all") === !r.scopeId, {
    message: "scopeId solo con categoría o producto",
    path: ["scopeId"],
  })
  .refine(
    (r) =>
      (r.hourFrom == null && r.hourTo == null) ||
      (r.hourFrom != null && r.hourTo != null && r.hourFrom !== r.hourTo),
    {
      message: "la franja horaria necesita inicio y fin distintos",
      path: ["hourTo"],
    },
  )
  .refine(
    (r) =>
      !r.validFrom ||
      !r.validUntil ||
      Date.parse(r.validUntil) > Date.parse(r.validFrom),
    {
      message: "validUntil debe ser posterior a validFrom",
      path: ["validUntil"],
    },
  );
export type RuleInput = z.infer<typeof ruleInputSchema>;
