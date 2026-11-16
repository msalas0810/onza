import { describe, it, expect } from "vitest";
import {
  seedVenueImages,
  demoImageUrl,
} from "../../scripts/lib/venue-images-seed.mjs";

// Fake of the small part of supabase-js the seed uses. It validates the logic (idempotency, not clobbering admin
// images, failure messages) but is NOT Supabase: the real run against onza-dev is a separate manual step.
type Row = {
  id: string;
  slug: string;
  cover_url: string | null;
  logo_url: string | null;
};
function fakeClient(
  rows: Row[],
  options: { bucket?: boolean; readError?: boolean } = {},
) {
  const objects = new Map<string, { contentType: string; size: number }>();
  const calls = { uploads: 0, updates: 0 };
  const db = {
    objects,
    calls,
    rows,
    storage: {
      getBucket: async () =>
        options.bucket === false
          ? { data: null, error: { message: "not found" } }
          : { data: { id: "venue-images" }, error: null },
      from: () => ({
        upload: async (
          path: string,
          body: Buffer,
          opts: { contentType: string; upsert: boolean },
        ) => {
          calls.uploads++;
          if (objects.has(path) && !opts.upsert)
            return { error: { message: "exists" } };
          objects.set(path, {
            contentType: opts.contentType,
            size: body.length,
          });
          return { error: null };
        },
      }),
    },
    from: () => ({
      select: () => ({
        order: async () =>
          options.readError
            ? {
                data: null,
                error: { message: 'column "cover_url" does not exist' },
              }
            : { data: rows.map((r) => ({ ...r })), error: null },
      }),
      update: (patch: Partial<Row>) => ({
        eq: async (_column: string, id: string) => {
          calls.updates++;
          Object.assign(
            rows.find((r) => r.id === id)!,
            patch,
          );
          return { error: null };
        },
      }),
    }),
  };
  return db;
}
const base = "https://demo.supabase.co";
const A = "20000000-0000-4000-8000-000000000001";
const B = "20000000-0000-4000-8000-000000000002";
const C = "20000000-0000-4000-8000-000000000003";
const fresh = (): Row[] => [
  { id: A, slug: "sala-norte", cover_url: null, logo_url: null },
  { id: B, slug: "patio-central", cover_url: null, logo_url: null },
  { id: C, slug: "club-cero", cover_url: null, logo_url: null },
];
const readAsset = (slug: string) =>
  slug === "sin-arte" ? null : { body: Buffer.from([1, 2, 3, 4]) };
const run = (db: ReturnType<typeof fakeClient>) =>
  seedVenueImages({ db, supabaseUrl: base, readAsset, log: () => undefined });

describe("seed de imágenes demo", () => {
  it("sube portada y logo de todos los locales y guarda las URLs públicas", async () => {
    const db = fakeClient(fresh());
    const summary = await run(db);
    expect(summary).toMatchObject({ uploaded: 6, updated: 3 });
    expect(db.objects.size).toBe(6);
    expect(db.objects.get(`${A}/cover-demo.jpg`)?.contentType).toBe(
      "image/jpeg",
    );
    expect(db.objects.get(`${A}/logo-demo.png`)?.contentType).toBe("image/png");
    for (const row of db.rows) {
      expect(row.cover_url).toBe(demoImageUrl(base, row.id, "cover"));
      expect(row.logo_url).toBe(demoImageUrl(base, row.id, "logo"));
    }
    // La URL cumple el patrón que exige la función SQL update_venue_branding.
    expect(db.rows[0].cover_url).toMatch(
      new RegExp(
        `^https://[^/]+/storage/v1/object/public/venue-images/${A}/[A-Za-z0-9._-]+\\.(jpg|png|webp)$`,
      ),
    );
  });

  it("es idempotente: una segunda ejecución no cambia datos ni duplica objetos", async () => {
    const db = fakeClient(fresh());
    await run(db);
    const snapshot = JSON.stringify(db.rows);
    const objects = [...db.objects.keys()].sort();
    db.calls.updates = 0;
    const second = await run(db);
    expect(JSON.stringify(db.rows)).toBe(snapshot);
    expect([...db.objects.keys()].sort()).toEqual(objects);
    expect(db.calls.updates).toBe(0);
    expect(second.updated).toBe(0);
  });

  it("no pisa imágenes subidas por el admin del local", async () => {
    const rows = fresh();
    const custom = `${base}/storage/v1/object/public/venue-images/${A}/cover-propia.webp`;
    rows[0].cover_url = custom;
    const db = fakeClient(rows);
    const summary = await run(db);
    expect(db.rows[0].cover_url).toBe(custom);
    expect(db.objects.has(`${A}/cover-demo.jpg`)).toBe(false);
    expect(db.rows[0].logo_url).toBe(demoImageUrl(base, A, "logo"));
    expect(summary.kept).toBe(1);
  });

  it("omite los locales sin arte y falla con un mensaje claro si falta el bucket o la columna", async () => {
    const rows = [
      ...fresh(),
      { id: "x", slug: "sin-arte", cover_url: null, logo_url: null },
    ];
    const db = fakeClient(rows);
    const summary = await run(db);
    expect(summary.skipped).toBe(2);
    expect(db.rows[3]).toMatchObject({ cover_url: null, logo_url: null });
    await expect(run(fakeClient(fresh(), { bucket: false }))).rejects.toThrow(
      /migración 202611160006/,
    );
    await expect(run(fakeClient(fresh(), { readError: true }))).rejects.toThrow(
      /migración 202611160005/,
    );
  });
});
