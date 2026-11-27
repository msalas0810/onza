import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { database } from "../db/helpers";
import {
  anchorOf,
  hitSpot,
  inServiceArea,
  pointInPoints,
  resolvePlace,
  shapeContains,
  shortLabel,
  type Pt,
  type ShapedSpot,
} from "@/features/delivery/geometry";
import { mapSchema, spotSchema } from "@/features/delivery/types";

const size = { width: 2000, height: 1000 };
const rect = (x1: number, y1: number, x2: number, y2: number): Pt[] => [
  [x1, y1],
  [x2, y1],
  [x2, y2],
  [x1, y2],
];
const spot = (
  id: string,
  label: string,
  shape: ShapedSpot["shape"],
  extra: Partial<ShapedSpot> = {},
): ShapedSpot => ({
  id,
  label,
  area: "",
  position: 0,
  enabled: true,
  shape,
  ...extra,
});

describe("geometría del mapa (relativa a la imagen)", () => {
  it("punto en polígono: dentro, fuera y en forma de L", () => {
    const l: Pt[] = [
      [0.1, 0.1],
      [0.5, 0.1],
      [0.5, 0.4],
      [0.3, 0.4],
      [0.3, 0.8],
      [0.1, 0.8],
    ];
    expect(pointInPoints(l, 0.2, 0.7)).toBe(true);
    expect(pointInPoints(l, 0.4, 0.3)).toBe(true);
    expect(pointInPoints(l, 0.4, 0.7)).toBe(false);
    expect(pointInPoints(l, 0.9, 0.9)).toBe(false);
  });

  it("sin área de servicio vale toda la imagen, pero nunca fuera de ella", () => {
    expect(inServiceArea([], 0.5, 0.5)).toBe(true);
    expect(inServiceArea([], 1.01, 0.5)).toBe(false);
    expect(
      inServiceArea([{ points: rect(0.1, 0.1, 0.4, 0.4) }], 0.5, 0.5),
    ).toBe(false);
    expect(
      inServiceArea(
        [
          { points: rect(0.1, 0.1, 0.4, 0.4) },
          { points: rect(0.5, 0.5, 0.9, 0.9) },
        ],
        0.7,
        0.7,
      ),
    ).toBe(true);
  });

  it("el círculo es redondo en la imagen (corrige el eje vertical por la proporción)", () => {
    const c = { kind: "circle", x: 0.5, y: 0.5, r: 0.05 } as const;
    expect(shapeContains(c, size, 0.5, 0.5 + 0.09)).toBe(true); // 90 px de alto con radio de 100 px
    expect(shapeContains(c, size, 0.5, 0.5 + 0.11)).toBe(false);
    expect(shapeContains(c, size, 0.5 + 0.049, 0.5)).toBe(true);
    expect(shapeContains(c, size, 0.5 + 0.051, 0.5)).toBe(false);
  });

  it("nombra la única mesa que contiene el punto; con dos superpuestas no adivina; sin mesa, la zona más chica", () => {
    const spots = [
      spot(
        "t1",
        "Mesa 1",
        { kind: "circle", x: 0.2, y: 0.3, r: 0.05 },
        { area: "Terraza" },
      ),
      spot("t2", "Mesa 2", { kind: "circle", x: 0.24, y: 0.3, r: 0.05 }),
      spot("zb", "Zona grande", {
        kind: "polygon",
        points: rect(0.5, 0.5, 0.95, 0.95),
      }),
      spot("zs", "Zona chica", {
        kind: "polygon",
        points: rect(0.6, 0.6, 0.7, 0.7),
      }),
      spot(
        "off",
        "Mesa apagada",
        { kind: "circle", x: 0.8, y: 0.8, r: 0.03 },
        { enabled: false },
      ),
      spot("list", "Solo lista", null),
    ];
    expect(resolvePlace(spots, size, 0.16, 0.3)).toEqual({
      spotId: "t1",
      label: "Mesa 1",
      area: "Terraza",
    });
    expect(resolvePlace(spots, size, 0.22, 0.3)).toEqual({
      spotId: null,
      label: null,
      area: "",
    });
    expect(resolvePlace(spots, size, 0.22, 0.3, "t2")).toMatchObject({
      spotId: "t2",
    });
    expect(resolvePlace(spots, size, 0.9, 0.3, "t2")).toBeNull();
    expect(resolvePlace(spots, size, 0.65, 0.65)).toMatchObject({
      spotId: "zs",
      label: "Zona chica",
    });
    expect(resolvePlace(spots, size, 0.9, 0.55)).toMatchObject({
      spotId: "zb",
    });
    expect(resolvePlace(spots, size, 0.8, 0.8)).toMatchObject({ spotId: "zb" }); // la mesa apagada no cuenta
    expect(resolvePlace(spots, size, 0.3, 0.9)).toEqual({
      spotId: null,
      label: null,
      area: "",
    });
    expect(resolvePlace(spots, size, 0.3, 0.9, "list")).toBeNull();
  });

  it("una mesa dentro de una zona sin área propia toma el nombre de la zona", () => {
    const spots = [
      spot("t", "Mesa 3", { kind: "circle", x: 0.7, y: 0.7, r: 0.03 }),
      spot("z", "Jardín", {
        kind: "polygon",
        points: rect(0.5, 0.5, 0.9, 0.9),
      }),
    ];
    expect(resolvePlace(spots, size, 0.7, 0.7)).toEqual({
      spotId: "t",
      label: "Mesa 3",
      area: "Jardín",
    });
  });

  it("el ancla para precargar el pin cae dentro de la forma, también en las cóncavas", () => {
    const l: Pt[] = [
      [0.1, 0.1],
      [0.9, 0.1],
      [0.9, 0.2],
      [0.2, 0.2],
      [0.2, 0.9],
      [0.1, 0.9],
    ];
    for (const shape of [
      { kind: "polygon", points: l } as const,
      { kind: "circle", x: 0.3, y: 0.4, r: 0.04 } as const,
    ]) {
      const at = anchorOf(shape, size);
      expect(shapeContains(shape, size, at.x, at.y)).toBe(true);
    }
  });

  it("para seleccionar en el editor gana la mesa más cercana y, si no, la zona más chica", () => {
    const spots = [
      spot("a", "A", { kind: "circle", x: 0.2, y: 0.3, r: 0.05 }),
      spot(
        "b",
        "B",
        { kind: "circle", x: 0.24, y: 0.3, r: 0.05 },
        { enabled: false },
      ),
      spot("z", "Z", { kind: "polygon", points: rect(0, 0, 1, 1) }),
    ];
    expect(hitSpot(spots, size, 0.23, 0.3)?.id).toBe("b");
    expect(hitSpot(spots, size, 0.9, 0.9)?.id).toBe("z");
  });

  it("etiquetas cortas sobre el plano", () => {
    expect(shortLabel("Mesa 7")).toBe("7");
    expect(shortLabel("VIP 2")).toBe("2");
    expect(shortLabel("Pista de baile")).toBe("Pista de …");
    expect(shortLabel("Barra")).toBe("Barra");
  });
});

describe("la pantalla y la base nombran lo mismo", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await database();
    // Picnic (seed) más dos casos que el seed no tiene: mesas superpuestas y una zona dentro de otra.
    await db.exec(`
      insert into public.delivery_spots(venue_id,label,area,position,shape) values
       ('20000000-0000-4000-8000-000000000004','Mesa 1 bis','',60,'{"kind":"circle","x":0.14,"y":0.21,"r":0.03}'),
       ('20000000-0000-4000-8000-000000000004','Rincón','',61,'{"kind":"polygon","points":[[0.05,0.1],[0.25,0.1],[0.25,0.35],[0.05,0.35]]}'),
       ('20000000-0000-4000-8000-000000000004','Mesa apagada','',62,'{"kind":"circle","x":0.6,"y":0.3,"r":0.04}');
      update public.delivery_spots set enabled=false where label='Mesa apagada';`);
  });
  afterAll(async () => {
    await db?.close();
  });

  it("el mapa de ejemplo de Picnic se lee con el esquema de la app", async () => {
    const m = (
      await db.query<{
        id: string;
        image_url: string;
        width: number;
        height: number;
        service_area: unknown;
      }>(
        `select id,image_url,width,height,service_area from public.venue_maps where venue_id='20000000-0000-4000-8000-000000000004'`,
      )
    ).rows[0];
    expect(
      mapSchema.parse({
        id: m.id,
        imageUrl: m.image_url,
        width: m.width,
        height: m.height,
        serviceArea: m.service_area,
      }).serviceArea,
    ).toHaveLength(3);
    const spots = (
      await db.query(
        `select * from public.delivery_spots where venue_id='20000000-0000-4000-8000-000000000004'`,
      )
    ).rows.map((r) => spotSchema.parse(r));
    // 10 mesas, 2 VIP y la pista: todos los lugares del seed están ubicados en el mapa.
    const seeded = spots.filter((s) => s.position < 60);
    expect(seeded).toHaveLength(13);
    expect(seeded.every((s) => s.shape)).toBe(true);
  });

  it("600 puntos: mismo nombre y misma validez en TypeScript y en la base", async () => {
    const m = (
      await db.query<{
        id: string;
        width: number;
        height: number;
        service_area: { points: Pt[] }[];
      }>(
        `select id,width,height,service_area from public.venue_maps where venue_id='20000000-0000-4000-8000-000000000004'`,
      )
    ).rows[0];
    const spots = (
      await db.query(
        `select * from public.delivery_spots where venue_id='20000000-0000-4000-8000-000000000004'`,
      )
    ).rows.map((r) => spotSchema.parse(r));
    let seed = 12345;
    const next = () =>
      (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    let named = 0;
    let free = 0;
    let outside = 0;
    for (let i = 0; i < 600; i++) {
      const x = Math.round(next() * 1e4) / 1e4;
      const y = Math.round(next() * 1e4) / 1e4;
      const ts = resolvePlace(spots, m, x, y);
      const inside = inServiceArea(m.service_area, x, y);
      const sql = (
        await db.query<{
          p: { spot_id: string | null; label: string | null; area: string };
          ok: boolean;
        }>(
          `select private.resolve_place(m,$1::numeric,$2::numeric,null) p, private.in_service_area(m.service_area,$1::numeric,$2::numeric) ok from public.venue_maps m where m.id=$3`,
          [x, y, m.id],
        )
      ).rows[0];
      expect(
        { spotId: sql.p.spot_id, label: sql.p.label, area: sql.p.area },
        `${x},${y}`,
      ).toEqual(ts);
      expect(sql.ok, `${x},${y}`).toBe(inside);
      if (!inside) outside++;
      else if (ts?.label) named++;
      else free++;
    }
    // El muestreo cubre los tres casos (si no, la prueba no probaría nada).
    expect(named).toBeGreaterThan(20);
    expect(free).toBeGreaterThan(20);
    expect(outside).toBeGreaterThan(20);
  });
});
