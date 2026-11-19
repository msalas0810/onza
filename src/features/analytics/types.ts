import { z } from "zod";
export const summarySchema = z.object({
  business_date: z.string(),
  timezone: z.string(),
  cutoff: z.string(),
  captured_minor: z.number(),
  refunded_minor: z.number(),
  reserved_minor: z.number(),
  delivered_orders: z.number(),
  preparation_n: z.number(),
  median_preparation_seconds: z.number().nullable(),
  products: z.array(
    z.object({
      product_id: z.string(),
      name_snapshot: z.string(),
      units: z.number(),
      total_minor: z.number(),
    }),
  ),
});
export type VenueSummary = z.infer<typeof summarySchema>;
export const rangeSummarySchema = z.object({
  from: z.string(),
  to: z.string(),
  timezone: z.string(),
  cutoff: z.string(),
  grain: z.enum(["hour", "day", "month"]),
  orders: z.number(),
  delivered_orders: z.number(),
  canceled_orders: z.number(),
  captured_minor: z.number(),
  refunded_minor: z.number(),
  net_minor: z.number(),
  reserved_now_minor: z.number(),
  active_orders: z.number(),
  preparation_n: z.number(),
  median_preparation_seconds: z.number().nullable(),
  p90_preparation_seconds: z.number().nullable(),
  wait_n: z.number(),
  median_wait_seconds: z.number().nullable(),
  series: z.array(
    z.object({ bucket: z.string(), orders: z.number(), net_minor: z.number() }),
  ),
  products: z.array(
    z.object({
      product_id: z.string(),
      name_snapshot: z.string(),
      units: z.number(),
      total_minor: z.number(),
    }),
  ),
});
export type RangeSummary = z.infer<typeof rangeSummarySchema>;
