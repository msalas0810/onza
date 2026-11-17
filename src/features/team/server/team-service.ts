import "server-only";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { requireVenue } from "@/lib/supabase/guards";
import { adminDb } from "@/lib/supabase/admin";
import { serverDb } from "@/lib/supabase/server";

export const teamMemberSchema = z.object({
  userId: z.string(),
  email: z.string().nullable(),
  name: z.string(),
  role: z.enum(["bartender", "admin", "onza"]),
  mustChangePassword: z.boolean(),
  self: z.boolean(),
});
export type TeamMember = z.infer<typeof teamMemberSchema>;

export const teamCommandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    venueId: z.string().uuid(),
    email: z.string().trim().toLowerCase().email().max(254),
    name: z.string().trim().min(2).max(100),
    role: z.enum(["bartender", "admin"]),
  }),
  z.object({
    action: z.literal("role"),
    venueId: z.string().uuid(),
    userId: z.string().uuid(),
    role: z.enum(["bartender", "admin"]),
  }),
  z.object({
    action: z.literal("revoke"),
    venueId: z.string().uuid(),
    userId: z.string().uuid(),
  }),
]);
export type TeamCommand = z.infer<typeof teamCommandSchema>;

/** 12 caracteres sin ambigüedades (sin 0/O/1/I/L) en tres grupos: se entrega en mano y se cambia en el primer ingreso. */
export function temporaryPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const group = () =>
    Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}

export async function listTeam(venueId: string) {
  const { db } = await requireVenue(venueId, true);
  const { data, error } = await db.rpc("list_venue_team", { venue: venueId });
  if (error) throw new Error(error.message);
  return z.array(teamMemberSchema).parse(data);
}

/**
 * Los permisos se comprueban dos veces: aquí con la sesión de quien llama (administrador de ese local) y otra vez dentro de
 * la base. Solo el alta usa service_role; cambiar permiso y quitar acceso corren como la propia persona administradora.
 */
export async function executeTeamCommand(raw: unknown) {
  const command = teamCommandSchema.parse(raw);
  const { db, user } = await requireVenue(command.venueId, true);
  if (command.action === "role") {
    const { error } = await db.rpc("team_set_role", {
      venue: command.venueId,
      member: command.userId,
      new_role: command.role,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  }
  if (command.action === "revoke") {
    const { data, error } = await db.rpc("team_revoke", {
      venue: command.venueId,
      member: command.userId,
    });
    if (error) throw new Error(error.message);
    return data;
  }
  const admin = adminDb();
  const { data: found } = await admin.rpc("team_lookup_email", {
    lookup: command.email,
  });
  const lookup = found as { id?: string; kind: "none" | "staff" | "customer" };
  // Correo de una cuenta personal: nunca se convierte ni se vincula (regla R1.3).
  if (lookup.kind === "customer") throw new Error("CUSTOMER_EMAIL");
  let memberId = lookup.id;
  let password: string | null = null;
  if (lookup.kind === "none") {
    password = temporaryPassword();
    const { data, error } = await admin.auth.admin.createUser({
      email: command.email,
      password,
      // Sin correo de confirmación ni de invitación: el SMTP integrado no alcanza para esto.
      email_confirm: true,
      user_metadata: { full_name: command.name, account_kind: "staff" },
    });
    if (error || !data.user) {
      // Alguien pudo registrar ese correo entre la consulta y la alta: se vuelve a decidir con el estado real.
      const again = (
        await admin.rpc("team_lookup_email", { lookup: command.email })
      ).data as { kind: string };
      throw new Error(again?.kind === "customer" ? "CUSTOMER_EMAIL" : "INVALID_EMAIL");
    }
    memberId = data.user.id;
  }
  if (!memberId) throw new Error("INVALID_EMAIL");
  const { error } = await admin.rpc("team_attach", {
    venue: command.venueId,
    member: memberId,
    member_name: command.name,
    member_role: command.role,
    actor: user.id,
    fresh: lookup.kind === "none",
  });
  if (error) {
    // Si el alta no pudo completarse, no queda una cuenta nueva huérfana.
    if (lookup.kind === "none") await admin.auth.admin.deleteUser(memberId);
    throw new Error(error.message);
  }
  return { ok: true, password, existing: lookup.kind === "staff" };
}

/**
 * Cambio obligatorio de la contraseña temporal. Se cambia con la sesión de la persona (Auth exige que sea distinta) y
 * recién entonces la ruta de servidor cierra la marca; el navegador no puede cerrarla por su cuenta.
 */
export async function changeTemporaryPassword(password: string) {
  if (password.length < 10) throw new Error("WEAK_PASSWORD");
  const db = await serverDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user || user.is_anonymous) throw new Error("SESSION_REQUIRED");
  const { error } = await db.auth.updateUser({ password });
  if (error) {
    if (/different|same/i.test(error.message)) throw new Error("SAME_PASSWORD");
    if (/weak|short|least/i.test(error.message)) throw new Error("WEAK_PASSWORD");
    throw new Error("CONNECTION_ERROR");
  }
  const { error: closeError } = await adminDb().rpc("complete_password_change", {
    member: user.id,
  });
  if (closeError) throw new Error("CONNECTION_ERROR");
  return { ok: true };
}
