import { z } from "zod";
import { SLUG_PATTERN, isCountry, validatePhone, validateTaxId } from "./validation";
import { jsonSchema } from "@/features/game/types";

const uuid = z.string().uuid();
const slug = z.string().min(2).max(60).regex(SLUG_PATTERN, "Use minúsculas, números y guiones.");
export const ROLES = ["owner", "admin", "venue_manager", "ops_manager", "cashier", "kitchen", "staff", "analyst"] as const;
export type OrgRole = (typeof ROLES)[number];
export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  venue_manager: "Gerente de local",
  ops_manager: "Gerente de operaciones",
  cashier: "Caja",
  kitchen: "Cocina",
  staff: "Personal",
  analyst: "Analista",
};
/** Roles que necesitan al menos un local asignado. */
export const SCOPED_ROLES: readonly OrgRole[] = ["venue_manager", "cashier", "kitchen", "staff"];

export const organizationSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug,
    legal_name: z.string().trim().max(160).default(""),
    tax_id: z.string().trim().min(1, "Ingrese el documento de identidad."),
    country: z.string().refine(isCountry, "País no admitido."),
    currency: z.string().regex(/^[A-Z]{3}$/).default("CRC"),
    contact_name: z.string().trim().max(120).optional(),
    contact_email: z.string().email().max(200).optional().or(z.literal("")),
    contact_phone: z.string().trim().optional().or(z.literal("")),
    notes: z.string().max(2000).default(""),
    plan: z.enum(["free", "standard", "premium"]).default("free"),
    is_demo: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (!isCountry(value.country)) return;
    const tax = validateTaxId(value.country, value.tax_id);
    if (!tax.ok) ctx.addIssue({ code: "custom", path: ["tax_id"], message: tax.message });
    if (value.contact_phone) {
      const phone = validatePhone(value.country, value.contact_phone);
      if (!phone.ok) ctx.addIssue({ code: "custom", path: ["contact_phone"], message: phone.message });
    }
  });
export type OrganizationInput = z.infer<typeof organizationSchema>;

export const venueSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: slug.max(100),
  zone: z.string().trim().max(100).default(""),
});

/** Normaliza los datos de la empresa para la base (documento sin guiones y teléfono en E.164). */
export function normalizeOrganization(input: OrganizationInput) {
  const country = isCountry(input.country) ? input.country : "CR";
  const tax = validateTaxId(country, input.tax_id);
  const phone = input.contact_phone ? validatePhone(country, input.contact_phone) : null;
  return {
    ...input,
    tax_id: tax.ok ? tax.value : input.tax_id,
    contact_phone: phone && phone.ok ? phone.value : null,
    contact_email: input.contact_email || null,
    contact_name: input.contact_name || null,
  };
}

export const commandSchema = z.discriminatedUnion("command", [
  z.object({
    command: z.literal("onboard"),
    organization: organizationSchema,
    venue: venueSchema,
    owner: z.object({ email: z.string().email().max(200) }),
  }),
  z.object({ command: z.literal("org_update"), id: uuid, values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])) }),
  z.object({ command: z.literal("org_status"), id: uuid, status: z.enum(["active", "suspended", "closed"]), reason: z.string().max(300).optional() }),
  z.object({ command: z.literal("org_delete"), id: uuid, confirmSlug: z.string().max(60) }),
  z.object({ command: z.literal("venue_create"), organizationId: uuid, venue: venueSchema }),
  z.object({ command: z.literal("venue_update"), id: uuid, values: z.record(z.string(), jsonSchema) }),
  z.object({ command: z.literal("venue_status"), id: uuid, action: z.enum(["publish", "suspend", "unsuspend", "archive", "unarchive"]), reason: z.string().max(300).optional() }),
  z.object({ command: z.literal("venue_delete"), id: uuid, confirmSlug: z.string().max(100) }),
  z.object({
    command: z.literal("invitation_create"),
    organizationId: uuid,
    email: z.string().email().max(200),
    role: z.enum(ROLES),
    venueIds: z.array(uuid).max(50).optional(),
  }),
  z.object({ command: z.literal("invitation_revoke"), id: uuid }),
  z.object({ command: z.literal("user"), action: z.enum(["suspend", "unsuspend", "delete"]), userId: uuid }),
]);
export type PlatformCommand = z.infer<typeof commandSchema>;

export const dataViewSchema = z.discriminatedUnion("view", [
  z.object({ view: z.literal("overview"), from: z.string().optional(), to: z.string().optional() }),
  z.object({ view: z.literal("organizations"), status: z.string().optional(), demo: z.string().optional(), q: z.string().max(100).optional() }),
  z.object({ view: z.literal("organization"), id: uuid }),
  z.object({ view: z.literal("inventory"), id: uuid }),
  z.object({ view: z.literal("venues"), filter: z.string().optional(), organizationId: uuid.optional(), q: z.string().max(100).optional() }),
  z.object({ view: z.literal("venue"), id: uuid }),
  z.object({ view: z.literal("venue_menu"), id: uuid }),
  z.object({ view: z.literal("users"), kind: z.string().optional(), q: z.string().max(100).optional() }),
  z.object({ view: z.literal("audit"), organizationId: uuid.optional(), action: z.string().max(80).optional(), before: z.string().optional() }),
]);
