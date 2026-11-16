import { describe, it, expect } from "vitest";
import {
  seedProductImages,
  demoProductImageUrl,
  drinkTypeByName,
} from "../../scripts/lib/product-images-seed.mjs";

// Fake of the small part of supabase-js the seed uses. It validates the logic (idempotency, not clobbering admin images,
// per-venue folders, failure messages) but is NOT Supabase: the real run against onza-dev is a separate manual step.
type Row = {
  id: string;
  venue_id: string;
  name: string;
  image_url: string | null;
};
function fakeClient(
  rows: Row[],
  options: { bucket?: boolean; readError?: boolean } = {},
) {
  const objects = new Map<string, { contentType: string; size: number }>();
  const calls = { uploads: 0, updates: 0 };
  return {
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
        order: () => ({
          order: async () =>
            options.readError
              ? {
                  data: null,
                  error: { message: 'column "image_url" does not exist' },
                }
              : { data: rows.map((r) => ({ ...r })), error: null },
        }),
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
}
const base = "https://demo.supabase.co";
const A = "20000000-0000-4000-8000-000000000001";
const B = "20000000-0000-4000-8000-000000000002";
const fresh = (): Row[] =>
  [A, B].flatMap((venue, v) =>
    [
      "Paloma",
      "Negroni",
      "Gin tonic",
      "Margarita",
      "Cerveza",
      "Soda cítrica",
    ].map((name, i) => ({
      id: `p${v}${i}`,
      venue_id: venue,
      name,
      image_url: null,
    })),
  );
const readAsset = (type: string) =>
  type === "sin-arte" ? null : { body: Buffer.from([1, 2, 3]) };
const run = (db: ReturnType<typeof fakeClient>) =>
  seedProductImages({ db, supabaseUrl: base, readAsset, log: () => undefined });

describe("seed de imágenes de tragos demo", () => {
  it("asigna una ilustración a cada trago demo, en la carpeta de su propio local", async () => {
    const db = fakeClient(fresh());
    const summary = await run(db);
    expect(summary).toMatchObject({ updated: 12, skipped: 0, kept: 0 });
    // 4 tipos distintos usados (highball, cocktail, beer, soft) × 2 locales; los tragos del mismo tipo comparten archivo.
    expect(db.objects.size).toBe(8);
    for (const row of db.rows) {
      const type =
        drinkTypeByName[
          row.name.toLocaleLowerCase("es-CR") as keyof typeof drinkTypeByName
        ];
      expect(row.image_url).toBe(demoProductImageUrl(base, row.venue_id, type));
      expect(db.objects.has(`${row.venue_id}/product-demo-${type}.png`)).toBe(
        true,
      );
    }
    expect(
      [...db.objects.values()].every((o) => o.contentType === "image/png"),
    ).toBe(true);
    // La URL cumple el patrón que exige update_product_image y las políticas de Storage.
    expect(db.rows[0].image_url).toMatch(
      new RegExp(
        `^https://[^/]+/storage/v1/object/public/venue-images/${A}/product-[A-Za-z0-9._-]+\\.png$`,
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

  it("no pisa imágenes que eligió el admin", async () => {
    const rows = fresh();
    const custom = `${base}/storage/v1/object/public/venue-images/${A}/product-propia.webp`;
    rows[0].image_url = custom;
    const db = fakeClient(rows);
    const summary = await run(db);
    expect(db.rows[0].image_url).toBe(custom);
    expect(summary.kept).toBe(1);
    expect(db.rows[1].image_url).not.toBeNull();
  });

  it("omite tragos sin ilustración asignada y falla con mensaje claro si falta el bucket o la columna", async () => {
    const db = fakeClient([
      ...fresh(),
      { id: "x", venue_id: A, name: "Trago nuevo del bar", image_url: null },
    ]);
    const summary = await run(db);
    expect(summary.skipped).toBe(1);
    expect(db.rows.at(-1)!.image_url).toBeNull();
    await expect(run(fakeClient(fresh(), { bucket: false }))).rejects.toThrow(
      /migración 202611160006/,
    );
    await expect(run(fakeClient(fresh(), { readError: true }))).rejects.toThrow(
      /migración 202611160007/,
    );
  });

  it("omite un tipo si falta su archivo de ilustración", async () => {
    const db = fakeClient(fresh().slice(0, 1));
    const summary = await seedProductImages({
      db,
      supabaseUrl: base,
      readAsset: () => null,
      log: () => undefined,
    });
    expect(summary.skipped).toBe(1);
    expect(db.objects.size).toBe(0);
  });
});
