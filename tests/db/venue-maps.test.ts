import { createHash } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { actor, command, createInput, database, ids } from "./helpers";

const otherAdmin = "10000000-0000-4000-8000-000000000005";
const imagePath = `${ids.venue}/plano-1.webp`;
const rect = (x1: number, y1: number, x2: number, y2: number) => [
  { x: x1, y: y1 },
  { x: x2, y: y1 },
  { x: x2, y: y2 },
  { x: x1, y: y2 },
];
const baseLayout = () => ({
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
});

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
async function call(db: PGlite, fn: string, input: unknown): Promise<Json> {
  const r = await db.query<{ r: Json }>(`select public.${fn}($1::jsonb) as r`, [
    JSON.stringify(input),
  ]);
  return r.rows[0].r;
}
async function callUuid(
  db: PGlite,
  fn: string,
  ...args: (string | number)[]
): Promise<Json> {
  const params = args.map((_, i) => `$${i + 1}`).join(",");
  const r = await db.query<{ r: Json }>(
    `select public.${fn}(${params}) as r`,
    args,
  );
  return r.rows[0].r;
}

/** Local con un plano ya publicado (versión 1). Devuelve el id del mapa. */
async function publishedMap(
  db: PGlite,
  layout: unknown = baseLayout(),
  venue = ids.venue,
) {
  await actor(
    db,
    venue === ids.venue ? ids.admin : otherAdmin,
    "admin-device",
    false,
  );
  const created = await call(db, "map_create", {
    venueId: venue,
    name: "Planta baja",
  });
  const path = `${venue}/plano-1.webp`;
  const saved = await call(db, "map_save_draft", {
    mapId: created.id,
    expectedRevision: created.draft_revision,
    imagePath: path,
    imageWidth: 1600,
    imageHeight: 1000,
    layout,
  });
  const published = await call(db, "map_publish", {
    mapId: created.id,
    expectedRevision: saved.draft_revision,
  });
  return { id: created.id as string, published };
}

async function withTeam(db: PGlite) {
  await db.exec("reset role");
  await db.exec(`insert into auth.users values('${otherAdmin}');
    insert into public.memberships(user_id,venue_id,role) values('${otherAdmin}','${ids.patio}','admin');`);
}

describe("administración de mapas", () => {
  it("solo el administrador del propio local crea, lista y edita; los demás no", async () => {
    const db = await database();
    try {
      await withTeam(db);
      await actor(db, ids.admin, "admin-device", false);
      const created = await call(db, "map_create", {
        venueId: ids.venue,
        name: "Planta baja",
      });
      expect(created.status).toBe("draft");
      expect(created.kind).toBe("permanent");
      expect(
        (await callUuid(db, "map_admin_list", ids.venue)) as unknown as Json[],
      ).toHaveLength(1);

      // Personal sin permiso de administración y clientes: nada.
      await actor(db, ids.staff, "bar-device", false);
      await expect(
        call(db, "map_create", { venueId: ids.venue, name: "X" }),
      ).rejects.toThrow("NOT_AUTHORIZED");
      await expect(callUuid(db, "map_admin_list", ids.venue)).rejects.toThrow(
        "NOT_AUTHORIZED",
      );
      await actor(db);
      await expect(
        call(db, "map_create", { venueId: ids.venue, name: "X" }),
      ).rejects.toThrow("NOT_AUTHORIZED");
      await expect(callUuid(db, "map_admin_get", created.id)).rejects.toThrow(
        "NOT_AUTHORIZED",
      );

      // Administrador de OTRO local: no ve, no edita, no publica, no archiva, no duplica los mapas ajenos.
      await actor(db, otherAdmin, "other-device", false);
      await expect(callUuid(db, "map_admin_list", ids.venue)).rejects.toThrow(
        "NOT_AUTHORIZED",
      );
      await expect(callUuid(db, "map_admin_get", created.id)).rejects.toThrow(
        "NOT_AUTHORIZED",
      );
      for (const fn of [
        "map_save_draft",
        "map_publish",
        "map_archive",
        "map_duplicate",
        "map_update_meta",
        "map_assign_staff",
      ])
        await expect(
          call(db, fn, {
            mapId: created.id,
            expectedRevision: 1,
            name: "robo",
            archived: true,
            zoneId: "z",
            userIds: [],
          }),
        ).rejects.toThrow("NOT_AUTHORIZED");
      await expect(
        call(db, "map_create", { venueId: ids.venue, name: "X" }),
      ).rejects.toThrow("NOT_AUTHORIZED");
      const own = await call(db, "map_create", {
        venueId: ids.patio,
        name: "Patio",
      });
      expect(own.venue_id).toBe(ids.patio);
      expect(await callUuid(db, "map_admin_list", ids.patio)).toHaveLength(1);
    } finally {
      await db.close();
    }
  });

  it("las tablas no se leen ni se escriben directo; sin sesión no hay acceso", async () => {
    const db = await database();
    try {
      const map = await publishedMap(db);
      await actor(db, ids.admin, "admin-device", false);
      for (const table of [
        "venue_maps",
        "venue_map_versions",
        "order_locations",
        "venue_map_zone_staff",
      ])
        await expect(db.query(`select * from public.${table}`)).rejects.toThrow(
          /permission denied/,
        );
      await expect(
        db.query("update public.venue_maps set name='x'"),
      ).rejects.toThrow(/permission denied/);
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claims','',false)");
      await db.exec("set role anon");
      await expect(callUuid(db, "map_for_venue", ids.venue)).rejects.toThrow(
        /permission denied/,
      );
      expect(map.id).toBeTruthy();
    } finally {
      await db.close();
    }
  });

  it("valida el plano: coordenadas 0..1, ids únicos, tipos, polígonos y claves ajenas", async () => {
    const db = await database();
    try {
      await actor(db, ids.admin, "admin-device", false);
      const map = await call(db, "map_create", {
        venueId: ids.venue,
        name: "Planta",
      });
      const save = (layout: unknown, extra: Json = {}) =>
        call(db, "map_save_draft", {
          mapId: map.id,
          expectedRevision: 1,
          layout,
          ...extra,
        });
      const el = (patch: Json) => ({
        ...baseLayout(),
        elements: [
          { id: "a", type: "table", label: "Mesa", x: 0.5, y: 0.5, ...patch },
        ],
      });
      const bad: unknown[] = [
        null,
        { elements: [] },
        { elements: [], zones: [], extra: 1 },
        el({ x: 1.01 }),
        el({ y: -0.01 }),
        el({ x: "0.5" }),
        el({ type: "dragon" }),
        el({ label: "" }),
        el({ id: "no valid" }),
        el({ extra: true }),
        {
          elements: [baseLayout().elements[0], baseLayout().elements[0]],
          zones: [],
        },
        {
          elements: [],
          zones: [
            {
              id: "z",
              name: "Z",
              kind: "general",
              delivery: "default",
              points: rect(0, 0, 1, 1).slice(0, 2),
            },
          ],
        },
        {
          elements: [],
          zones: [
            {
              id: "z",
              name: "Z",
              kind: "general",
              delivery: "otra",
              points: rect(0, 0, 1, 1),
            },
          ],
        },
        {
          elements: [],
          zones: [
            {
              id: "z",
              name: "Z",
              kind: "general",
              delivery: "default",
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 2, y: 1 },
              ],
            },
          ],
        },
      ];
      for (const layout of bad)
        await expect(save(layout)).rejects.toThrow("INVALID_MAP_LAYOUT");
      // Imagen: solo dentro de la carpeta del propio local y con medidas razonables.
      for (const extra of [
        {
          imagePath: `${ids.patio}/plano.webp`,
          imageWidth: 1000,
          imageHeight: 800,
        },
        {
          imagePath: "static:demo-maps/sala-norte.svg",
          imageWidth: 1000,
          imageHeight: 800,
        },
        {
          imagePath: `${ids.venue}/../x.webp`,
          imageWidth: 1000,
          imageHeight: 800,
        },
        {
          imagePath: `${ids.venue}/plano.gif`,
          imageWidth: 1000,
          imageHeight: 800,
        },
        { imagePath: imagePath, imageWidth: 10, imageHeight: 800 },
        { imagePath: imagePath, imageWidth: 1000 },
      ])
        await expect(save(baseLayout(), extra)).rejects.toThrow(
          "INVALID_MAP_IMAGE",
        );
      const ok = await save(baseLayout(), {
        imagePath,
        imageWidth: 1600,
        imageHeight: 1000,
      });
      expect(ok.draft_revision).toBe(2);
      expect(ok.elements).toBe(3);
      // Edición concurrente: el que llega con una revisión vieja recibe conflicto en vez de pisar el trabajo del otro.
      await expect(save(baseLayout())).rejects.toThrow("VERSION_CONFLICT");
    } finally {
      await db.close();
    }
  });

  it("publicar crea versiones inmutables; sin cambios no republica; archivar y restaurar", async () => {
    const db = await database();
    try {
      await actor(db, ids.admin, "admin-device", false);
      const map = await call(db, "map_create", {
        venueId: ids.venue,
        name: "Planta",
      });
      await expect(
        call(db, "map_publish", { mapId: map.id, expectedRevision: 1 }),
      ).rejects.toThrow("MAP_IMAGE_REQUIRED");
      const saved = await call(db, "map_save_draft", {
        mapId: map.id,
        expectedRevision: 1,
        imagePath,
        imageWidth: 1600,
        imageHeight: 1000,
        layout: baseLayout(),
      });
      await expect(
        call(db, "map_publish", { mapId: map.id, expectedRevision: 1 }),
      ).rejects.toThrow("VERSION_CONFLICT");
      const v1 = await call(db, "map_publish", {
        mapId: map.id,
        expectedRevision: saved.draft_revision,
      });
      expect(v1.published_version).toBe(1);
      expect(v1.status).toBe("published");
      expect(v1.has_unpublished_changes).toBe(false);
      await expect(
        call(db, "map_publish", {
          mapId: map.id,
          expectedRevision: saved.draft_revision,
        }),
      ).rejects.toThrow("NO_CHANGES");
      const layout2 = baseLayout();
      layout2.elements.push({
        id: "t3",
        type: "table",
        label: "Mesa 3",
        x: 0.4,
        y: 0.4,
      });
      const edited = await call(db, "map_save_draft", {
        mapId: map.id,
        expectedRevision: saved.draft_revision,
        layout: layout2,
      });
      expect(edited.has_unpublished_changes).toBe(true);
      const v2 = await call(db, "map_publish", {
        mapId: map.id,
        expectedRevision: edited.draft_revision,
      });
      expect(v2.published_version).toBe(2);
      expect(v2.versions.map((v: Json) => v.version)).toEqual([2, 1]);
      // La versión 1 conserva su plano original aunque el borrador y la versión 2 cambiaron.
      const old = await callUuid(db, "map_version_get", map.id, 1);
      expect(old.layout.elements).toHaveLength(3);
      expect(
        (await callUuid(db, "map_version_get", map.id, 2)).layout.elements,
      ).toHaveLength(4);
      // Nadie, ni con permisos de propietario de la tabla, modifica ni borra una versión publicada.
      await db.exec("reset role");
      await expect(
        db.exec("update public.venue_map_versions set image_width=100"),
      ).rejects.toThrow("MAP_VERSION_IMMUTABLE");
      await expect(
        db.exec("delete from public.venue_map_versions"),
      ).rejects.toThrow("MAP_VERSION_IMMUTABLE");

      await actor(db, ids.admin, "admin-device", false);
      const archived = await call(db, "map_archive", {
        mapId: map.id,
        archived: true,
      });
      expect(archived.status).toBe("archived");
      expect(archived.available_now).toBe(false);
      await expect(
        call(db, "map_save_draft", {
          mapId: map.id,
          expectedRevision: edited.draft_revision + 1,
          layout: layout2,
        }),
      ).rejects.toThrow("INVALID_TRANSITION");
      expect(
        (await call(db, "map_archive", { mapId: map.id, archived: false }))
          .status,
      ).toBe("published");
    } finally {
      await db.close();
    }
  });

  it("clientes ven solo mapas publicados y disponibles; las ediciones solo la noche de su fecha", async () => {
    const db = await database();
    try {
      await withTeam(db);
      const permanent = await publishedMap(db);
      await actor(db, ids.admin, "admin-device", false);
      const draftOnly = await call(db, "map_create", {
        venueId: ids.venue,
        name: "Borrador",
      });
      const night = (
        await db.query<{ d: string }>(
          "select public.business_date_at(now())::text as d",
        )
      ).rows[0].d;
      const tomorrow = (
        await db.query<{ d: string }>(
          "select (public.business_date_at(now())+1)::text as d",
        )
      ).rows[0].d;
      const edition = async (name: string, eventDate: string) => {
        const created = await call(db, "map_create", {
          venueId: ids.venue,
          name,
          kind: "edition",
          eventDate,
          eventName: "Festival",
          siteLabel: "Sede Norte",
        });
        const saved = await call(db, "map_save_draft", {
          mapId: created.id,
          expectedRevision: 1,
          imagePath,
          imageWidth: 1000,
          imageHeight: 800,
          layout: baseLayout(),
        });
        await call(db, "map_publish", {
          mapId: created.id,
          expectedRevision: saved.draft_revision,
        });
        return created.id as string;
      };
      await expect(
        call(db, "map_create", {
          venueId: ids.venue,
          name: "Sin fecha",
          kind: "edition",
        }),
      ).rejects.toThrow("INVALID_MAP");
      const today = await edition("Edición de hoy", night);
      await edition("Edición de mañana", tomorrow);
      await actor(db);
      const visible = (await callUuid(
        db,
        "map_for_venue",
        ids.venue,
      )) as unknown as Json[];
      expect(visible.map((m) => m.id).sort()).toEqual(
        [permanent.id, today].sort(),
      );
      expect(visible.find((m) => m.id === today)?.site_label).toBe(
        "Sede Norte",
      );
      expect(visible.some((m) => m.id === draftOnly.id)).toBe(false);
      // El plano de otro local no aparece al consultar este.
      expect(await callUuid(db, "map_for_venue", ids.patio)).toEqual([]);
    } finally {
      await db.close();
    }
  });

  it("duplicar copia imagen y plano como borrador nuevo, sin versiones, solo dentro del mismo local", async () => {
    const db = await database();
    try {
      await withTeam(db);
      const source = await publishedMap(db);
      await actor(db, ids.admin, "admin-device", false);
      const copy = await call(db, "map_duplicate", {
        mapId: source.id,
        name: "Edición 2027",
        kind: "edition",
        eventDate: "2027-03-12",
        siteLabel: "Sede Sur",
      });
      expect(copy.id).not.toBe(source.id);
      expect(copy.status).toBe("draft");
      expect(copy.published_version).toBeNull();
      expect(copy.versions).toEqual([]);
      expect(copy.event_date).toBe("2027-03-12");
      const full = await callUuid(db, "map_admin_get", copy.id);
      expect(full.layout).toEqual(baseLayout());
      expect(full.image_path).toBe(imagePath);
      // Editar la copia no toca el original.
      await call(db, "map_save_draft", {
        mapId: copy.id,
        expectedRevision: 1,
        layout: { elements: [], zones: [] },
      });
      expect((await callUuid(db, "map_admin_get", source.id)).layout).toEqual(
        baseLayout(),
      );
      await actor(db, otherAdmin, "other-device", false);
      await expect(
        call(db, "map_duplicate", { mapId: source.id }),
      ).rejects.toThrow("NOT_AUTHORIZED");
    } finally {
      await db.close();
    }
  });
});

async function orderWithMap(
  db: PGlite,
  key = "loc-order",
  user: string = ids.customer,
) {
  await actor(db, user);
  return command(db, createInput(key));
}
const loc = (mapId: string, orderId: string, extra: Json) => ({
  orderId,
  mapId,
  method: "location_on_map",
  ...extra,
});

describe("ubicación del pedido", () => {
  it("guarda coordenadas normalizadas con mapa, versión y zona; mesa y QR de mesa también", async () => {
    const db = await database();
    try {
      const map = await publishedMap(db);
      const order = await orderWithMap(db);
      const view = await call(
        db,
        "order_location_set",
        loc(map.id, order.id as string, { x: 0.42, y: 0.68 }),
      );
      expect(view.location).toMatchObject({
        order_id: order.id,
        map_id: map.id,
        map_version: 1,
        location: { x: 0.42, y: 0.68 },
        zone_id: null,
        delivery_method: "location_on_map",
        map_name: "Planta baja",
      });
      expect(view.location.reference_label).toBeTruthy();
      expect(view.location_updated_at).toBeTruthy();
      // Dentro de la zona VIP: queda registrada y la zona gana a "ninguna".
      const vip = await call(
        db,
        "order_location_set",
        loc(map.id, order.id as string, { x: 0.7, y: 0.6 }),
      );
      expect(vip.location).toMatchObject({
        zone_id: "vip",
        zone_name: "Zona VIP",
      });
      // Mesa elegida directamente (y la misma vía que el QR de mesa): usa las coordenadas de la mesa, no las del cliente.
      const table = await call(db, "order_location_set", {
        orderId: order.id,
        mapId: map.id,
        method: "table",
        tableId: "t1",
        x: 0.99,
        y: 0.99,
      });
      expect(table.location).toMatchObject({
        delivery_method: "table",
        element_id: "t1",
        element_label: "Mesa 1",
        location: { x: 0.2, y: 0.3 },
      });
      const qr = await call(db, "order_location_set", {
        orderId: order.id,
        mapId: map.id,
        method: "table_qr",
        tableId: "t2",
      });
      expect(qr.location).toMatchObject({
        delivery_method: "table_qr",
        element_label: "Mesa 2",
        zone_id: "vip",
      });
      // Una sola fila por pedido: corregir reemplaza, no duplica.
      await db.exec("reset role");
      expect(
        (
          await db.query(
            "select count(*)::int as n from public.order_locations",
          )
        ).rows[0],
      ).toEqual({ n: 1 });
    } finally {
      await db.close();
    }
  });

  it("rechaza fuera del plano, tipos inválidos, zonas restringidas, mesas inexistentes y mapas de otro local", async () => {
    const db = await database();
    try {
      await withTeam(db);
      const map = await publishedMap(db);
      const patioMap = await publishedMap(db, baseLayout(), ids.patio);
      const order = await orderWithMap(db);
      const set = (extra: Json, mapId: string = map.id) =>
        call(db, "order_location_set", loc(mapId, order.id as string, extra));
      for (const point of [
        { x: 1.0001, y: 0.5 },
        { x: -0.0001, y: 0.5 },
        { x: 0.5, y: 2 },
        { x: 0.5, y: -1 },
      ])
        await expect(set(point)).rejects.toThrow("LOCATION_OUT_OF_MAP");
      for (const point of [
        { x: "0.5", y: 0.5 },
        { x: null, y: 0.5 },
        { y: 0.5 },
        {},
      ])
        await expect(set(point)).rejects.toThrow("INVALID_INPUT");
      await expect(set({ x: 0.05, y: 0.05 })).rejects.toThrow(
        "LOCATION_RESTRICTED",
      ); // cocina
      await expect(
        call(db, "order_location_set", {
          orderId: order.id,
          mapId: map.id,
          method: "table",
          tableId: "no-existe",
        }),
      ).rejects.toThrow("LOCATION_OUT_OF_MAP");
      await expect(
        call(db, "order_location_set", {
          orderId: order.id,
          mapId: map.id,
          method: "table",
          tableId: "bar",
        }),
      ).rejects.toThrow("LOCATION_OUT_OF_MAP"); // no es mesa
      await expect(
        call(db, "order_location_set", {
          orderId: order.id,
          mapId: map.id,
          method: "teleport",
        }),
      ).rejects.toThrow("INVALID_INPUT");
      // El mapa del Patio no sirve para un pedido de Sala Norte, aunque exista y esté publicado.
      await expect(set({ x: 0.5, y: 0.5 }, patioMap.id)).rejects.toThrow(
        "MAP_UNAVAILABLE",
      );
      await expect(
        set({ x: 0.5, y: 0.5 }, "00000000-0000-4000-8000-000000000000"),
      ).rejects.toThrow("MAP_UNAVAILABLE");
      await expect(set({ x: 0.5, y: 0.5 }, "no-es-uuid")).rejects.toThrow(
        "INVALID_INPUT",
      );
      await db.exec("reset role");
      expect(
        (
          await db.query(
            "select count(*)::int as n from public.order_locations",
          )
        ).rows[0],
      ).toEqual({ n: 0 });
    } finally {
      await db.close();
    }
  });

  it("con zonas de entrega permitida solo se entrega dentro de ellas", async () => {
    const db = await database();
    try {
      const layout = baseLayout();
      layout.zones.push({
        id: "terraza",
        name: "Terraza",
        kind: "general",
        delivery: "allow",
        points: rect(0.3, 0.3, 0.6, 0.6),
      });
      const map = await publishedMap(db, layout);
      const order = await orderWithMap(db);
      const set = (extra: Json) =>
        call(db, "order_location_set", loc(map.id, order.id as string, extra));
      expect((await set({ x: 0.45, y: 0.45 })).location.zone_id).toBe(
        "terraza",
      );
      await expect(set({ x: 0.9, y: 0.1 })).rejects.toThrow(
        "LOCATION_RESTRICTED",
      );
      await expect(set({ x: 0.7, y: 0.6 })).rejects.toThrow(
        "LOCATION_RESTRICTED",
      ); // VIP no es zona permitida en este plano
      await expect(
        call(db, "order_location_set", {
          orderId: order.id,
          mapId: map.id,
          method: "table",
          tableId: "t1",
        }),
      ).rejects.toThrow("LOCATION_RESTRICTED");
    } finally {
      await db.close();
    }
  });

  it("la comprobación previa del checkout valida sin escribir nada", async () => {
    const db = await database();
    try {
      const map = await publishedMap(db);
      await actor(db);
      const ok = await call(db, "order_location_validate", {
        venueId: ids.venue,
        mapId: map.id,
        method: "location_on_map",
        x: 0.3,
        y: 0.3,
      });
      expect(ok).toMatchObject({
        map_id: map.id,
        map_version: 1,
        x: 0.3,
        y: 0.3,
      });
      await expect(
        call(db, "order_location_validate", {
          venueId: ids.venue,
          mapId: map.id,
          method: "location_on_map",
          x: 0.05,
          y: 0.05,
        }),
      ).rejects.toThrow("LOCATION_RESTRICTED");
      await expect(
        call(db, "order_location_validate", {
          venueId: ids.patio,
          mapId: map.id,
          method: "location_on_map",
          x: 0.3,
          y: 0.3,
        }),
      ).rejects.toThrow("MAP_UNAVAILABLE");
      await db.exec("reset role");
      expect(
        (
          await db.query(
            "select count(*)::int as n from public.order_locations",
          )
        ).rows[0],
      ).toEqual({ n: 0 });
    } finally {
      await db.close();
    }
  });

  it("solo el cliente dueño la cambia, mientras el pedido siga activo y sin retiro en curso", async () => {
    const db = await database();
    try {
      const map = await publishedMap(db);
      const order = await orderWithMap(db);
      const orderId = order.id as string;
      const place = { x: 0.4, y: 0.5 };
      // Otro cliente y el personal (incluido el administrador) no la fijan ni la borran.
      for (const [user, session, anonymous] of [
        [ids.other, "x", true],
        [ids.staff, "bar", false],
        [ids.admin, "adm", false],
      ] as const) {
        await actor(db, user, session, anonymous);
        await expect(
          call(db, "order_location_set", loc(map.id, orderId, place)),
        ).rejects.toThrow("NOT_AUTHORIZED");
        await expect(
          call(db, "order_location_clear", { orderId }),
        ).rejects.toThrow("NOT_AUTHORIZED");
      }
      await actor(db);
      await call(db, "order_location_set", loc(map.id, orderId, place));
      expect(
        (await call(db, "order_location_clear", { orderId })).location,
      ).toBeNull();
      expect(
        (await call(db, "order_location_clear", { orderId })).location,
      ).toBeNull(); // idempotente
      await call(db, "order_location_set", loc(map.id, orderId, place));

      // Cancelado: ya no se puede cambiar.
      await command(db, {
        action: "cancel",
        orderId,
        expectedVersion: 1,
        idempotencyKey: "cancel-loc",
        reason: "ya no quiero",
      });
      await expect(
        call(db, "order_location_set", loc(map.id, orderId, place)),
      ).rejects.toThrow("LOCATION_LOCKED");
      await expect(
        call(db, "order_location_clear", { orderId }),
      ).rejects.toThrow("LOCATION_LOCKED");
      // …pero la ubicación registrada se conserva para el historial.
      expect(
        (await command(db, { action: "get", orderId })).location,
      ).toMatchObject({ map_id: map.id, location: place });
    } finally {
      await db.close();
    }
  });
});

describe("privacidad entre clientes y locales", () => {
  it("cada cliente ve solo su ubicación; el equipo, solo la de su local", async () => {
    const db = await database();
    try {
      await withTeam(db);
      const map = await publishedMap(db);
      const mine = await orderWithMap(db, "mine");
      const theirs = await orderWithMap(db, "theirs", ids.other);
      await actor(db);
      await call(
        db,
        "order_location_set",
        loc(map.id, mine.id as string, { x: 0.31, y: 0.32 }),
      );
      await actor(db, ids.other);
      await call(
        db,
        "order_location_set",
        loc(map.id, theirs.id as string, { x: 0.71, y: 0.72 }),
      );

      // El otro cliente no puede leer el pedido ajeno ni su ubicación, ni por get ni por listado.
      await expect(
        command(db, { action: "get", orderId: mine.id }),
      ).rejects.toThrow("NOT_AUTHORIZED");
      const own = (
        await db.query<{ r: Json[] }>("select public.order_list() as r")
      ).rows[0].r;
      expect(own).toHaveLength(1);
      expect(own[0].location.location).toEqual({ x: 0.71, y: 0.72 });
      expect(JSON.stringify(own)).not.toContain("0.31");

      // El equipo del local ve las dos (con su zona), el de otro local ninguna.
      await actor(db, ids.staff, "bar", false);
      const staffView = (
        await db.query<{ r: Json[] }>("select public.order_list($1) as r", [
          ids.venue,
        ])
      ).rows[0].r;
      expect(staffView.map((o) => o.location.location.x).sort()).toEqual([
        0.31, 0.71,
      ]);
      await actor(db, otherAdmin, "other-device", false);
      await expect(
        db.query("select public.order_list($1) as r", [ids.venue]),
      ).rejects.toThrow("NOT_AUTHORIZED");
      await expect(
        command(db, { action: "get", orderId: mine.id }),
      ).rejects.toThrow("NOT_AUTHORIZED");
      const patioStaff = (
        await db.query<{ r: Json[] }>("select public.order_list($1) as r", [
          ids.patio,
        ])
      ).rows[0].r;
      expect(patioStaff).toEqual([]);
      // La versión del plano de un pedido tampoco se lee desde otro local.
      await expect(
        callUuid(db, "map_version_get", map.id, 1),
      ).resolves.toBeTruthy(); // vigente y publicada: es lo que ve cualquier cliente
    } finally {
      await db.close();
    }
  });

  it("una versión antigua solo la leen el equipo y el dueño del pedido que la usó", async () => {
    const db = await database();
    try {
      await withTeam(db);
      const map = await publishedMap(db);
      const order = await orderWithMap(db);
      await actor(db);
      await call(
        db,
        "order_location_set",
        loc(map.id, order.id as string, { x: 0.5, y: 0.5 }),
      );
      // El administrador publica un plano nuevo (versión 2).
      await actor(db, ids.admin, "admin-device", false);
      const draft = await callUuid(db, "map_admin_get", map.id);
      const next = baseLayout();
      next.elements.push({
        id: "t9",
        type: "table",
        label: "Mesa 9",
        x: 0.9,
        y: 0.2,
      });
      const saved = await call(db, "map_save_draft", {
        mapId: map.id,
        expectedRevision: draft.draft_revision,
        layout: next,
      });
      await call(db, "map_publish", {
        mapId: map.id,
        expectedRevision: saved.draft_revision,
      });

      await actor(db);
      expect(
        (await callUuid(db, "map_version_get", map.id, 1)).layout.elements,
      ).toHaveLength(3); // su pedido usó la 1
      await actor(db, ids.other);
      await expect(callUuid(db, "map_version_get", map.id, 1)).rejects.toThrow(
        "NOT_AUTHORIZED",
      );
      expect(
        (await callUuid(db, "map_version_get", map.id, 2)).layout.elements,
      ).toHaveLength(4);
      await actor(db, otherAdmin, "other-device", false);
      await expect(callUuid(db, "map_version_get", map.id, 1)).rejects.toThrow(
        "NOT_AUTHORIZED",
      );
      await actor(db, ids.staff, "bar", false);
      expect(
        (await callUuid(db, "map_version_get", map.id, 1)).layout.elements,
      ).toHaveLength(3);
    } finally {
      await db.close();
    }
  });
});

describe("historial al actualizar el plano", () => {
  it("el pedido conserva su versión y su punto; corregir lo mueve a la versión vigente", async () => {
    const db = await database();
    try {
      const map = await publishedMap(db);
      const order = await orderWithMap(db);
      await actor(db);
      await call(
        db,
        "order_location_set",
        loc(map.id, order.id as string, { x: 0.62, y: 0.66 }),
      );
      await actor(db, ids.admin, "admin-device", false);
      const draft = await callUuid(db, "map_admin_get", map.id);
      // Plano nuevo: otra imagen, y la zona restringida ahora cubre el punto del pedido anterior.
      const replaced = baseLayout();
      replaced.zones[1] = {
        id: "kitchen",
        name: "Cocina",
        kind: "general",
        delivery: "restrict",
        points: rect(0.5, 0.5, 0.7, 0.7),
      };
      const saved = await call(db, "map_save_draft", {
        mapId: map.id,
        expectedRevision: draft.draft_revision,
        imagePath: `${ids.venue}/plano-2.webp`,
        imageWidth: 2000,
        imageHeight: 1200,
        layout: replaced,
      });
      await call(db, "map_publish", {
        mapId: map.id,
        expectedRevision: saved.draft_revision,
      });

      await actor(db);
      const after = await command(db, { action: "get", orderId: order.id });
      expect(after.location).toMatchObject({
        map_version: 1,
        location: { x: 0.62, y: 0.66 },
      });
      // Corregir ahora se valida contra el plano vigente (versión 2) y la nueva zona restringida.
      await expect(
        call(
          db,
          "order_location_set",
          loc(map.id, order.id as string, { x: 0.62, y: 0.66 }),
        ),
      ).rejects.toThrow("LOCATION_RESTRICTED");
      const moved = await call(
        db,
        "order_location_set",
        loc(map.id, order.id as string, { x: 0.8, y: 0.2 }),
      );
      expect(moved.location).toMatchObject({
        map_version: 2,
        location: { x: 0.8, y: 0.2 },
      });
    } finally {
      await db.close();
    }
  });
});

describe("personal por zona", () => {
  it("solo administradores asignan, solo a miembros del local, y el equipo ve a quién corresponde la zona", async () => {
    const db = await database();
    try {
      const map = await publishedMap(db);
      await db.exec("reset role");
      await db.exec(
        `insert into public.staff_accounts(user_id,display_name) values('${ids.staff}','Ana Barra')`,
      );
      await actor(db, ids.admin, "admin-device", false);
      const assigned = await call(db, "map_assign_staff", {
        mapId: map.id,
        zoneId: "vip",
        userIds: [ids.staff],
      });
      expect(assigned.vip).toEqual([{ user_id: ids.staff, name: "Ana Barra" }]);
      await expect(
        call(db, "map_assign_staff", {
          mapId: map.id,
          zoneId: "vip",
          userIds: [ids.customer],
        }),
      ).rejects.toThrow("NOT_MEMBER");
      await expect(
        call(db, "map_assign_staff", {
          mapId: map.id,
          zoneId: "no-existe",
          userIds: [],
        }),
      ).rejects.toThrow("INVALID_INPUT");
      await actor(db, ids.staff, "bar", false);
      await expect(
        call(db, "map_assign_staff", {
          mapId: map.id,
          zoneId: "vip",
          userIds: [],
        }),
      ).rejects.toThrow("NOT_AUTHORIZED");

      const order = await orderWithMap(db);
      await actor(db);
      const mine = await call(
        db,
        "order_location_set",
        loc(map.id, order.id as string, { x: 0.7, y: 0.6 }),
      );
      expect(mine.location.assigned_staff).toEqual([]); // el cliente no ve al personal
      await actor(db, ids.staff, "bar", false);
      const staffSees = (
        await db.query<{ r: Json[] }>("select public.order_list($1) as r", [
          ids.venue,
        ])
      ).rows[0].r;
      expect(staffSees[0].location.assigned_staff).toEqual(["Ana Barra"]);
      // Quitar la zona del plano limpia la asignación; quitar a la persona del equipo también.
      await actor(db, ids.admin, "admin-device", false);
      const draft = await callUuid(db, "map_admin_get", map.id);
      await call(db, "map_save_draft", {
        mapId: map.id,
        expectedRevision: draft.draft_revision,
        layout: { elements: [], zones: [] },
      });
      expect(
        (await callUuid(db, "map_admin_get", map.id)).zone_staff.vip,
      ).toHaveLength(1); // aún existe en la versión publicada
      await db.exec("reset role");
      await db.exec(
        `delete from public.memberships where user_id='${ids.staff}'`,
      );
      expect(
        (
          await db.query(
            "select count(*)::int as n from public.venue_map_zone_staff",
          )
        ).rows[0],
      ).toEqual({ n: 0 });
    } finally {
      await db.close();
    }
  });
});

describe("entrega con código válido", () => {
  it("solo se marca entregado después de validar el código; con retiro en curso la ubicación se bloquea", async () => {
    const db = await database();
    try {
      const map = await publishedMap(db);
      const order = await orderWithMap(db, "entrega");
      const orderId = order.id as string;
      await actor(db);
      await call(
        db,
        "order_location_set",
        loc(map.id, orderId, { x: 0.4, y: 0.4 }),
      );
      await actor(db, ids.staff, "bar-device", false);
      await command(db, {
        action: "accept",
        orderId,
        expectedVersion: 1,
        idempotencyKey: "a",
      });
      await command(db, {
        action: "ready",
        orderId,
        expectedVersion: 2,
        idempotencyKey: "r",
      });
      const view = await command(db, { action: "get", orderId });
      expect(view.location).toMatchObject({ location: { x: 0.4, y: 0.4 } }); // el equipo la ve para llegar al cliente
      expect(view.claim_id).toBeNull();

      // Sin validar el código no hay entrega: ni con el pedido listo y la ubicación a la vista.
      await expect(
        command(db, {
          action: "complete",
          orderId,
          claimId: "00000000-0000-4000-8000-000000000009",
          physicalHandoff: true,
        }),
      ).rejects.toThrow("CLAIM_OWNED_ELSEWHERE");
      await expect(
        command(db, {
          action: "capture",
          orderId,
          claimId: "00000000-0000-4000-8000-000000000009",
        }),
      ).rejects.toThrow("CLAIM_OWNED_ELSEWHERE");
      // Un código equivocado (o el número público del pedido) no resuelve el retiro.
      await expect(
        command(db, {
          action: "resolve",
          venueId: ids.venue,
          code: "aaaaaaaaaaaa",
        }),
      ).rejects.toThrow("INVALID_PICKUP");
      await expect(
        command(db, {
          action: "resolve",
          venueId: ids.venue,
          code: String(order.public_code).padEnd(12, "0"),
        }),
      ).rejects.toThrow("INVALID_PICKUP");
      expect((await command(db, { action: "get", orderId })).status).toBe(
        "ready",
      );

      const code = createHash("sha256")
        .update("entrega")
        .digest("hex")
        .slice(0, 12);
      const claim = await command(db, {
        action: "resolve",
        venueId: ids.venue,
        code,
      });
      expect(claim.claim_id).toBeTruthy();
      // Con el retiro en curso el cliente ya no mueve su marcador.
      await actor(db);
      await expect(
        call(
          db,
          "order_location_set",
          loc(map.id, orderId, { x: 0.5, y: 0.5 }),
        ),
      ).rejects.toThrow("LOCATION_LOCKED");
      await actor(db, ids.staff, "bar-device", false);
      // Otra sesión del equipo, con el mismo código ya validado en otro dispositivo, tampoco puede entregar.
      await actor(db, ids.staff, "otro-dispositivo", false);
      await expect(
        command(db, {
          action: "complete",
          orderId,
          claimId: claim.claim_id,
          physicalHandoff: true,
        }),
      ).rejects.toThrow("CLAIM_OWNED_ELSEWHERE");
      await actor(db, ids.staff, "bar-device", false);
      await command(db, {
        action: "capture",
        orderId,
        claimId: claim.claim_id,
      });
      await expect(
        command(db, { action: "complete", orderId, claimId: claim.claim_id }),
      ).rejects.toThrow("PHYSICAL_HANDOFF_REQUIRED");
      const done = await command(db, {
        action: "complete",
        orderId,
        claimId: claim.claim_id,
        physicalHandoff: true,
      });
      expect(done.status).toBe("delivered");
      expect(done.location).toMatchObject({
        map_version: 1,
        location: { x: 0.4, y: 0.4 },
      }); // el historial conserva la ubicación
      // El código ya usado no sirve otra vez.
      await expect(
        command(db, { action: "resolve", venueId: ids.venue, code }),
      ).rejects.toThrow("ALREADY_DELIVERED");
    } finally {
      await db.close();
    }
  });
});
