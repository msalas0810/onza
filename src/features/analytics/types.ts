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
