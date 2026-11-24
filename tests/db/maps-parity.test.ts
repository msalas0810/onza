import { expect, it } from "vitest";
import {
  resolveSelection,
  type SelectionInput,
} from "@/features/maps/geometry";
import type { MapLayout } from "@/features/maps/types";
import { database } from "./helpers";

// Las reglas de entrega viven en la base (autoridad) y se repiten en el cliente (guía inmediata). Esta prueba exige que
// ambas decidan igual para cientos de puntos, para que el selector nunca prometa algo que el servidor va a rechazar.
const rect = (x1: number, y1: number, x2: number, y2: number) => [
  { x: x1, y: y1 },
  { x: x2, y: y1 },
  { x: x2, y: y2 },
  { x: x1, y: y2 },
];
const concave = [
  { x: 0.1, y: 0.5 },
  { x: 0.9, y: 0.5 },
  { x: 0.9, y: 0.95 },
  { x: 0.5, y: 0.7 },
  { x: 0.1, y: 0.95 },
];
const elements = [
  { id: "t1", type: "table" as const, label: "Mesa 1", x: 0.2, y: 0.3 },
  { id: "t2", type: "table" as const, label: "Mesa 2", x: 0.8, y: 0.7 },
  { id: "t3", type: "table" as const, label: "Mesa 3", x: 0.5, y: 0.6 },
  { id: "bar", type: "bar" as const, label: "Barra", x: 0.5, y: 0.1 },
  { id: "stage", type: "stage" as const, label: "Escenario", x: 0.9, y: 0.1 },
];
const layouts: Record<string, MapLayout> = {
  "sin zonas": { elements, zones: [] },
  "restringida + vip": {
    elements,
    zones: [
      {
        id: "vip",
        name: "VIP",
        kind: "vip",
        delivery: "default",
        points: rect(0.6, 0.5, 0.95, 0.95),
      },
      {
        id: "general",
        name: "General",
        kind: "general",
        delivery: "default",
        points: rect(0.5, 0.4, 0.8, 0.8),
      },
      {
        id: "kitchen",
        name: "Cocina",
        kind: "general",
        delivery: "restrict",
        points: rect(0, 0, 0.3, 0.2),
      },
    ],
  },
  "lista blanca cóncava": {
    elements,
    zones: [
      {
        id: "terraza",
        name: "Terraza",
        kind: "general",
        delivery: "allow",
        points: concave,
      },
      {
        id: "no",
        name: "Sin entrega",
        kind: "general",
        delivery: "restrict",
        points: rect(0.4, 0.8, 0.6, 0.9),
      },
    ],
  },
};

it("cliente y base deciden igual: misma aceptación, motivo, zona y referencia más cercana", async () => {
  const db = await database();
  try {
    const w = 1600;
    const h = 1000;
    let seed = 12345;
    const random = () =>
      (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    let compared = 0;
    let accepted = 0;
    let rejected = 0;
    for (const [name, layout] of Object.entries(layouts)) {
      const inputs: SelectionInput[] = [
        ...Array.from({ length: 250 }, () => ({
          method: "location_on_map" as const,
          x: random() * 1.1 - 0.05,
          y: random() * 1.1 - 0.05,
        })),
        { method: "location_on_map", x: 0, y: 0 },
        { method: "location_on_map", x: 1, y: 1 },
        ...["t1", "t2", "t3", "bar", "inexistente"].flatMap((tableId) => [
          { method: "table" as const, tableId },
          { method: "table_qr" as const, tableId },
        ]),
      ];
      for (const input of inputs) {
        const client = resolveSelection(layout, { w, h }, input);
        let server:
          | { ok: true; zone: string | null; reference: string | null }
          | { ok: false; code: string };
        try {
          const { rows } = await db.query<{
            r: { zone_id: string | null; reference_id: string | null };
          }>(
            "select private.map_resolve_point($1::jsonb,$2,$3,$4::jsonb) as r",
            [JSON.stringify(layout), w, h, JSON.stringify(input)],
          );
          server = {
            ok: true,
            zone: rows[0].r.zone_id,
            reference: rows[0].r.reference_id,
          };
        } catch (e) {
          server = { ok: false, code: (e as Error).message };
        }
        const label = `${name} ${JSON.stringify(input)}`;
        expect(client.ok, label).toBe(server.ok);
        compared++;
        if (client.ok && server.ok) {
          accepted++;
          expect(client.zone?.id ?? null, label).toBe(server.zone);
          expect(client.reference?.id ?? null, label).toBe(server.reference);
        } else if (!client.ok && !server.ok) {
          rejected++;
          // La base usa un solo código para «fuera del plano» y «mesa inexistente».
          const expected =
            client.reason === "restricted"
              ? "LOCATION_RESTRICTED"
              : "LOCATION_OUT_OF_MAP";
          expect(server.code, label).toContain(expected);
        }
      }
    }
    expect(compared).toBe(786);
    expect(accepted).toBeGreaterThan(100);
    expect(rejected).toBeGreaterThan(100);
  } finally {
    await db.close();
  }
}, 120000);
