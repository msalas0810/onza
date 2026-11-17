import "server-only";
import type { User } from "@supabase/supabase-js";
import { requireVenue } from "@/lib/supabase/guards";
import { errorCode } from "@/lib/errors";
import type { Venue } from "@/features/catalog/server/queries";
import type { serverDb } from "@/lib/supabase/server";

export type StaffRole = "admin" | "bartender" | "onza";
export type StaffPerson = {
  name: string;
  email: string | null;
  role: StaffRole;
};
export type StaffContext =
  | {
      ok: true;
      db: Awaited<ReturnType<typeof serverDb>>;
      user: User;
      venue: Venue;
      person: StaffPerson;
      venueCount: number;
    }
  | {
      ok: false;
      reason: "login" | "password" | "denied" | "error";
      error?: unknown;
    };

export const roleLabel = (role: StaffRole) =>
  role === "admin" ? "Administrador" : role === "onza" ? "Onza" : "Empleado";

/** Quién es la persona del equipo y qué rol tiene en este local. El nombre nunca incluye datos de clientes. */
export async function personFor(
  db: Awaited<ReturnType<typeof serverDb>>,
  user: User,
  venueId?: string,
) {
  const [{ data: account }, { data: memberships }] = await Promise.all([
    db.from("staff_accounts").select("display_name").maybeSingle(),
    db.from("memberships").select("venue_id,role"),
  ]);
  const meta = user.user_metadata as { full_name?: string } | undefined;
  const role = (memberships?.find((m) => m.venue_id === venueId)?.role ??
    "onza") as StaffRole;
  return {
    person: {
      name:
        account?.display_name ??
        meta?.full_name ??
        user.email?.split("@")[0] ??
        "Equipo",
      email: user.email ?? null,
      role,
    } satisfies StaffPerson,
    venueCount: memberships?.length ?? 0,
  };
}

/** Autoriza una pantalla del equipo y devuelve lo necesario para pintarla, o el motivo por el que no se puede. */
export async function loadStaffContext(
  venueId: string,
  adminOnly = false,
): Promise<StaffContext> {
  try {
    const { db, user } = await requireVenue(venueId, adminOnly);
    const { data: venue, error } = await db
      .from("venues")
      .select("*")
      .eq("id", venueId)
      .single();
    if (error) throw error;
    const { person, venueCount } = await personFor(db, user, venueId);
    return { ok: true, db, user, venue, person, venueCount };
  } catch (error) {
    const code = errorCode(error);
    if (code === "SESSION_REQUIRED") return { ok: false, reason: "login" };
    if (code === "PASSWORD_CHANGE_REQUIRED")
      return { ok: false, reason: "password" };
    if (code === "NOT_AUTHORIZED" || code === "RESOURCE_NOT_FOUND")
      return { ok: false, reason: "denied" };
    return { ok: false, reason: "error", error };
  }
}
