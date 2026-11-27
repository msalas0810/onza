import { describe, expect, it } from "vitest";
import { slowPreparation } from "@/features/admin/attention";
import type { Order } from "@/features/orders/types";

const at = Date.parse("2026-11-27T03:00:00Z");
const order = (status: string, minutesAgo: number) =>
  ({ status, created_at: new Date(at - 60 * 60000).toISOString(), preparing_at: new Date(at - minutesAgo * 60000).toISOString() }) as Order;

describe("retraso en preparación", () => {
  it("nada bajo el aviso, ni pedidos que no están en preparación", () => {
    expect(slowPreparation([order("preparing", 9), order("queued", 40), order("ready", 40)], at)).toBeNull();
  });
  it("aviso desde 10 min y alerta desde 15 según el más atrasado", () => {
    expect(slowPreparation([order("preparing", 10)], at)).toEqual({ count: 1, worst: 10, tone: "warning" });
    expect(slowPreparation([order("preparing", 12), order("preparing", 16)], at)).toEqual({ count: 2, worst: 16, tone: "danger" });
  });
});
