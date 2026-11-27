import { describe, it, expect } from "vitest";
import { commandSchema } from "@/features/orders/server/command-schema";

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const create = (delivery: unknown) => ({
  action: "create",
  venueId: uuid(1),
  items: [{ productId: uuid(2), quantity: 1, expectedProductVersion: 1 }],
  idempotencyKey: "k",
  termsVersion: "demo-v1",
  privacyVersion: "demo-v1",
  adult: true,
  delivery,
});

describe("el comando de pedido conserva el punto del mapa", () => {
  it("un punto con la mesa del QR llega completo al servidor (no se reduce a «solo mesa»)", () => {
    const parsed = commandSchema.parse(
      create({
        mode: "location",
        point: { mapId: uuid(3), x: 0.4, y: 0.5 },
        spotId: uuid(4),
      }),
    );
    expect(parsed).toMatchObject({
      delivery: {
        mode: "location",
        point: { mapId: uuid(3), x: 0.4, y: 0.5 },
        spotId: uuid(4),
      },
    });
  });
  it("solo un punto, solo un lugar de la lista o barra", () => {
    expect(
      commandSchema.parse(
        create({ mode: "location", point: { mapId: uuid(3), x: 0, y: 1 } }),
      ),
    ).toMatchObject({ delivery: { point: { x: 0, y: 1 } } });
    expect(
      commandSchema.parse(create({ mode: "location", spotId: uuid(4) })),
    ).toMatchObject({ delivery: { spotId: uuid(4) } });
    expect(commandSchema.parse(create({ mode: "bar" }))).toMatchObject({
      delivery: { mode: "bar" },
    });
  });
  it("rechaza puntos fuera de 0..1, sin mapa o con texto", () => {
    for (const point of [
      { mapId: uuid(3), x: 1.2, y: 0.5 },
      { mapId: uuid(3), x: -0.1, y: 0.5 },
      { x: 0.2, y: 0.2 },
      { mapId: uuid(3), x: "0.2", y: 0.2 },
    ])
      expect(() =>
        commandSchema.parse(create({ mode: "location", point })),
      ).toThrow();
  });
  it("mover el pin de un pedido acepta un punto o un lugar", () => {
    expect(
      commandSchema.parse({
        action: "order_change_spot",
        orderId: uuid(5),
        point: { mapId: uuid(3), x: 0.1, y: 0.2 },
      }),
    ).toMatchObject({ point: { x: 0.1 } });
    expect(
      commandSchema.parse({
        action: "order_change_spot",
        orderId: uuid(5),
        spotId: uuid(4),
      }),
    ).toMatchObject({ spotId: uuid(4) });
  });
  it("las formas del mapa se validan antes de llegar a la base", () => {
    const ok = {
      action: "spot_save",
      venueId: uuid(1),
      label: "Mesa 1",
      shape: { kind: "circle", x: 0.2, y: 0.3, r: 0.03 },
    };
    expect(commandSchema.parse(ok)).toMatchObject({
      shape: { kind: "circle" },
    });
    expect(commandSchema.parse({ ...ok, shape: null })).toMatchObject({
      shape: null,
    });
    expect(() =>
      commandSchema.parse({
        ...ok,
        shape: { kind: "circle", x: 0.2, y: 0.3, r: 0.9 },
      }),
    ).toThrow();
    expect(() =>
      commandSchema.parse({
        ...ok,
        shape: {
          kind: "polygon",
          points: [
            [0, 0],
            [1, 1],
          ],
        },
      }),
    ).toThrow();
    expect(() =>
      commandSchema.parse({
        action: "map_area",
        venueId: uuid(1),
        serviceArea: Array(11).fill({
          points: [
            [0, 0],
            [1, 0],
            [1, 1],
          ],
        }),
      }),
    ).toThrow();
  });
});
