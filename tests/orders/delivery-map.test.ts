import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { database, actor, command, createInput, ids } from "../db/helpers";

let db: PGlite;
beforeAll(async () => {
  db = await database();
});
afterAll(async () => {
  await db?.close();
});

const as = (user: string) => actor(db, user, `${user}-s`, false);
const asCustomer = () => as(ids.customer);
const asAdmin = () => as(ids.admin);

async function rpc<T = Record<string, unknown>>(
  name: string,
  input: Record<string, unknown>,
) {
  const result = await db.query<{ r: T }>(
    `select public.${name}($1::jsonb) as r`,
    [JSON.stringify(input)],
  );
  return result.rows[0].r;
}
const base = "http://127.0.0.1:54321/storage/v1/object/public/venue-images";
const mapInput = (
  venue: string,
  file = "map-a1.jpg",
  extra: Record<string, unknown> = {},
) => ({
  venueId: venue,
  imageUrl: `${base}/${venue}/${file}`,
  width: 2000,
  height: 1000,
  ...extra,
});
const save = (input: Record<string, unknown>) =>
  rpc("venue_spot_save", { venueId: ids.venue, ...input });
const rect = (x1: number, y1: number, x2: number, y2: number) => ({
  points: [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ],
});
const place = (key: string, delivery: Record<string, unknown>) =>
  command(db, createInput(key, { delivery }));
type Map = {
  id: string;
  version: number;
  status: string;
  service_area: unknown[];
};
type Spot = { id: string };

describe("administración del mapa: solo administración del local, todo validado en la base", () => {
  it("empleado, cliente y administración de otro local no tocan el mapa; sin mapa no hay formas ni área", async () => {
    await asAdmin();
    await expect(
      rpc("venue_map_area", { venueId: ids.venue, serviceArea: [] }),
    ).rejects.toThrow("NO_MAP");
    await expect(
      save({
        label: "Mesa 1",
        shape: { kind: "circle", x: 0.2, y: 0.3, r: 0.05 },
      }),
    ).rejects.toThrow("NO_MAP");
    await db.exec("reset role");
    await db.exec(
      `insert into public.memberships(user_id,venue_id,role) values('${ids.other}','${ids.patio}','admin')`,
    );
    for (const run of [() => as(ids.staff), asCustomer, () => as(ids.other)]) {
      await run();
      await expect(rpc("venue_map_save", mapInput(ids.venue))).rejects.toThrow(
        "NOT_AUTHORIZED",
      );
      await expect(
        rpc("venue_map_area", { venueId: ids.venue, serviceArea: [] }),
      ).rejects.toThrow("NOT_AUTHORIZED");
      await expect(
        rpc("venue_map_remove", { venueId: ids.venue }),
      ).rejects.toThrow("NOT_AUTHORIZED");
    }
    await db.exec("reset role");
    await db.exec(
      `delete from public.memberships where user_id='${ids.other}'`,
    );
  });

  it("la imagen debe ser un archivo de este local; medidas y formas inválidas se rechazan", async () => {
    await asAdmin();
    for (const bad of [
      mapInput(ids.venue, "cover-a1.jpg"),
      { ...mapInput(ids.venue), imageUrl: `${base}/${ids.patio}/map-a1.jpg` },
      { ...mapInput(ids.venue), imageUrl: "https://example.com/plano.jpg" },
      { ...mapInput(ids.venue), imageUrl: `${base}/${ids.venue}/map-a1.svg` },
      { ...mapInput(ids.venue), width: 0 },
      { ...mapInput(ids.venue), height: 30000 },
    ])
      await expect(rpc("venue_map_save", bad)).rejects.toThrow("INVALID_INPUT");
    const m = await rpc<Map>("venue_map_save", mapInput(ids.venue));
    expect(m).toMatchObject({
      version: 1,
      status: "published",
      service_area: [],
    });
    for (const shape of [
      { kind: "circle", x: 0.2, y: 0.3, r: 0.9 },
      { kind: "circle", x: 1.4, y: 0.3, r: 0.05 },
      { kind: "circle", x: "0.2", y: 0.3, r: 0.05 },
      {
        kind: "polygon",
        points: [
          [0.1, 0.1],
          [0.2, 0.2],
        ],
      },
      {
        kind: "polygon",
        points: [
          [0.1, 0.1],
          [0.2, 0.2],
          ["a", 0.5],
        ],
      },
      {
        kind: "polygon",
        points: [
          [0.1, 0.1],
          [0.2, 0.2],
          [2, 0.5],
        ],
      },
      { kind: "star" },
      "circle",
    ])
      await expect(save({ label: "Mesa X", shape })).rejects.toThrow(
        "INVALID_SHAPE",
      );
    await expect(
      rpc("venue_map_area", {
        venueId: ids.venue,
        serviceArea: [
          {
            points: [
              [0, 0],
              [1, 1],
            ],
          },
        ],
      }),
    ).rejects.toThrow("INVALID_SHAPE");
    await expect(
      rpc("venue_map_area", { venueId: ids.venue, serviceArea: "todo" }),
    ).rejects.toThrow("INVALID_SHAPE");
  });
});

describe("pedidos con pin: el servidor valida mapa, punto, área y nombre", () => {
  let mesa1: string;
  let mesa2: string;
  let mesa3: string;
  let jardin: string;
  let mapId: string;
  beforeAll(async () => {
    await asAdmin();
    // Imagen 2:1. Mesa 1 y Mesa 2 se superponen; Mesa 3 está dentro de la Zona jardín.
    mesa1 = (
      (await save({
        label: "Mesa 1",
        area: "Terraza",
        shape: { kind: "circle", x: 0.2, y: 0.3, r: 0.05 },
      })) as Spot
    ).id;
    mesa2 = (
      (await save({
        label: "Mesa 2",
        area: "Terraza",
        shape: { kind: "circle", x: 0.24, y: 0.3, r: 0.05 },
      })) as Spot
    ).id;
    mesa3 = (
      (await save({
        label: "Mesa 3",
        area: "",
        shape: { kind: "circle", x: 0.7, y: 0.7, r: 0.03 },
      })) as Spot
    ).id;
    jardin = (
      (await save({
        label: "Zona jardín",
        area: "",
        shape: { kind: "polygon", points: rect(0.5, 0.5, 0.9, 0.9).points },
      })) as Spot
    ).id;
    await save({ label: "Sin ubicar" });
    const area = [rect(0.05, 0.05, 0.45, 0.95), rect(0.5, 0.5, 0.95, 0.95)];
    const m = await rpc<Map>("venue_map_area", {
      venueId: ids.venue,
      serviceArea: area,
    });
    mapId = m.id;
    await rpc("venue_delivery_config", {
      venueId: ids.venue,
      mode: "both",
      noun: "Mesa",
    });
  });
  const at = (x: number, y: number, extra: Record<string, unknown> = {}) => ({
    mode: "location",
    point: { mapId, x, y },
    ...extra,
  });

  it("un toque dentro de una sola mesa la nombra; el servidor guarda el punto relativo con 6 decimales", async () => {
    await asCustomer();
    const o = await place("pin-mesa1", at(0.1666666666, 0.3));
    expect(o).toMatchObject({
      fulfillment: "location",
      spot_id: mesa1,
      spot_label: "Mesa 1",
      spot_area: "Terraza",
      map_id: mapId,
    });
    expect(Number(o.map_x)).toBeCloseTo(0.166667, 6);
    expect(Number(o.map_y)).toBeCloseTo(0.3, 6);
    expect(
      (o as { map: { current: boolean; width: number } }).map,
    ).toMatchObject({ current: true, width: 2000 });
  });

  it("el círculo es redondo en la imagen: el eje vertical se corrige por la proporción", async () => {
    await asCustomer();
    // Mesa 3: r = 0.03 del ancho (60 px de 2000). 0.04 de alto = 40 px: dentro. 0.07 de alto = 70 px: fuera.
    await expect(place("aspect-in", at(0.7, 0.74))).resolves.toMatchObject({
      spot_id: mesa3,
      spot_label: "Mesa 3",
      spot_area: "Zona jardín",
    });
    await expect(place("aspect-out", at(0.7, 0.78))).resolves.toMatchObject({
      spot_id: jardin,
      spot_label: "Zona jardín",
    });
    await expect(
      place("aspect-side", at(0.7 + 0.031, 0.7)),
    ).resolves.toMatchObject({ spot_id: jardin });
  });

  it("dentro de una zona sin mesa se nombra la zona; entre mesas va solo el punto, sin adivinar", async () => {
    await asCustomer();
    await expect(place("zone-only", at(0.85, 0.55))).resolves.toMatchObject({
      spot_id: jardin,
      spot_label: "Zona jardín",
      spot_area: null,
    });
    const free = await place("free-point", at(0.3, 0.8));
    expect(free).toMatchObject({
      fulfillment: "location",
      spot_id: null,
      spot_label: "Punto en el mapa",
      spot_area: null,
      map_id: mapId,
    });
  });

  it("dos mesas superpuestas no se adivinan; el QR de una mesa (spotId) desambigua solo si contiene el punto", async () => {
    await asCustomer();
    await expect(place("overlap", at(0.22, 0.3))).resolves.toMatchObject({
      spot_id: null,
      spot_label: "Punto en el mapa",
    });
    await expect(
      place("overlap-qr", at(0.22, 0.3, { spotId: mesa2 })),
    ).resolves.toMatchObject({ spot_id: mesa2, spot_label: "Mesa 2" });
    await expect(
      place("hint-far", at(0.3, 0.8, { spotId: mesa2 })),
    ).rejects.toThrow("SPOT_INVALID");
    await expect(
      place(
        "hint-list-only",
        at(0.3, 0.8, { spotId: "00000000-0000-4000-8000-00000000dead" }),
      ),
    ).rejects.toThrow("SPOT_INVALID");
  });

  it("fuera del área de servicio, fuera de la imagen o de otro mapa: se rechaza y no queda pedido", async () => {
    await asCustomer();
    await db.exec("reset role");
    const before = (
      await db.query<{ n: number }>("select count(*)::int n from public.orders")
    ).rows[0].n;
    await asCustomer();
    await expect(place("out-area", at(0.48, 0.2))).rejects.toThrow(
      "OUTSIDE_AREA",
    );
    await expect(place("out-area2", at(0.2, 0.99))).rejects.toThrow(
      "OUTSIDE_AREA",
    );
    await expect(place("out-image", at(1.2, 0.5))).rejects.toThrow(
      "INVALID_INPUT",
    );
    await expect(place("out-image2", at(-0.1, 0.5))).rejects.toThrow(
      "INVALID_INPUT",
    );
    await expect(place("nan", at("0.2" as never, 0.3))).rejects.toThrow(
      "INVALID_INPUT",
    );
    await expect(
      place("no-map", { mode: "location", point: { x: 0.2, y: 0.3 } }),
    ).rejects.toThrow("INVALID_INPUT");
    await expect(
      place("point-not-object", { mode: "location", point: 5 }),
    ).rejects.toThrow("INVALID_INPUT");
    await expect(
      place("bar-point", { mode: "bar", point: { mapId, x: 0.2, y: 0.3 } }),
    ).rejects.toThrow("INVALID_INPUT");
    await expect(
      place("alien-map", {
        mode: "location",
        point: {
          mapId: "00000000-0000-4000-8000-00000000dead",
          x: 0.2,
          y: 0.3,
        },
      }),
    ).rejects.toThrow("MAP_OUTDATED");
    await db.exec("reset role");
    await db.exec(
      `insert into public.venue_maps(venue_id,version,image_url,width,height) values('${ids.patio}',1,'https://x/y.jpg',100,100)`,
    );
    const otherMap = (
      await db.query<{ id: string }>(
        `select id from public.venue_maps where venue_id='${ids.patio}'`,
      )
    ).rows[0].id;
    await asCustomer();
    await expect(
      place("map-other-venue", {
        mode: "location",
        point: { mapId: otherMap, x: 0.2, y: 0.3 },
      }),
    ).rejects.toThrow("MAP_OUTDATED");
    await db.exec("reset role");
    expect(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from public.orders",
        )
      ).rows[0].n,
    ).toBe(before);
  });

  it("un reintento con la misma clave devuelve el mismo pedido con el mismo pin", async () => {
    await asCustomer();
    const a = await place("replay", at(0.3, 0.8));
    const b = await place("replay", at(0.3, 0.8));
    expect(b.id).toBe(a.id);
    await expect(place("replay", at(0.31, 0.8))).rejects.toThrow(
      "IDEMPOTENCY_CONFLICT",
    );
  });

  it("el dueño mueve su pin antes de la entrega: el servidor renombra, el equipo ve el cambio y otro cliente no puede", async () => {
    await asCustomer();
    const o = await place("move-1", at(0.3, 0.8));
    const moved = await rpc<Record<string, unknown>>("order_change_spot", {
      orderId: o.id,
      point: { mapId, x: 0.7, y: 0.7 },
    });
    expect(moved).toMatchObject({
      spot_id: mesa3,
      spot_label: "Mesa 3",
      map_id: mapId,
    });
    expect(moved.spot_changed_at).toBeTruthy();
    await expect(
      rpc("order_change_spot", {
        orderId: o.id,
        point: { mapId, x: 0.48, y: 0.2 },
      }),
    ).rejects.toThrow("OUTSIDE_AREA");
    await expect(
      rpc("order_change_spot", {
        orderId: o.id,
        point: { mapId, x: 2, y: 0.2 },
      }),
    ).rejects.toThrow("INVALID_INPUT");
    await expect(rpc("order_change_spot", { orderId: o.id })).rejects.toThrow(
      "INVALID_INPUT",
    );
    // Moverlo a un lugar de la lista borra el pin.
    const listed = await rpc<Record<string, unknown>>("order_change_spot", {
      orderId: o.id,
      spotId: mesa1,
    });
    expect(listed).toMatchObject({
      spot_id: mesa1,
      map_id: null,
      map_x: null,
      map_y: null,
    });
    await db.exec("reset role");
    const events = await db.query<{ metadata: { to: string; pin: boolean } }>(
      `select metadata from public.order_events where order_id='${o.id}' and type='spot_changed' order by created_at`,
    );
    expect(events.rows.map((e) => e.metadata)).toMatchObject([
      { to: "Mesa 3", pin: true },
      { to: "Mesa 1", pin: false },
    ]);
    await as(ids.other);
    await expect(
      rpc("order_change_spot", {
        orderId: o.id,
        point: { mapId, x: 0.7, y: 0.7 },
      }),
    ).rejects.toThrow("NOT_AUTHORIZED");
  });

  it("reemplazar la imagen crea una versión nueva: el pedido viejo conserva su mapa y los nuevos usan el vigente", async () => {
    await asCustomer();
    const old = await place("before-replace", at(0.3, 0.8));
    const oldMap = mapId;
    await asAdmin();
    const v2 = await rpc<Map>(
      "venue_map_save",
      mapInput(ids.venue, "map-b2.png"),
    );
    expect(v2).toMatchObject({ version: 2, status: "published" });
    expect(v2.service_area).toHaveLength(2); // hereda el área
    await db.exec("reset role");
    const rows = await db.query<{ version: number; status: string }>(
      `select version,status from public.venue_maps where venue_id='${ids.venue}' order by version`,
    );
    expect(rows.rows).toEqual([
      { version: 1, status: "retired" },
      { version: 2, status: "published" },
    ]);
    await asCustomer();
    // Crear con la versión retirada falla; con la vigente, funciona.
    await expect(place("stale-map", at(0.3, 0.8))).rejects.toThrow(
      "MAP_OUTDATED",
    );
    await expect(
      place("fresh-map", {
        mode: "location",
        point: { mapId: v2.id, x: 0.3, y: 0.8 },
      }),
    ).resolves.toMatchObject({ map_id: v2.id });
    // El pedido viejo sigue con su versión y su imagen, marcada como no vigente.
    const listed = (
      await db.query<{ v: unknown }>(`select public.order_list(null, $1) v`, [
        old.id,
      ])
    ).rows[0].v;
    const view = (
      Array.isArray(listed)
        ? listed[0]
        : (listed as { orders: unknown[] }).orders[0]
    ) as {
      map_id: string;
      map: { id: string; current: boolean; image_url: string };
    };
    expect(view.map_id).toBe(oldMap);
    expect(view.map).toMatchObject({ id: oldMap, current: false });
    expect(view.map.image_url).toContain("map-a1.jpg");
    // También puede mover su pin al mapa vigente.
    const moved = await rpc<{ map_id: string }>("order_change_spot", {
      orderId: old.id,
      point: { mapId: v2.id, x: 0.7, y: 0.7 },
    });
    expect(moved.map_id).toBe(v2.id);
    mapId = v2.id;
  });
});

describe("el mapa y las tablas: lectura pública, escritura solo por funciones, quitar el mapa", () => {
  it("el público lee solo el mapa vigente; la administración también los retirados; nadie escribe directo", async () => {
    await db.exec("reset role");
    await db.exec("set role anon");
    const pub = await db.query<{ status: string }>(
      `select status from public.venue_maps where venue_id='${ids.venue}'`,
    );
    expect(pub.rows.map((r) => r.status)).toEqual(["published"]);
    await expect(
      db.exec(`update public.venue_maps set service_area='[]'`),
    ).rejects.toThrow();
    await db.exec("reset role");
    await asAdmin();
    const all = await db.query<{ status: string }>(
      `select status from public.venue_maps where venue_id='${ids.venue}'`,
    );
    expect(all.rows.length).toBeGreaterThan(1);
    await expect(
      db.exec(`update public.venue_maps set status='published'`),
    ).rejects.toThrow();
    await expect(
      db.exec(`update public.delivery_spots set shape=null`),
    ).rejects.toThrow();
  });

  it("un local puede entregar con solo un mapa, sin lugares; quitar el mapa borra las formas y respeta el último apoyo", async () => {
    await asAdmin();
    // Con mapa y sin lugares habilitados la entrega por pin sigue siendo posible.
    await db.exec("reset role");
    await db.exec(
      `update public.delivery_spots set enabled=false where venue_id='${ids.venue}'`,
    );
    await asAdmin();
    await expect(
      rpc("venue_delivery_config", { venueId: ids.venue, mode: "location" }),
    ).resolves.toMatchObject({ mode: "location" });
    // Con la entrega en el lugar activa y sin lugares, quitar el mapa dejaría al local sin forma de entregar.
    await expect(
      rpc("venue_map_remove", { venueId: ids.venue }),
    ).rejects.toThrow("LAST_SPOT");
    await db.exec("reset role");
    await db.exec(
      `update public.delivery_spots set enabled=true where venue_id='${ids.venue}'`,
    );
    await asAdmin();
    await expect(
      rpc("venue_map_remove", { venueId: ids.venue }),
    ).resolves.toEqual({ removed: true });
    await db.exec("reset role");
    const shapes = await db.query(
      `select 1 from public.delivery_spots where venue_id='${ids.venue}' and shape is not null`,
    );
    expect(shapes.rows).toHaveLength(0);
    await asAdmin();
    await expect(
      rpc("venue_map_remove", { venueId: ids.venue }),
    ).rejects.toThrow("NO_MAP");
    // Sin mapa y con la entrega por lugares, un pin ya no es válido.
    await asCustomer();
    await expect(
      place("after-remove", {
        mode: "location",
        point: { mapId: ids.venue, x: 0.3, y: 0.8 },
      }),
    ).rejects.toThrow("MAP_OUTDATED");
  });
});
