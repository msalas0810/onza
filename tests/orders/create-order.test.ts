import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { database, actor, command, createInput, ids } from "../db/helpers";
import type { PGlite } from "@electric-sql/pglite";
let db: PGlite;
beforeAll(async () => {
  db = await database();
});
afterAll(async () => {
  await db?.close();
});
describe("pedido transaccional", () => {
  it("misma clave y payload retorna el mismo pedido y total de servidor", async () => {
    await actor(db);
    const a = await command(db, createInput());
    const b = await command(db, createInput());
    expect(a.id).toBe(b.id);
    expect(a.total_minor).toBe(900000);
    expect(a.status).toBe("queued");
  });
  it("misma clave con otro carrito rechaza", async () => {
    await actor(db);
    await expect(
      command(
        db,
        createInput("order-one", {
          items: [
            { productId: ids.product, quantity: 3, expectedProductVersion: 1 },
          ],
        }),
      ),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });
  it("cantidad, precio, disponibilidad y local se verifican", async () => {
    await actor(db);
    await expect(
      command(
        db,
        createInput("quantity", {
          items: [
            { productId: ids.product, quantity: 11, expectedProductVersion: 1 },
          ],
        }),
      ),
    ).rejects.toThrow("INVALID_QUANTITY");
    await expect(
      command(
        db,
        createInput("price", {
          items: [
            { productId: ids.product, quantity: 1, expectedProductVersion: 99 },
          ],
        }),
      ),
    ).rejects.toThrow("PRICE_CHANGED");
    await expect(
      command(db, createInput("cross", { venueId: ids.patio })),
    ).rejects.toThrow("OUT_OF_STOCK");
  });
  it("decline no entra a cola y requires_action espera confirmación", async () => {
    await actor(db);
    expect(
      (await command(db, createInput("decline", { scenario: "declined" })))
        .status,
    ).toBe("canceled");
    const pending = await command(
      db,
      createInput("action", { scenario: "requires_action" }),
    );
    expect(pending.status).toBe("pending_authorization");
    expect(
      (await command(db, { action: "authorize_action", orderId: pending.id }))
        .status,
    ).toBe("queued");
  });
  it("timeout sin referencia conserva unknown y no reautoriza", async () => {
    await actor(db);
    const input = createInput("timeout", { scenario: "timeout" });
    const a = await command(db, input);
    const b = await command(db, input);
    expect(a.id).toBe(b.id);
    expect(a.payment_state).toBe("unknown");
    expect(a.status).toBe("pending_authorization");
  });
});
