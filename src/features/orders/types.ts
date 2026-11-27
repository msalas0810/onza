import { z } from "zod";
export const orderSchema = z.object({
  id: z.string(),
  venue_id: z.string(),
  customer_id: z.string(),
  public_code: z.string(),
  status: z.enum([
    "pending_authorization",
    "queued",
    "preparing",
    "ready",
    "delivered",
    "canceled",
    "expired",
    "uncollected",
  ]),
  total_minor: z.number(),
  currency: z.literal("CRC"),
  version: z.number(),
  payment_state: z.string(),
  capture_state: z.string().nullable().optional(),
  authorized_minor: z.number(),
  captured_minor: z.number(),
  refunded_minor: z.number(),
  created_at: z.string(),
  preparing_at: z.string().nullable(),
  ready_at: z.string().nullable(),
  delivered_at: z.string().nullable(),
  deadline: z.string(),
  // Entrada a la cola de barra (inicio del plazo de aceptación) y hora del servidor al responder. Opcionales: una base sin la
  // migración 013 no los envía.
  queued_at: z.string().nullable().optional(),
  server_now: z.string().optional(),
  business_date: z.string(),
  // Entrega en el lugar (migración 025). Opcionales: una base sin esa migración no los envía y todo es retiro en barra.
  fulfillment: z.enum(["bar", "location"]).optional(),
  spot_id: z.string().nullable().optional(),
  spot_label: z.string().nullable().optional(),
  spot_area: z.string().nullable().optional(),
  spot_changed_at: z.string().nullable().optional(),
  /** Pin marcado en el mapa (relativo a la imagen, 0 a 1) y la versión del mapa en que se marcó. */
  map_id: z.string().nullable().optional(),
  map_x: z.number().nullable().optional(),
  map_y: z.number().nullable().optional(),
  map: z
    .object({
      id: z.string(),
      image_url: z.string(),
      width: z.number(),
      height: z.number(),
      current: z.boolean(),
    })
    .nullable()
    .optional(),
  // Solo para el equipo del local: quién registró la entrega.
  delivered_by_name: z.string().nullable().optional(),
  claim_id: z.string().nullable(),
  claimed_elsewhere: z.boolean().nullable(),
  encrypted_token: z.string().nullable().optional(),
  pickup_token: z.string().optional(),
  qr_data_url: z.string().optional(),
  pickup_code: z.string().optional(),
  ticket_error: z.enum(["unavailable", "qr_unavailable"]).optional(),
  venue: z.object({
    id: z.string(),
    name: z.string(),
    pickup_label: z.string(),
    support_contact: z.string(),
    eta_minutes: z.number(),
    slug: z.string().optional(),
    open_state: z.string().optional(),
    paused: z.boolean().optional(),
    delivery_mode: z.enum(["bar", "both", "location"]).optional(),
    spot_noun: z.string().optional(),
  }),
  items: z.array(
    z.object({
      id: z.string(),
      product_id: z.string(),
      name_snapshot: z.string(),
      unit_price_minor_snapshot: z.number(),
      quantity: z.number(),
      line_total_minor: z.number(),
      image_url: z.string().nullable().optional(),
      photo_path: z.string().nullable().optional(),
    }),
  ),
  events: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      created_at: z.string(),
      to_status: z.string().nullable(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
});
export type Order = z.infer<typeof orderSchema>;
export const statusLabels: Record<Order["status"], string> = {
  pending_authorization: "Confirmando pedido",
  queued: "Recibido · esperando al local",
  preparing: "Preparando",
  ready: "Listo para retirar",
  delivered: "Entregado",
  canceled: "Cancelado",
  expired: "Pedido vencido",
  uncollected: "No recogido",
};
/** Un pedido que se entrega en el lugar no «se retira»: lo lleva el equipo. */
export const orderStatusLabel = (
  order: Pick<Order, "status" | "fulfillment">,
) =>
  order.status === "ready" && order.fulfillment === "location"
    ? "Listo · te lo llevamos"
    : statusLabels[order.status];
export const paymentLabels: Record<string, string> = {
  authorizing: "Confirmando pedido",
  authorized: "Pago pendiente en el local",
  capture_pending: "Registrando el pago",
  captured: "Pago registrado",
  void_pending: "Anulando el pago pendiente",
  voided: "Sin pago",
  failed: "Pago rechazado",
  unknown: "Resultado sin confirmar",
  refunded: "Devolución registrada",
  refund_pending: "Devolución en proceso",
};
