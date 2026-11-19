import type { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { actor, database, ids } from "./helpers";

async function withProfiles() {
  const db = await database();
  await db.exec(
    `insert into public.profiles(user_id,full_name,username,phone_country,phone_e164,birth_date,terms_version,privacy_version,terms_accepted_at) values
     ('${ids.customer}','Ana Cliente','anac','+506','+50688887777','1995-05-05','v1','v1',now()),
     ('${ids.other}','Otro Cliente','otroc','+506','+50688887778','1995-05-05','v1','v1',now())`,
  );
  return db;
}
const edit = (
  db: PGlite,
  name: string,
  username: string,
  drink: string | null = null,
) =>
  db.query<{ r: Record<string, unknown> }>(
    "select public.update_profile_details($1,$2,$3) as r",
    [name, username, drink],
  );

describe("edición de nombre y @usuario", () => {
  it("guarda con las reglas del alta y no toca teléfono ni fecha", async () => {
    const db = await withProfiles();
    try {
      await actor(db, ids.customer, "phone", false);
      expect((await edit(db, "  Ana María  ", "Ana.M_1")).rows[0].r).toEqual({
        fullName: "Ana María",
        username: "ana.m_1",
        favoriteDrink: null,
      });
      // Trago favorito opcional: se guarda recortado y vacío lo quita.
      expect(
        (await edit(db, "Ana María", "ana.m_1", "  Negroni ")).rows[0].r,
      ).toMatchObject({ favoriteDrink: "Negroni" });
      expect(
        (await edit(db, "Ana María", "ana.m_1", "   ")).rows[0].r,
      ).toMatchObject({ favoriteDrink: null });
      await expect(
        edit(db, "Ana María", "ana.m_1", "x".repeat(61)),
      ).rejects.toThrow();
      const row = (
        await db.query<{
          full_name: string;
          username: string;
          phone_e164: string;
        }>(
          `select full_name,username,phone_e164 from public.profiles where user_id='${ids.customer}'`,
        )
      ).rows[0];
      expect(row).toEqual({
        full_name: "Ana María",
        username: "ana.m_1",
        phone_e164: "+50688887777",
      });
      // Conservar el propio @usuario no choca consigo mismo.
      await expect(edit(db, "Ana M.", "ana.m_1")).resolves.toBeDefined();
    } finally {
      await db.close();
    }
  });

  it("rechaza @usuario ajeno (sin distinguir mayúsculas), formatos inválidos, invitados y cuentas sin perfil", async () => {
    const db = await withProfiles();
    try {
      await actor(db, ids.customer, "phone", false);
      await expect(edit(db, "Ana", "OTROC")).rejects.toThrow("USERNAME_TAKEN");
      await expect(edit(db, "A", "anac")).rejects.toThrow("INVALID_NAME");
      await expect(edit(db, "Ana", "no válido!")).rejects.toThrow(
        "INVALID_USERNAME",
      );
      await expect(edit(db, "Ana", "ab")).rejects.toThrow("INVALID_USERNAME");
      await actor(db, ids.customer, "phone", true);
      await expect(edit(db, "Ana", "anac")).rejects.toThrow("NOT_AUTHORIZED");
      await actor(db, ids.staff, "phone", false);
      await expect(edit(db, "Ana", "nuevo")).rejects.toThrow(
        "PROFILE_REQUIRED",
      );
    } finally {
      await db.close();
    }
  });
});
