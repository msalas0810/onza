import { describe, expect, it } from "vitest";
import {
  centerOn,
  clampView,
  fitBase,
  initialView,
  normToScreen,
  nudge,
  pinchView,
  pointInPolygon,
  proximityWord,
  resolveSelection,
  roundCoord,
  screenToNorm,
  zoomAt,
} from "@/features/maps/geometry";
import {
  mapLayoutSchema,
  emptyLayout,
  describeLocation,
  type MapLayout,
} from "@/features/maps/types";

const rect = (x1: number, y1: number, x2: number, y2: number) => [
  { x: x1, y: y1 },
  { x: x2, y: y1 },
  { x: x2, y: y2 },
  { x: x1, y: y2 },
];
export const layout: MapLayout = {
  elements: [
    { id: "t1", type: "table", label: "Mesa 1", x: 0.2, y: 0.3 },
    { id: "t2", type: "table", label: "Mesa 2", x: 0.8, y: 0.7 },
    { id: "bar", type: "bar", label: "Barra principal", x: 0.5, y: 0.1 },
  ],
  zones: [
    {
      id: "vip",
      name: "Zona VIP",
      kind: "vip",
      delivery: "default",
      points: rect(0.6, 0.5, 0.95, 0.95),
    },
    {
      id: "kitchen",
      name: "Cocina",
      kind: "general",
      delivery: "restrict",
      points: rect(0, 0, 0.15, 0.15),
    },
  ],
};
const image = { w: 1600, h: 1000 };

describe("coordenadas normalizadas independientes de la pantalla", () => {
  it("el mismo punto cae en el mismo lugar del plano en teléfono, tablet y escritorio", () => {
    const point = { x: 0.42, y: 0.68 };
    for (const container of [
      { w: 360, h: 640 },
      { w: 820, h: 1180 },
      { w: 1440, h: 900 },
      { w: 390, h: 300 },
    ]) {
      const base = fitBase(container, image);
      // La imagen siempre cabe entera y conserva su proporción.
      expect(base.w).toBeLessThanOrEqual(container.w + 1e-9);
      expect(base.h).toBeLessThanOrEqual(container.h + 1e-9);
      expect(base.w / base.h).toBeCloseTo(image.w / image.h, 9);
      for (const scale of [1, 2.5, 8]) {
        const view = centerOn(point, scale, container, base);
        const screen = normToScreen(view, base, point);
        // ida y vuelta pantalla ↔ plano sin pérdida
        const back = screenToNorm(view, base, screen);
        expect(back.x).toBeCloseTo(point.x, 9);
        expect(back.y).toBeCloseTo(point.y, 9);
      }
    }
  });

  it("un toque en pantalla se convierte en la coordenada correcta con cualquier zoom y desplazamiento", () => {
    const container = { w: 390, h: 700 };
    const base = fitBase(container, image);
    let view = initialView(container, base);
    view = zoomAt(view, 3, { x: 200, y: 350 }, container, base);
    const target = { x: 0.37, y: 0.52 };
    const at = normToScreen(view, base, target);
    expect(screenToNorm(view, base, at).x).toBeCloseTo(target.x, 9);
    expect(screenToNorm(view, base, at).y).toBeCloseTo(target.y, 9);
  });
});

describe("zoom y desplazamiento", () => {
  const container = { w: 390, h: 700 };
  const base = fitBase(container, image);
  it("la escala se limita y el plano nunca se sale del contenedor", () => {
    let v = initialView(container, base);
    v = zoomAt(v, 100, { x: 10, y: 10 }, container, base);
    expect(v.scale).toBe(8);
    expect(v.tx).toBeLessThanOrEqual(0);
    expect(v.tx).toBeGreaterThanOrEqual(container.w - base.w * 8);
    v = zoomAt(v, 0.0001, { x: 10, y: 10 }, container, base);
    expect(v.scale).toBe(1);
    expect(v).toEqual(initialView(container, base)); // al volver a escala 1 queda centrado
    const off = clampView({ scale: 4, tx: 9999, ty: -9999 }, container, base);
    expect(off.tx).toBe(0);
    expect(off.ty).toBe(container.h - base.h * 4);
  });
  // Contenedor con la proporción del plano: así el plano puede desplazarse en los dos ejes y el ancla no queda recortada.
  const fitted = { w: 400, h: 250 };
  const fittedBase = fitBase(fitted, image);
  it("zoom con ancla: el punto bajo el dedo no se mueve", () => {
    const start = zoomAt(
      initialView(fitted, fittedBase),
      2,
      { x: 100, y: 100 },
      fitted,
      fittedBase,
    );
    const anchor = { x: 250, y: 150 };
    const before = screenToNorm(start, fittedBase, anchor);
    const next = zoomAt(start, 1.5, anchor, fitted, fittedBase);
    expect(next.scale).toBe(3);
    const after = screenToNorm(next, fittedBase, anchor);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });
  it("pellizco: amplía por la razón de distancias y sigue al centro de los dedos", () => {
    const start = initialView(fitted, fittedBase);
    const a = { x: 150, y: 125 };
    const b = { x: 250, y: 125 };
    const grabbed = screenToNorm(start, fittedBase, { x: 200, y: 125 });
    const v = pinchView(
      start,
      a,
      b,
      { x: 100, y: 140 },
      { x: 300, y: 140 },
      fitted,
      fittedBase,
    );
    expect(v.scale).toBeCloseTo(2, 9);
    const where = normToScreen(v, fittedBase, grabbed);
    expect(where.x).toBeCloseTo(200, 6);
    expect(where.y).toBeCloseTo(140, 6);
    // dedos pegados (distancia ~0) no producen NaN ni saltos
    expect(pinchView(start, a, a, b, b, fitted, fittedBase)).toEqual(start);
  });
  it("con el plano más chico que el contenedor se mantiene centrado en ese eje", () => {
    const v = zoomAt(
      initialView(container, base),
      2,
      { x: 10, y: 10 },
      container,
      base,
    );
    expect(v.ty).toBeCloseTo((container.h - base.h * 2) / 2, 9);
  });
});

describe("reglas de entrega", () => {
  it("acepta puntos libres, resuelve zona y referencia más cercana", () => {
    const free = resolveSelection(layout, image, {
      method: "location_on_map",
      x: 0.45,
      y: 0.2,
    });
    expect(free).toMatchObject({
      ok: true,
      zone: null,
      reference: { id: "bar" },
    });
    const vip = resolveSelection(layout, image, {
      method: "location_on_map",
      x: 0.7,
      y: 0.6,
    });
    expect(vip).toMatchObject({ ok: true, zone: { id: "vip" } });
  });
  it("rechaza fuera del plano, zonas restringidas y mesas inexistentes", () => {
    for (const p of [
      { x: 1.0001, y: 0.5 },
      { x: -0.1, y: 0.5 },
      { x: 0.5, y: 3 },
      { x: Number.NaN, y: 0.5 },
    ])
      expect(
        resolveSelection(layout, image, { method: "location_on_map", ...p }),
      ).toEqual({ ok: false, reason: "out_of_map" });
    expect(
      resolveSelection(layout, image, {
        method: "location_on_map",
        x: 0.05,
        y: 0.05,
      }),
    ).toEqual({ ok: false, reason: "restricted" });
    expect(
      resolveSelection(layout, image, { method: "table", tableId: "nada" }),
    ).toEqual({ ok: false, reason: "unknown_table" });
    expect(
      resolveSelection(layout, image, { method: "table", tableId: "bar" }),
    ).toEqual({ ok: false, reason: "unknown_table" });
  });
  it("con zonas «allow» solo se entrega dentro de ellas", () => {
    const withAllow: MapLayout = {
      ...layout,
      zones: [
        ...layout.zones,
        {
          id: "terraza",
          name: "Terraza",
          kind: "general",
          delivery: "allow",
          points: rect(0.3, 0.3, 0.6, 0.6),
        },
      ],
    };
    expect(
      resolveSelection(withAllow, image, {
        method: "location_on_map",
        x: 0.45,
        y: 0.45,
      }),
    ).toMatchObject({ ok: true, zone: { id: "terraza" } });
    expect(
      resolveSelection(withAllow, image, {
        method: "location_on_map",
        x: 0.9,
        y: 0.1,
      }),
    ).toEqual({ ok: false, reason: "restricted" });
    expect(
      resolveSelection(withAllow, image, { method: "table", tableId: "t1" }),
    ).toEqual({ ok: false, reason: "restricted" });
  });
  it("mesa elegida: usa las coordenadas de la mesa", () => {
    expect(
      resolveSelection(layout, image, { method: "table_qr", tableId: "t2" }),
    ).toMatchObject({
      ok: true,
      point: { x: 0.8, y: 0.7 },
      table: { label: "Mesa 2" },
      zone: { id: "vip" },
    });
  });
  it("polígonos cóncavos y puntos en el borde son deterministas", () => {
    const l = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0.5, y: 0.4 },
      { x: 0, y: 1 },
    ];
    expect(pointInPolygon({ x: 0.5, y: 0.2 }, l)).toBe(true);
    expect(pointInPolygon({ x: 0.5, y: 0.8 }, l)).toBe(false); // dentro de la muesca cóncava
  });
});

describe("utilidades", () => {
  it("proximidad en palabras, redondeo y desplazamiento con teclado", () => {
    expect(proximityWord(10, image)).toBe("muy cerca");
    expect(proximityWord(150, image)).toBe("cerca");
    expect(proximityWord(900, image)).toBe("a media distancia");
    expect(roundCoord(0.123456789)).toBe(0.12346);
    expect(roundCoord(2)).toBe(1);
    expect(nudge({ x: 0.995, y: 0.002 }, 0.02, -0.02)).toEqual({ x: 1, y: 0 });
  });
  it("el esquema del plano rechaza ids repetidos, claves ajenas y polígonos de menos de 3 puntos", () => {
    expect(mapLayoutSchema.safeParse(layout).success).toBe(true);
    expect(mapLayoutSchema.safeParse(emptyLayout()).success).toBe(true);
    expect(
      mapLayoutSchema.safeParse({
        ...layout,
        elements: [layout.elements[0], layout.elements[0]],
      }).success,
    ).toBe(false);
    expect(mapLayoutSchema.safeParse({ ...layout, extra: 1 }).success).toBe(
      false,
    );
    expect(
      mapLayoutSchema.safeParse({
        elements: [],
        zones: [{ ...layout.zones[0], points: rect(0, 0, 1, 1).slice(0, 2) }],
      }).success,
    ).toBe(false);
    expect(
      mapLayoutSchema.safeParse({
        elements: [{ ...layout.elements[0], x: 1.2 }],
        zones: [],
      }).success,
    ).toBe(false);
  });
  it("describe la ubicación para el equipo", () => {
    const base = {
      order_id: "o",
      map_id: "m",
      map_version: 1,
      map_name: "Planta",
      location: { x: 0.1, y: 0.1 },
      element_id: null,
      reference_id: null,
      updated_at: "x",
      assigned_staff: [] as string[],
    };
    expect(
      describeLocation({
        ...base,
        delivery_method: "table",
        element_label: "Mesa 12",
        reference_label: null,
        zone_id: "vip",
        zone_name: "Zona VIP",
      }),
    ).toBe("Mesa 12 · Zona VIP");
    expect(
      describeLocation({
        ...base,
        delivery_method: "location_on_map",
        element_label: null,
        reference_label: "Barra 2",
        zone_id: null,
        zone_name: null,
      }),
    ).toBe("Marcado cerca de Barra 2");
  });
});
