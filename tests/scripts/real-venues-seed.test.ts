import { describe, it, expect } from "vitest";
import {
  seedRealVenues,
  stableId,
  verifiedCoordinates,
  approvedAsset,
  FICTIONAL_SLUGS,
} from "../../scripts/lib/real-venues-seed.mjs";
import fixture from "../../fixtures/real-venues.json";

// Fake mínimo del cliente de Supabase que usa el seed. Valida la lógica (idempotencia, no pisar ediciones, sin datos
// inventados); NO es Supabase: la ejecución real contra onza-dev es un paso manual aparte.
type Row = Record<string, unknown> & { id: string };
function fakeDb(seedVenues: Row[] = []) {
  const tables: Record<string, Row[]> = {
    venues: seedVenues,
    categories: [],
    products: [],
  };
  const query = (table: string) => {
    let rows = tables[table];
    let patch: Record<string, unknown> | null = null;
    const api = {
      select: () => api,
      limit: () => Promise.resolve({ data: rows.slice(0, 1), error: null }),
      eq(column: string, value: unknown) {
        rows = rows.filter((r) => r[column] === value);
        return api;
      },
      in(column: string, values: unknown[]) {
        rows = rows.filter((r) => values.includes(r[column]));
        return api;
      },
      maybeSingle: () =>
        Promise.resolve({ data: rows[0] ?? null, error: null }),
      single: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      insert(row: Row) {
        tables[table].push({ ...row });
        return Promise.resolve({ error: null });
      },
      update(values: Record<string, unknown>) {
        patch = values;
        return api;
      },
      upsert(row: Row) {
        if (!tables[table].some((r) => r.id === row.id))
          tables[table].push({ ...row });
        return Promise.resolve({ error: null });
      },
      then(resolve: (value: unknown) => void) {
        if (patch) rows.forEach((r) => Object.assign(r, patch));
        resolve({ data: rows.map((r) => ({ id: r.id })), error: null });
      },
    };
    return api;
  };
  return { tables, from: query };
}
const noSources = {
  assets: [] as {
    venue: string;
    kind: string;
    file: string;
    source_url: string;
    license: string;
  }[],
};
const run = (
  db: ReturnType<typeof fakeDb>,
  sources = noSources,
  assetExists = () => false,
) =>
  seedRealVenues({ db, fixture, sources, assetExists, log: () => undefined });

describe("seed de locales reales", () => {
  it("crea los cinco locales con menús simulados y no inventa coordenadas ni imágenes", async () => {
    const db = fakeDb();
    const summary = await run(db);
    expect(summary.venues).toBe(5);
    expect(db.tables.venues.map((v) => v.slug).sort()).toEqual([
      "apotecario",
      "mil948",
      "otro-bar",
      "stiefel-pub",
      "wilk",
    ]);
    for (const v of db.tables.venues) {
      expect(v.latitude).toBeNull();
      expect(v.longitude).toBeNull();
      expect(v.cover_url).toBeNull();
      expect(v.logo_url).toBeNull();
      expect(v.demo_listed).toBe(true);
    }
    expect(db.tables.products.length).toBeGreaterThan(15);
    expect(
      db.tables.products.every((p) => (p.price_minor as number) % 100 === 0),
    ).toBe(true);
  });
  it("es idempotente: correrlo dos veces no duplica nada", async () => {
    const db = fakeDb();
    await run(db);
    const counts = Object.fromEntries(
      Object.entries(db.tables).map(([k, v]) => [k, v.length]),
    );
    const second = await run(db);
    expect(second.venues).toBe(0);
    expect(
      Object.fromEntries(
        Object.entries(db.tables).map(([k, v]) => [k, v.length]),
      ),
    ).toEqual(counts);
  });
  it("no pisa lo que ya editó un administrador", async () => {
    const db = fakeDb();
    await run(db);
    const mil = db.tables.venues.find((v) => v.slug === "mil948")!;
    mil.name = "Mil948 (editado)";
    mil.cover_url = "/propia.jpg";
    await run(
      db,
      {
        assets: [
          {
            venue: "mil948",
            kind: "cover",
            file: "x.jpg",
            source_url: "https://e.x",
            license: "CC",
          },
        ],
      },
      () => true,
    );
    expect(mil.name).toBe("Mil948 (editado)");
    expect(mil.cover_url).toBe("/propia.jpg");
  });
  it("oculta los locales ficticios sin borrarlos", async () => {
    const db = fakeDb(
      FICTIONAL_SLUGS.map((slug, i) => ({
        id: `f${i}`,
        slug,
        demo_listed: true,
      })),
    );
    const summary = await run(db);
    expect(summary.hidden).toBe(3);
    const fictional = db.tables.venues.filter((v) =>
      FICTIONAL_SLUGS.includes(v.slug as string),
    );
    expect(fictional).toHaveLength(3);
    expect(fictional.every((v) => v.demo_listed === false)).toBe(true);
  });
  it("las imágenes solo se usan con archivo, fuente y licencia; las coordenadas, con fuente y fecha", () => {
    const sources = {
      assets: [
        {
          venue: "wilk",
          kind: "cover",
          file: "wilk-cover.jpg",
          source_url: "https://commons.example/x",
          license: "CC BY 4.0",
        },
        {
          venue: "wilk",
          kind: "logo",
          file: "wilk-logo.png",
          source_url: "",
          license: "",
        },
      ],
    };
    expect(approvedAsset(sources, "wilk", "cover", () => true)).toBe(
      "/demo-venues/real/wilk-cover.jpg",
    );
    expect(approvedAsset(sources, "wilk", "cover", () => false)).toBeNull();
    expect(approvedAsset(sources, "wilk", "logo", () => true)).toBeNull();
    expect(approvedAsset(sources, "mil948", "cover", () => true)).toBeNull();
    expect(
      verifiedCoordinates({
        coordinates: { latitude: 9.93, longitude: -84.06 },
      }),
    ).toEqual({ latitude: null, longitude: null });
    expect(
      verifiedCoordinates({
        coordinates: {
          latitude: 9.93,
          longitude: -84.06,
          source: "https://osm.example/n/1",
          verified_on: "2026-11-17",
        },
      }),
    ).toEqual({ latitude: 9.93, longitude: -84.06 });
  });
  it("los identificadores son estables", () => {
    expect(stableId("a", "b")).toBe(stableId("a", "b"));
    expect(stableId("a", "b")).not.toBe(stableId("a", "c"));
    expect(stableId("a", "b")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
