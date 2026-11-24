import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { actor, database, ids, installStorageStub } from "./helpers";

const adminPatio = "10000000-0000-4000-8000-000000000005";
async function setup() {
  const db = await database();
  await db.exec(
    `insert into auth.users values('${adminPatio}');insert into public.memberships(user_id,venue_id,role) values('${adminPatio}','${ids.patio}','admin')`,
  );
  await installStorageStub(db);
  await db.exec("reset role");
  // Migración REAL del bucket de planos.
  await db.exec(
    readFileSync(
      "supabase/migrations/202611240026_venue_maps_storage.sql",
      "utf8",
    ),
  );
  return db;
}
const insert = (db: PGlite, name: string) =>
  db.query(
    "insert into storage.objects(bucket_id,name) values('venue-maps',$1)",
    [name],
  );

describe("bucket de planos", () => {
  it("solo el administrador del local sube a su carpeta, con extensión de imagen", async () => {
    const db = await setup();
    try {
      await actor(db, ids.admin, "admin-device", false);
      for (const ext of ["webp", "png", "jpg", "jpeg", "svg"])
        await insert(db, `${ids.venue}/${crypto.randomUUID()}.${ext}`);
      await expect(insert(db, `${ids.venue}/plano.gif`)).rejects.toThrow(
        /row-level security/,
      );
      await expect(insert(db, `${ids.venue}/sub/plano.webp`)).rejects.toThrow(
        /row-level security/,
      );
      await expect(insert(db, `${ids.patio}/plano.webp`)).rejects.toThrow(
        /row-level security/,
      ); // carpeta de otro local
      await expect(insert(db, `no-es-uuid/plano.webp`)).rejects.toThrow(
        /row-level security/,
      );
      await actor(db, ids.staff, "bar-device", false);
      await expect(
        insert(db, `${ids.venue}/${crypto.randomUUID()}.webp`),
      ).rejects.toThrow(/row-level security/); // personal sin administración
      await actor(db);
      await expect(
        insert(db, `${ids.venue}/${crypto.randomUUID()}.webp`),
      ).rejects.toThrow(/row-level security/); // cliente
      await actor(db, adminPatio, "patio-admin", false);
      await expect(
        insert(db, `${ids.venue}/${crypto.randomUUID()}.webp`),
      ).rejects.toThrow(/row-level security/);
      await insert(db, `${ids.patio}/${crypto.randomUUID()}.webp`);
    } finally {
      await db.close();
    }
  });

  it("no se sobrescribe ningún objeto y una imagen usada por una versión publicada no se borra", async () => {
    const db = await setup();
    try {
      const used = `${ids.venue}/${crypto.randomUUID()}.webp`;
      const spare = `${ids.venue}/${crypto.randomUUID()}.webp`;
      await actor(db, ids.admin, "admin-device", false);
      await insert(db, used);
      await insert(db, spare);
      const created = (
        await db.query<{ r: { id: string; draft_revision: number } }>(
          "select public.map_create($1::jsonb) as r",
          [JSON.stringify({ venueId: ids.venue, name: "Planta" })],
        )
      ).rows[0].r;
      await db.query("select public.map_save_draft($1::jsonb)", [
        JSON.stringify({
          mapId: created.id,
          expectedRevision: 1,
          imagePath: used,
          imageWidth: 800,
          imageHeight: 600,
          layout: { elements: [], zones: [] },
        }),
      ]);
      await db.query("select public.map_publish($1::jsonb)", [
        JSON.stringify({ mapId: created.id, expectedRevision: 2 }),
      ]);
      // update: no existe política → no cambia ninguna fila
      await db.query(
        "update storage.objects set name=name||'x' where bucket_id='venue-maps'",
      );
      await db.exec("reset role");
      expect(
        (
          await db.query(
            "select count(*)::int as n from storage.objects where name like '%x'",
          )
        ).rows[0],
      ).toEqual({ n: 0 });
      await actor(db, ids.admin, "admin-device", false);
      await db.query("delete from storage.objects where name=$1", [used]); // en uso: la política lo filtra
      await db.query("delete from storage.objects where name=$1", [spare]); // sin uso: se borra
      await db.exec("reset role");
      const names = (
        await db.query<{ name: string }>(
          "select name from storage.objects order by name",
        )
      ).rows.map((r) => r.name);
      expect(names).toEqual([used]);
    } finally {
      await db.close();
    }
  });
});
