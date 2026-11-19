import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { actor, database, ids, installStorageStub } from "./helpers";

async function withProfiles() {
  const db = await database();
  await db.exec(
    `insert into public.profiles(user_id,full_name,username,phone_country,phone_e164,birth_date,terms_version,privacy_version,terms_accepted_at) values
     ('${ids.customer}','Ana Cliente','anac','+506','+50688887777','1995-05-05','v1','v1',now()),
     ('${ids.other}','Otro Cliente','otroc','+506','+50688887778','1995-05-05','v1','v1',now())`,
  );
  return db;
}
const setAvatar = (db: PGlite, path: string | null) =>
  db.query<{ r: Record<string, unknown> }>(
    "select public.update_profile_avatar($1) as r",
    [path],
  );

describe("avatar de la cuenta personal", () => {
  it("fija y quita la foto propia; devuelve la anterior para limpiarla", async () => {
    const db = await withProfiles();
    try {
      await actor(db, ids.customer, "phone", false);
      const path = `${ids.customer}/avatar-abc123.webp`;
      expect((await setAvatar(db, path)).rows[0].r).toEqual({
        avatarPath: path,
        previousPath: null,
      });
      expect((await setAvatar(db, null)).rows[0].r).toEqual({
        avatarPath: null,
        previousPath: path,
      });
    } finally {
      await db.close();
    }
  });

  it("rechaza caminos ajenos o con otro formato, invitados y personal sin perfil", async () => {
    const db = await withProfiles();
    try {
      await actor(db, ids.customer, "phone", false);
      await expect(
        setAvatar(db, `${ids.other}/avatar-abc.webp`),
      ).rejects.toThrow("INVALID_AVATAR");
      await expect(
        setAvatar(db, `${ids.customer}/../x/avatar-abc.webp`),
      ).rejects.toThrow("INVALID_AVATAR");
      await expect(
        setAvatar(db, `${ids.customer}/avatar-abc.svg`),
      ).rejects.toThrow("INVALID_AVATAR");
      await actor(db, ids.customer, "phone", true);
      await expect(setAvatar(db, null)).rejects.toThrow("NOT_AUTHORIZED");
      await actor(db, ids.staff, "bar", false);
      await expect(setAvatar(db, null)).rejects.toThrow("PROFILE_REQUIRED");
    } finally {
      await db.close();
    }
  });

  it("bucket privado: cada persona lee y escribe solo su carpeta", async () => {
    const db = await withProfiles();
    try {
      await installStorageStub(db);
      await db.exec(
        readFileSync(
          "supabase/migrations/202611190015_avatars_storage.sql",
          "utf8",
        ),
      );
      const insert = (name: string) =>
        db.query("insert into storage.objects(bucket_id,name) values('avatars',$1)", [name]);
      await actor(db, ids.customer, "phone", false);
      await insert(`${ids.customer}/avatar-1.jpg`);
      await expect(insert(`${ids.other}/avatar-1.jpg`)).rejects.toThrow();
      await expect(insert(`${ids.customer}/x/avatar-1.jpg`)).rejects.toThrow();
      await expect(insert(`${ids.customer}/foto.jpg`)).rejects.toThrow();
      expect(
        (await db.query("select name from storage.objects where bucket_id='avatars'")).rows,
      ).toHaveLength(1);
      await actor(db, ids.other, "phone-2", false);
      expect(
        (await db.query("select name from storage.objects where bucket_id='avatars'")).rows,
      ).toHaveLength(0);
      await actor(db, ids.admin, "admin", false);
      expect(
        (await db.query("select name from storage.objects where bucket_id='avatars'")).rows,
      ).toHaveLength(0);
      await db.exec("reset role");
      const { rows } = await db.query<{ public: boolean }>(
        "select public from storage.buckets where id='avatars'",
      );
      expect(rows[0].public).toBe(false);
    } finally {
      await db.close();
    }
  });
});
