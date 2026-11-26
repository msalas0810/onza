import "server-only";
import { z } from "zod";
import { requireVenue } from "@/lib/supabase/guards";
import { statusLabels } from "@/features/orders/types";
import { toCsv } from "../csv";

const rowSchema = z.object({
  business_date: z.string(),
  public_code: z.string(),
  status: z.string(),
  created_at: z.string(),
  queued_at: z.string().nullable(),
  preparing_at: z.string().nullable(),
  ready_at: z.string().nullable(),
  delivered_at: z.string().nullable(),
  fulfillment: z.string(),
  spot_label: z.string().nullable(),
  spot_area: z.string().nullable(),
  total_minor: z.number(),
  captured_minor: z.number(),
  refunded_minor: z.number(),
  items: z.string().nullable(),
  delivered_by: z.string().nullable(),
});
export const EXPORT_LIMIT = 5000;

const clock = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Costa_Rica",
  dateStyle: "short",
  timeStyle: "short",
});
const when = (iso: string | null) => (iso ? clock.format(new Date(iso)) : "");
const colones = (minor: number) => (minor / 100).toFixed(2);

const columns = [
  { key: "night", label: "Noche operativa" },
  { key: "code", label: "Pedido" },
  { key: "status", label: "Estado" },
  { key: "fulfillment", label: "Entrega" },
  { key: "spot", label: "Lugar" },
  { key: "area", label: "Zona" },
  { key: "created", label: "Creado" },
  { key: "ready", label: "Listo" },
  { key: "delivered", label: "Entregado" },
  { key: "delivered_by", label: "Entregó" },
  { key: "total", label: "Total (CRC)" },
  { key: "captured", label: "Cobrado (CRC)" },
  { key: "refunded", label: "Devuelto (CRC)" },
  { key: "items", label: "Productos" },
] as const;

/** Pedidos del período para el cierre de caja. Solo administración del local; sin datos de quien pidió. */
export async function exportVenueOrders(venueId: string, from: string, to: string) {
  const { db } = await requireVenue(venueId, true);
  const { data, error } = await db.rpc("venue_orders_export", {
    venue: venueId,
    from_day: from,
    to_day: to,
  });
  if (error) throw new Error(error.message);
  const all = z.array(rowSchema).parse(data);
  const rows = all.slice(0, EXPORT_LIMIT).map((r) => ({
    night: r.business_date,
    code: r.public_code,
    status: statusLabels[r.status as keyof typeof statusLabels] ?? r.status,
    fulfillment: r.fulfillment === "location" ? "En el lugar" : "Barra",
    spot: r.spot_label,
    area: r.spot_area,
    created: when(r.created_at),
    ready: when(r.ready_at),
    delivered: when(r.delivered_at),
    delivered_by: r.delivered_by,
    total: colones(r.total_minor),
    captured: colones(r.captured_minor),
    refunded: colones(r.refunded_minor),
    items: r.items,
  }));
  return { csv: toCsv(columns, rows), count: rows.length, truncated: all.length > EXPORT_LIMIT };
}
