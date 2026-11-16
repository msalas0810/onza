import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { it, expect, describe } from "vitest";
import { database, actor, ids } from "./helpers";

const adminPatio = "10000000-0000-4000-8000-000000000005";
const base = "https://demo.supabase.co/storage/v1/object/public/venue-images";
const own = (venue: string, file = "cover-1.jpg") => `${base}/${venue}/${file}`;

async function branding(db: PGlite, input: Record<string, unknown>) {
  const result = await db.query<{ result: Record<string, unknown> }>(
    "select public.update_venue_branding($1::jsonb) as result",
    [JSON.stringify(input)],
  );
  return result.rows[0].result;
}
async function venueRow(db: PGlite, id: string) {
  await db.exec("reset role");
  const { rows } = await db.query<{
    name: string;
    zone: string;
    cover_url: string | null;
    logo_url: string | null;
  }>("select name,zone,cover_url,logo_url from public.venues where id=$1", [
    id,
  ]);
  return rows[0];
}
async function withVenues() {
  const db = await database();
  await db.exec(
    `insert into auth.users values('${adminPatio}');insert into public.memberships(user_id,venue_id,role) values('${adminPatio}','${ids.patio}','admin')`,
  );
  return db;
}

describe("branding de locales (columnas y función)", () => {
  it("el admin del local cambia portada, logo, nombre y ubicación; el público lo lee", async () => {
    const db = await withVenues();
    try {
      await actor(db, ids.admin, "admin-device", false);
      const result = await branding(db, {
        venueId: ids.venue,
        name: "  Sala Norte Nueva  ",
        zone: "Escazú",
        coverUrl: own(ids.venue),
        logoUrl: own(ids.venue, "logo-1.png"),
      });
      expect(result).toMatchObject({
        name: "Sala Norte Nueva",
        zone: "Escazú",
        cover_url: own(ids.venue),
        logo_url: own(ids.venue, "logo-1.png"),
      });
      await db.exec("reset role");
      await db.exec(
        "select set_config('request.jwt.claims','',false);set role anon",
      );
      const { rows } = await db.query<{ cover_url: string }>(
        `select cover_url from public.venues where id='${ids.venue}'`,
      );
      expect(rows[0].cover_url).toBe(own(ids.venue));
    } finally {
      await db.close();
    }
  });

  it("las claves ausentes no cambian nada y null borra la imagen", async () => {
    const db = await withVenues();
    try {
      await actor(db, ids.admin, "admin-device", false);
      await branding(db, {
        venueId: ids.venue,
        coverUrl: own(ids.venue),
        logoUrl: own(ids.venue, "logo-1.png"),
      });
      await branding(db, { venueId: ids.venue, zone: "Heredia" });
      let row = await venueRow(db, ids.venue);
      expect(row).toMatchObject({
        name: "Sala Norte",
        zone: "Heredia",
        cover_url: own(ids.venue),
        logo_url: own(ids.venue, "logo-1.png"),
      });
      await actor(db, ids.admin, "admin-device", false);
      await branding(db, { venueId: ids.venue, coverUrl: null });
      row = await venueRow(db, ids.venue);
      expect(row.cover_url).toBeNull();
      expect(row.logo_url).toBe(own(ids.venue, "logo-1.png"));
    } finally {
      await db.close();
    }
  });

  it("un admin no cambia las imágenes ni el nombre de otro local (en ambos sentidos)", async () => {
    const db = await withVenues();
    try {
      await actor(db, ids.admin, "admin-device", false);
      await expect(
        branding(db, {
          venueId: ids.patio,
          coverUrl: own(ids.patio),
          name: "Robado",
        }),
      ).rejects.toThrow("NOT_AUTHORIZED");
      // No puede usar su propia carpeta para apuntar el local ajeno ni al revés.
      await expect(
        branding(db, { venueId: ids.patio, coverUrl: own(ids.venue) }),
      ).rejects.toThrow("NOT_AUTHORIZED");
      await actor(db, adminPatio, "patio-device", false);
      await expect(
        branding(db, { venueId: ids.venue, logoUrl: own(ids.venue) }),
      ).rejects.toThrow("NOT_AUTHORIZED");
      const patio = await venueRow(db, ids.patio);
      expect(patio).toMatchObject({
        name: "Patio Central",
        cover_url: null,
        logo_url: null,
      });
      const norte = await venueRow(db, ids.venue);
      expect(norte).toMatchObject({ cover_url: null, logo_url: null });
    } finally {
      await db.close();
    }
  });

  it("bartender, invitado y sesión sin permisos no pueden cambiar el branding", async () => {
    const db = await withVenues();
    try {
      await actor(db, ids.staff, "bar-device", false);
      await expect(
        branding(db, { venueId: ids.venue, coverUrl: own(ids.venue) }),
      ).rejects.toThrow("NOT_AUTHORIZED");
      await actor(db, ids.customer, "guest-device", true);
      await expect(
        branding(db, { venueId: ids.venue, name: "Invitado" }),
      ).rejects.toThrow("NOT_AUTHORIZED");
      await db.exec("reset role");
      await db.exec(
        "select set_config('request.jwt.claims','',false);set role anon",
      );
      await expect(
        branding(db, { venueId: ids.venue, name: "Anónimo" }),
      ).rejects.toThrow();
      expect((await venueRow(db, ids.venue)).name).toBe("Sala Norte");
    } finally {
      await db.close();
    }
  });

  it("el admin tampoco puede escribir la tabla directamente", async () => {
    const db = await withVenues();
    try {
      await actor(db, ids.admin, "admin-device", false);
      await expect(
        db.query(
          `update public.venues set cover_url='https://evil.example/x.png' where id='${ids.venue}'`,
        ),
      ).rejects.toThrow(/permission denied/);
      expect((await venueRow(db, ids.venue)).cover_url).toBeNull();
    } finally {
      await db.close();
    }
  });

  it("rechaza URLs fuera del bucket del propio local, extensiones no permitidas y nombres vacíos", async () => {
    const db = await withVenues();
    try {
      await actor(db, ids.admin, "admin-device", false);
      const invalid = [
        { coverUrl: "https://evil.example/x.png" },
        { coverUrl: `${base}/${ids.patio}/cover.jpg` },
        { coverUrl: `${base}/${ids.venue}/nested/cover.jpg` },
        { coverUrl: own(ids.venue, "cover.svg") },
        { coverUrl: own(ids.venue, "cover.gif") },
        { logoUrl: "javascript:alert(1)" },
        { logoUrl: `${base}/${ids.venue}/..%2F${ids.patio}%2Flogo.png` },
        { logoUrl: 123 },
        { name: "   " },
        { name: "x".repeat(101) },
        { zone: "z".repeat(101) },
      ];
      for (const patch of invalid)
        await expect(
          branding(db, { venueId: ids.venue, ...patch }),
          JSON.stringify(patch),
        ).rejects.toThrow("INVALID_BRANDING");
      await expect(branding(db, { venueId: "no-es-uuid" })).rejects.toThrow(
        "INVALID_BRANDING",
      );
      const row = await venueRow(db, ids.venue);
      expect(row).toMatchObject({
        name: "Sala Norte",
        cover_url: null,
        logo_url: null,
      });
    } finally {
      await db.close();
    }
  });

  it("la ubicación puede quedar vacía (es opcional)", async () => {
    const db = await withVenues();
    try {
      await actor(db, ids.admin, "admin-device", false);
      await branding(db, { venueId: ids.venue, zone: "" });
      expect((await venueRow(db, ids.venue)).zone).toBe("");
    } finally {
      await db.close();
    }
  });
});

// El esquema storage de Supabase no existe en PGlite: se simula lo mínimo (tabla objects con RLS y foldername)
// para ejecutar la migración REAL de políticas. No prueba límites de tamaño ni MIME: eso lo aplica el servicio Storage.
async function withStorage() {
  const db = await withVenues();
  await db.exec(`
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner uuid default auth.uid());
    create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
    grant select on storage.buckets to anon,authenticated;
  `);
  await db.exec(
    readFileSync(
      "supabase/migrations/202611160006_venue_images_storage.sql",
      "utf8",
    ),
  );
  return db;
}
const insertObject = (db: PGlite, name: string, bucket = "venue-images") =>
  db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
    bucket,
    name,
  ]);

describe("bucket venue-images (políticas de Storage)", () => {
  it("crea el bucket público con límite de 2 MB y solo jpg/png/webp", async () => {
    const db = await withStorage();
    try {
      await db.exec("reset role");
      const { rows } = await db.query<{
        public: boolean;
        file_size_limit: string;
        allowed_mime_types: string[];
      }>("select * from storage.buckets where id='venue-images'");
      expect(rows[0].public).toBe(true);
      expect(Number(rows[0].file_size_limit)).toBe(2 * 1024 * 1024);
      expect([...rows[0].allowed_mime_types].sort()).toEqual([
        "image/jpeg",
        "image/png",
        "image/webp",
      ]);
    } finally {
      await db.close();
    }
  });

  it("la migración es idempotente (se puede volver a ejecutar)", async () => {
    const db = await withStorage();
    try {
      await db.exec("reset role");
      await db.exec(
        readFileSync(
          "supabase/migrations/202611160006_venue_images_storage.sql",
          "utf8",
        ),
      );
      const { rows } = await db.query(
        "select policyname from pg_policies where tablename='objects' and policyname like 'venue_image_%'",
      );
      expect(rows).toHaveLength(4);
    } finally {
      await db.close();
    }
  });

  it("el admin sube solo en la carpeta de su local; otro local, anidados, extensiones y carpetas no válidas fallan", async () => {
    const db = await withStorage();
    try {
      await actor(db, ids.admin, "admin-device", false);
      await insertObject(db, `${ids.venue}/cover-1.jpg`);
      await insertObject(db, `${ids.venue}/logo-1.PNG`);
      for (const name of [
        `${ids.patio}/cover-1.jpg`,
        `${ids.venue}/nested/cover-1.jpg`,
        `${ids.venue}/cover-1.svg`,
        `${ids.venue}/cover-1.html`,
        `not-a-uuid/cover-1.jpg`,
        `cover-1.jpg`,
      ])
        await expect(insertObject(db, name), name).rejects.toThrow(
          /row-level security|violates/,
        );
      await expect(
        insertObject(db, `${ids.venue}/cover-2.jpg`, "menu-photos"),
      ).rejects.toThrow();
      await db.exec("reset role");
      const { rows } = await db.query<{ n: number }>(
        "select count(*)::int as n from storage.objects",
      );
      expect(rows[0].n).toBe(2);
    } finally {
      await db.close();
    }
  });

  it("bartender, invitado y anon no pueden escribir; todos pueden leer", async () => {
    const db = await withStorage();
    try {
      await db.exec("reset role");
      await insertObject(db, `${ids.venue}/cover-1.jpg`);
      await actor(db, ids.staff, "bar-device", false);
      await expect(insertObject(db, `${ids.venue}/hack.jpg`)).rejects.toThrow(
        /row-level security/,
      );
      await actor(db, ids.customer, "guest-device", true);
      await expect(insertObject(db, `${ids.venue}/hack.jpg`)).rejects.toThrow(
        /row-level security/,
      );
      await db.exec("reset role");
      await db.exec(
        "select set_config('request.jwt.claims','',false);set role anon",
      );
      await expect(insertObject(db, `${ids.venue}/hack.jpg`)).rejects.toThrow(
        /permission denied|row-level security/,
      );
      const { rows } = await db.query<{ name: string }>(
        "select name from storage.objects",
      );
      expect(rows.map((r) => r.name)).toEqual([`${ids.venue}/cover-1.jpg`]);
    } finally {
      await db.close();
    }
  });

  it("un admin no puede reemplazar ni borrar imágenes de otro local", async () => {
    const db = await withStorage();
    try {
      await db.exec("reset role");
      await insertObject(db, `${ids.patio}/cover-1.jpg`);
      await insertObject(db, `${ids.venue}/cover-1.jpg`);
      await actor(db, ids.admin, "admin-device", false);
      const update = await db.query(
        `update storage.objects set name='${ids.patio}/pwned.jpg' where name='${ids.patio}/cover-1.jpg'`,
      );
      expect(update.affectedRows).toBe(0);
      const move = await db
        .query(
          `update storage.objects set name='${ids.patio}/mine.jpg' where name='${ids.venue}/cover-1.jpg'`,
        )
        .catch((e: Error) => e);
      expect(move).toBeInstanceOf(Error);
      const del = await db.query(
        `delete from storage.objects where name='${ids.patio}/cover-1.jpg'`,
      );
      expect(del.affectedRows).toBe(0);
      const own = await db.query(
        `delete from storage.objects where name='${ids.venue}/cover-1.jpg'`,
      );
      expect(own.affectedRows).toBe(1);
      await db.exec("reset role");
      const { rows } = await db.query<{ name: string }>(
        "select name from storage.objects",
      );
      expect(rows.map((r) => r.name)).toEqual([`${ids.patio}/cover-1.jpg`]);
    } finally {
      await db.close();
    }
  });
});
