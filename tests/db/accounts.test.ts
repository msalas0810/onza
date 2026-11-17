import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { actor, command, createInput, database, ids } from "./helpers";
const profile = (extra: Record<string, unknown> = {}) => ({
  fullName: "Ana Rojas",
  username: "AnaRojas",
  phoneCountry: "+506",
  phone: "8888 1234",
  birthDate: "2000-03-05",
  termsVersion: "borrador-1",
  privacyVersion: "borrador-1",
  accepted: "true",
  ...extra,
});
async function onboard(
  db: Awaited<ReturnType<typeof database>>,
  input: object,
) {
  return db.query("select public.complete_onboarding($1::jsonb) as r", [
    JSON.stringify(input),
  ]);
}
describe("cuentas de cliente (migración 010)", () => {
  it("onboarding guarda perfil, teléfono no verificado y aceptación con versión", async () => {
    const db = await database();
    try {
      await actor(db, ids.customer, "phone", false);
      expect(
        (await db.query("select public.current_account() as r")).rows[0],
      ).toMatchObject({ r: { kind: "customer", onboarded: false } });
      await onboard(db, profile());
      const { rows } = await db.query<Record<string, unknown>>(
        "select * from public.profiles",
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        username: "anarojas",
        phone_e164: "+50688881234",
        phone_verified: false,
        terms_version: "borrador-1",
        news_opt_in: false,
        offers_opt_in: false,
      });
      expect(rows[0].terms_accepted_at).toBeTruthy();
      expect(
        (await db.query("select public.current_account() as r")).rows[0],
      ).toMatchObject({ r: { kind: "customer", onboarded: true } });
    } finally {
      await db.close();
    }
  });
  it("rechaza menores, términos sin aceptar, usuario repetido, teléfono inválido y fecha futura", async () => {
    const db = await database();
    try {
      const adult = new Date();
      adult.setFullYear(adult.getFullYear() - 17);
      await actor(db, ids.customer, "a", false);
      await expect(
        onboard(db, profile({ birthDate: adult.toISOString().slice(0, 10) })),
      ).rejects.toThrow("UNDERAGE");
      await expect(onboard(db, profile({ accepted: "false" }))).rejects.toThrow(
        "TERMS_REQUIRED",
      );
      await expect(onboard(db, profile({ phone: "12" }))).rejects.toThrow(
        "INVALID_PHONE",
      );
      await expect(
        onboard(db, profile({ birthDate: "2999-01-01" })),
      ).rejects.toThrow("INVALID_BIRTH_DATE");
      await onboard(db, profile());
      await actor(db, ids.other, "b", false);
      await expect(
        onboard(db, profile({ username: "ANAROJAS" })),
      ).rejects.toThrow("USERNAME_TAKEN");
    } finally {
      await db.close();
    }
  });
  it("invitado y cuenta laboral no pueden crear perfil de cliente; el personal no lee perfiles", async () => {
    const db = await database();
    try {
      await actor(db, ids.customer, "a", false);
      await onboard(db, profile());
      await actor(db, ids.other, "guest", true);
      await expect(onboard(db, profile({ username: "otro" }))).rejects.toThrow(
        "NOT_AUTHORIZED",
      );
      await actor(db, ids.staff, "bar", false);
      expect(
        (await db.query("select public.current_account() as r")).rows[0],
      ).toMatchObject({ r: { kind: "staff" } });
      await expect(onboard(db, profile({ username: "barra" }))).rejects.toThrow(
        "STAFF_ACCOUNT",
      );
      expect(
        (await db.query("select * from public.profiles")).rows,
      ).toHaveLength(0);
      await actor(db, ids.other, "c", false);
      expect(
        (await db.query("select * from public.profiles")).rows,
      ).toHaveLength(0);
      await expect(
        db.query("update public.profiles set full_name='x'"),
      ).rejects.toThrow();
    } finally {
      await db.close();
    }
  });
  it("preferencias: desmarcadas por defecto y editables solo por su dueño", async () => {
    const db = await database();
    try {
      await actor(db, ids.customer, "a", false);
      await onboard(db, profile());
      await db.query("select public.update_preferences(true,false)");
      expect(
        (
          await db.query(
            "select news_opt_in,offers_opt_in from public.profiles",
          )
        ).rows[0],
      ).toEqual({ news_opt_in: true, offers_opt_in: false });
      await actor(db, ids.other, "b", false);
      await expect(
        db.query("select public.update_preferences(true,true)"),
      ).rejects.toThrow("PROFILE_REQUIRED");
    } finally {
      await db.close();
    }
  });
});
describe("recorrido con cuentas registradas (dos sesiones independientes)", () => {
  it("cliente registrado → barra acepta → listo → número público no retira → código privado entrega una sola vez", async () => {
    const db = await database();
    try {
      await actor(db, ids.customer, "phone", false);
      await onboard(db, profile());
      const order = await command(db, createInput("registered-1"));
      const privateCode = createHash("sha256")
        .update("registered-1")
        .digest("hex")
        .slice(0, 12);
      await actor(db, ids.staff, "computer", false);
      await command(db, {
        action: "accept",
        orderId: order.id,
        expectedVersion: 1,
        idempotencyKey: "acc-1",
      });
      await command(db, {
        action: "ready",
        orderId: order.id,
        expectedVersion: 2,
        idempotencyKey: "rdy-1",
      });
      const publicNumber = String(
        order.public_number ?? order.number ?? order.public_code ?? "",
      );
      expect(publicNumber).not.toBe("");
      expect(publicNumber.replace(/\W/g, "")).not.toBe(
        privateCode.toUpperCase(),
      );
      await expect(
        command(db, {
          action: "resolve",
          venueId: ids.venue,
          code: publicNumber.replace(/\W/g, "").padEnd(12, "0").slice(0, 12),
        }),
      ).rejects.toThrow();
      const claim = await command(db, {
        action: "resolve",
        venueId: ids.venue,
        code: privateCode,
      });
      await command(db, {
        action: "capture",
        orderId: order.id,
        claimId: claim.claim_id,
      });
      await command(db, {
        action: "complete",
        orderId: order.id,
        claimId: claim.claim_id,
        physicalHandoff: true,
      });
      // El mismo código no puede iniciar una segunda entrega.
      await expect(
        command(db, {
          action: "resolve",
          venueId: ids.venue,
          code: privateCode,
        }),
      ).rejects.toThrow();
      await actor(db, ids.customer, "phone", false);
      expect(
        (await command(db, { action: "get", orderId: order.id })).status,
      ).toBe("delivered");
    } finally {
      await db.close();
    }
  });
  it("la cancelación solo es posible antes de aceptar y otra cuenta no ve el pedido", async () => {
    const db = await database();
    try {
      await actor(db, ids.customer, "phone", false);
      await onboard(db, profile());
      const first = await command(db, createInput("cancel-ok"));
      await command(db, {
        action: "cancel",
        orderId: first.id,
        expectedVersion: 1,
        idempotencyKey: "cancel-1",
        reason: "Cambié de idea",
      });
      const second = await command(db, createInput("cancel-late"));
      await actor(db, ids.other, "other", false);
      await expect(
        command(db, { action: "get", orderId: second.id }),
      ).rejects.toThrow();
      await actor(db, ids.staff, "computer", false);
      await command(db, {
        action: "accept",
        orderId: second.id,
        expectedVersion: 1,
        idempotencyKey: "acc-2",
      });
      await actor(db, ids.customer, "phone", false);
      await expect(
        command(db, {
          action: "cancel",
          orderId: second.id,
          expectedVersion: 2,
          idempotencyKey: "cancel-2",
          reason: "Cambié de idea",
        }),
      ).rejects.not.toThrow("REASON_REQUIRED");
    } finally {
      await db.close();
    }
  });
});
