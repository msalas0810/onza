import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { actor, command, createInput, database, ids } from "./helpers";

type Db = Awaited<ReturnType<typeof database>>;

const CATEGORY = "ad46cb30-426b-52bb-8358-ac044919d89a"; // categoría «Cocteles» del local de prueba
const MISSING = "99999999-0000-4000-8000-000000000000";

/** Prueba de base: el dueño del esquema lee y prepara datos sin las restricciones de RLS. */
async function owner<T = Record<string, unknown>>(
  db: Db,
  sql: string,
  params: unknown[] = [],
) {
  await db.exec("reset role");
  return (await db.query<T>(sql, params)).rows;
}

async function setup() {
  const db = await database();
  await owner(
    db,
    `insert into public.profiles(user_id,full_name,username,phone_country,phone_e164,birth_date,terms_version,privacy_version,terms_accepted_at)
     values('${ids.customer}','Sofía Vargas','sofiav','+506','+50688887777','1990-01-01','demo-v1','demo-v1',now())`,
  );
  return db;
}

async function asAdmin(db: Db) {
  await actor(db, ids.admin, "admin-device", false);
}

async function saveProgram(db: Db, input: Record<string, unknown> = {}) {
  await asAdmin(db);
  return (
    await db.query<{ r: Record<string, unknown> }>(
      "select public.loyalty_program_save($1::jsonb) as r",
      [
        JSON.stringify({
          venueId: ids.venue,
          enabled: true,
          basePercent: 10,
          pointsValidDays: 180,
          ...input,
        }),
      ],
    )
  ).rows[0].r;
}

async function saveRule(db: Db, input: Record<string, unknown>) {
  await asAdmin(db);
  return (
    await db.query<{ r: Record<string, unknown> }>(
      "select public.loyalty_rule_save($1::jsonb) as r",
      [JSON.stringify({ venueId: ids.venue, active: true, ...input })],
    )
  ).rows[0].r;
}

async function saveCampaign(db: Db, input: Record<string, unknown>) {
  await asAdmin(db);
  return (
    await db.query<{ r: Record<string, unknown> }>(
      "select public.loyalty_campaign_save($1::jsonb) as r",
      [JSON.stringify({ venueId: ids.venue, active: true, ...input })],
    )
  ).rows[0].r;
}

/** Hora y día ISO actuales en Costa Rica, para construir reglas que sí o no apliquen ahora. */
async function nowCR(db: Db) {
  const [row] = await owner<{ h: number; d: number }>(
    db,
    "select extract(hour from now() at time zone 'America/Costa_Rica')::int as h, extract(isodow from now() at time zone 'America/Costa_Rica')::int as d",
  );
  return row;
}

/** Pedido real hasta cobro capturado: cliente crea, barra acepta y marca listo, y el cobro se confirma con el código. */
async function paidOrder(db: Db, key: string, customer: string = ids.customer) {
  await actor(db, customer, `device-${key}`, false);
  const made = await command(db, createInput(key));
  await actor(db, ids.staff, `bar-${key}`, false);
  await command(db, {
    action: "accept",
    orderId: made.id,
    expectedVersion: made.version,
    idempotencyKey: `acc-${key}`,
  });
  await command(db, {
    action: "ready",
    orderId: made.id,
    expectedVersion: 2,
    idempotencyKey: `rdy-${key}`,
  });
  const claim = await command(db, {
    action: "resolve",
    venueId: ids.venue,
    code: createHash("sha256").update(key).digest("hex").slice(0, 12),
  });
  await command(db, {
    action: "capture",
    orderId: made.id,
    claimId: claim.claim_id,
  });
  const [order] = await owner<{ total_minor: number }>(
    db,
    "select total_minor from public.orders where id=$1",
    [made.id],
  );
  return { orderId: made.id as string, total: order.total_minor };
}

async function earnRows(db: Db, orderId: string) {
  return owner<{
    kind: string;
    points: number;
    funder: string;
    campaign_id: string | null;
  }>(
    db,
    "select kind,points,funder,campaign_id from private.loyalty_ledger where order_id=$1 and kind in ('earn','reversal') order by kind",
    [orderId],
  );
}

async function balance(db: Db, customer = ids.customer) {
  await actor(db, customer, `acct-${customer}`, false);
  const r = (
    await db.query<{ r: { balances: { venueId: string; points: number }[] } }>(
      "select public.loyalty_account() as r",
    )
  ).rows[0].r;
  return r.balances.find((b) => b.venueId === ids.venue)?.points ?? 0;
}

async function summary(db: Db) {
  await asAdmin(db);
  return (
    await db.query<{
      r: {
        issued: number;
        reversed: number;
        expired: number;
        redeemed: number;
        outstanding: number;
        by_funder: Record<string, number>;
      };
    }>("select public.loyalty_summary($1) as r", [ids.venue])
  ).rows[0].r;
}

async function fails(promise: Promise<unknown>, text: string) {
  await expect(promise).rejects.toThrow(text);
}

describe("fidelización · configuración por local", () => {
  it("solo la administración del local configura; empleados, clientes y otros locales no", async () => {
    const db = await setup();
    try {
      await actor(db, ids.staff, "bar-config", false);
      await fails(
        db.query("select public.loyalty_config($1) as r", [ids.venue]),
        "NOT_AUTHORIZED",
      );
      await fails(
        db.query("select public.loyalty_program_save($1::jsonb) as r", [
          JSON.stringify({
            venueId: ids.venue,
            enabled: true,
            basePercent: 5,
            pointsValidDays: 30,
          }),
        ]),
        "NOT_AUTHORIZED",
      );
      await actor(db, ids.customer, "device-config", false);
      await fails(
        db.query("select public.loyalty_summary($1) as r", [ids.venue]),
        "NOT_AUTHORIZED",
      );
      await actor(db, ids.admin, "admin-config", false);
      await fails(
        db.query("select public.loyalty_config($1) as r", [ids.patio]),
        "NOT_AUTHORIZED",
      );
      await saveProgram(db, { basePercent: 5 });
      await asAdmin(db);
      const config = (
        await db.query<{
          r: { program: { base_percent: string; enabled: boolean } };
        }>("select public.loyalty_config($1) as r", [ids.venue])
      ).rows[0].r;
      expect(Number(config.program.base_percent)).toBe(5);
      expect(config.program.enabled).toBe(true);
    } finally {
      await db.close();
    }
  });

  it("valida entradas: porcentaje fuera de rango, categoría ajena y campaña inexistente", async () => {
    const db = await setup();
    try {
      await fails(saveProgram(db, { basePercent: 101 }), "INVALID_INPUT");
      await fails(saveProgram(db, { basePercent: -1 }), "INVALID_INPUT");
      await fails(
        saveRule(db, {
          name: "Mal",
          kind: "category",
          scopeId: MISSING,
          percent: 5,
        }),
        "INVALID_INPUT",
      );
      await fails(
        saveRule(db, {
          name: "Todos",
          kind: "all",
          scopeId: CATEGORY,
          percent: 5,
        }),
        "INVALID_INPUT",
      );
      await fails(
        saveRule(db, {
          name: "Con campaña",
          kind: "all",
          percent: 5,
          campaignId: MISSING,
        }),
        "INVALID_INPUT",
      );
    } finally {
      await db.close();
    }
  });

  it("las reglas y campañas no se pueden borrar y cada cambio queda en el historial con su actor", async () => {
    const db = await setup();
    try {
      await saveProgram(db);
      const rule = await saveRule(db, {
        name: "Cócteles",
        kind: "category",
        scopeId: CATEGORY,
        percent: 4,
      });
      await saveRule(db, {
        id: rule.id,
        name: "Cócteles",
        kind: "category",
        scopeId: CATEGORY,
        percent: 6,
        active: false,
      });
      const log = await owner<{
        entity: string;
        action: string;
        actor_id: string;
        before_state: { percent?: string } | null;
        after_state: { percent: string };
      }>(
        db,
        "select entity,action,actor_id,before_state,after_state from private.loyalty_config_log where entity='rule' order by created_at",
      );
      expect(log.map((l) => l.action)).toEqual(["insert", "update"]);
      expect(log.every((l) => l.actor_id === ids.admin)).toBe(true);
      expect(Number(log[1].before_state?.percent)).toBe(4);
      expect(Number(log[1].after_state.percent)).toBe(6);
      await asAdmin(db);
      await expect(
        db.query("delete from public.loyalty_rules where id=$1", [rule.id]),
      ).rejects.toThrow();
    } finally {
      await db.close();
    }
  });
});

describe("fidelización · acumulación al confirmar el cobro", () => {
  it("abona el porcentaje base al capturar el pago, una sola vez, con vencimiento del programa", async () => {
    const db = await setup();
    try {
      await saveProgram(db, { basePercent: 10, pointsValidDays: 180 });
      const { orderId, total } = await paidOrder(db, "earn-base");
      const expected = Math.floor(total / 1000); // 10 % sobre total en céntimos, en colones enteros
      const rows = await earnRows(db, orderId);
      expect(rows).toEqual([
        expect.objectContaining({
          kind: "earn",
          points: expected,
          funder: "venue",
          campaign_id: null,
        }),
      ]);
      expect(await balance(db)).toBe(expected);

      const again = await owner<{ n: number }>(
        db,
        "select private.loyalty_award($1) as n",
        [orderId],
      );
      expect(again).toEqual([{ n: 0 }]);
      expect(await earnRows(db, orderId)).toHaveLength(1);
      const [vence] = await owner<{ days: number }>(
        db,
        "select extract(day from expires_at-created_at)::int as days from private.loyalty_ledger where order_id=$1 and kind='earn'",
        [orderId],
      );
      expect(vence.days).toBe(180);
    } finally {
      await db.close();
    }
  });

  it("no abona con el programa apagado, ni a una cuenta sin perfil completo", async () => {
    const db = await setup();
    try {
      await saveProgram(db, { enabled: false, basePercent: 10 });
      const off = await paidOrder(db, "earn-off");
      expect(await earnRows(db, off.orderId)).toEqual([]);

      await saveProgram(db, { enabled: true, basePercent: 10 });
      const guest = await paidOrder(db, "earn-guest", ids.other);
      expect(await earnRows(db, guest.orderId)).toEqual([]);
    } finally {
      await db.close();
    }
  });

  it("una regla que coincide reemplaza al base; una regla al 0 % excluye el producto", async () => {
    const db = await setup();
    try {
      await saveProgram(db, { basePercent: 10 });
      const rule = await saveRule(db, {
        name: "Excluida",
        kind: "product",
        scopeId: ids.product,
        percent: 0,
      });
      const excluded = await paidOrder(db, "earn-excluded");
      expect(await earnRows(db, excluded.orderId)).toEqual([]);

      await saveRule(db, {
        id: rule.id,
        name: "Excluida",
        kind: "product",
        scopeId: ids.product,
        percent: 0,
        active: false,
      });
      const back = await paidOrder(db, "earn-back");
      expect(await earnRows(db, back.orderId)).toEqual([
        expect.objectContaining({ points: Math.floor(back.total / 1000) }),
      ]);

      await saveRule(db, {
        name: "Cócteles 20",
        kind: "category",
        scopeId: CATEGORY,
        percent: 20,
      });
      await saveRule(db, { name: "Todo 3", kind: "all", percent: 3 });
      const winner = await paidOrder(db, "earn-highest");
      expect(await earnRows(db, winner.orderId)).toEqual([
        expect.objectContaining({
          points: Math.floor((winner.total * 20) / 10000),
        }),
      ]);
    } finally {
      await db.close();
    }
  });

  it("respeta día, franja horaria (hora de Costa Rica), importe mínimo y tope por pedido", async () => {
    const db = await setup();
    try {
      await saveProgram(db, { basePercent: 1 });
      const { h, d } = await nowCR(db);
      const wrongDay = d === 7 ? 1 : d + 1;
      await saveRule(db, {
        name: "Otro día",
        kind: "all",
        percent: 50,
        weekdays: [wrongDay],
      });
      await saveRule(db, {
        name: "Otra hora",
        kind: "all",
        percent: 50,
        hourFrom: (h + 1) % 24,
        hourTo: (h + 2) % 24,
      });
      await saveRule(db, {
        name: "Mínimo alto",
        kind: "all",
        percent: 50,
        minAmountMinor: 900000000,
      });
      const base = await paidOrder(db, "earn-none-match");
      expect(await earnRows(db, base.orderId)).toEqual([
        expect.objectContaining({ points: Math.floor(base.total / 10000) }),
      ]);

      const db2 = await setup();
      try {
        const cur = await nowCR(db2);
        await saveProgram(db2, { basePercent: 1 });
        await saveRule(db2, {
          name: "Hoy, esta hora, con tope",
          kind: "all",
          percent: 100,
          weekdays: [cur.d],
          hourFrom: cur.h,
          hourTo: (cur.h + 1) % 24,
          maxPointsPerOrder: 5,
        });
        const capped = await paidOrder(db2, "earn-capped");
        expect(await earnRows(db2, capped.orderId)).toEqual([
          expect.objectContaining({ points: 5 }),
        ]);
      } finally {
        await db2.close();
      }
    } finally {
      await db.close();
    }
  });
});

describe("fidelización · campañas y presupuesto", () => {
  it("una campaña patrocinada se agota en su presupuesto y luego rige el base del local", async () => {
    const db = await setup();
    try {
      await saveProgram(db, { basePercent: 10 });
      const campaign = await saveCampaign(db, {
        name: "Cerveza de la semana",
        funder: "sponsor",
        sponsorName: "Marca Patrocinadora",
        budgetPoints: 50,
      });
      await saveRule(db, {
        name: "Campaña 10 %",
        kind: "all",
        percent: 10,
        campaignId: campaign.id,
      });
      const first = await paidOrder(db, "camp-one");
      const rows = await earnRows(db, first.orderId);
      expect(rows).toEqual([
        expect.objectContaining({
          kind: "earn",
          points: 50,
          funder: "sponsor",
          campaign_id: campaign.id,
        }),
      ]);
      const second = await paidOrder(db, "camp-two");
      expect(await earnRows(db, second.orderId)).toEqual([
        expect.objectContaining({
          points: Math.floor(second.total / 1000),
          funder: "venue",
          campaign_id: null,
        }),
      ]);
      const s = await summary(db);
      expect(s.by_funder.sponsor).toBe(50);
      expect(s.by_funder.venue).toBe(Math.floor(second.total / 1000));
    } finally {
      await db.close();
    }
  });

  it("el presupuesto no baja de lo ya emitido ni cambia el fondeador después de emitir", async () => {
    const db = await setup();
    try {
      await saveProgram(db, { basePercent: 10 });
      const campaign = await saveCampaign(db, {
        name: "Local",
        funder: "venue",
        budgetPoints: 500,
      });
      await saveRule(db, {
        name: "Local 10 %",
        kind: "all",
        percent: 10,
        campaignId: campaign.id,
      });
      await paidOrder(db, "camp-lock");
      await fails(
        saveCampaign(db, {
          id: campaign.id,
          name: "Local",
          funder: "venue",
          budgetPoints: 10,
        }),
        "BUDGET_BELOW_ISSUED",
      );
      await fails(
        saveCampaign(db, {
          id: campaign.id,
          name: "Local",
          funder: "onza",
          budgetPoints: 500,
        }),
        "FUNDER_LOCKED",
      );
    } finally {
      await db.close();
    }
  });
});

describe("fidelización · reversas, vencimientos e invariantes", () => {
  it("un reembolso revierte lo no consumido y devuelve presupuesto a la campaña", async () => {
    const db = await setup();
    try {
      await saveProgram(db, { basePercent: 10 });
      const campaign = await saveCampaign(db, {
        name: "Patrocinio",
        funder: "sponsor",
        sponsorName: "Marca",
        budgetPoints: 60,
      });
      await saveRule(db, {
        name: "Campaña",
        kind: "all",
        percent: 10,
        campaignId: campaign.id,
      });
      const { orderId } = await paidOrder(db, "refund-me");
      expect(await balance(db)).toBe(60);

      await asAdmin(db);
      await command(db, {
        action: "refund",
        orderId,
        reason: "Devolución de prueba",
      });
      expect(await balance(db)).toBe(0);
      const rows = await earnRows(db, orderId);
      expect(rows.map((r) => [r.kind, r.points])).toEqual([
        ["earn", 60],
        ["reversal", -60],
      ]);
      const again = await owner<{ n: number }>(
        db,
        "select private.loyalty_reverse($1) as n",
        [orderId],
      );
      expect(again).toEqual([{ n: 0 }]);
      const after = await summary(db);
      expect(after.reversed).toBe(60);
      expect(after.outstanding).toBe(0);
    } finally {
      await db.close();
    }
  });

  it("los abonos vencidos dejan de contar al leer la cuenta y quedan en el historial", async () => {
    const db = await setup();
    try {
      await saveProgram(db, { basePercent: 10 });
      const { orderId, total } = await paidOrder(db, "expire-me");
      const points = Math.floor(total / 1000);

      await owner(
        db,
        "alter table private.loyalty_ledger disable trigger loyalty_ledger_append_only",
      );
      await owner(
        db,
        "update private.loyalty_ledger set expires_at=now()-interval '1 day' where order_id=$1 and kind='earn'",
        [orderId],
      );
      await owner(
        db,
        "alter table private.loyalty_ledger enable trigger loyalty_ledger_append_only",
      );

      expect(await balance(db)).toBe(0);
      await actor(db, ids.customer, "acct-history", false);
      const history = (
        await db.query<{ r: { history: { kind: string; points: number }[] } }>(
          "select public.loyalty_account() as r",
        )
      ).rows[0].r.history;
      expect(history.map((h) => [h.kind, h.points])).toEqual(
        expect.arrayContaining([
          ["earn", points],
          ["expire", -points],
        ]),
      );
      const s = await summary(db);
      expect(s.expired).toBe(points);
      expect(s.outstanding).toBe(0);
      expect(s.issued - s.reversed - s.expired - s.redeemed).toBe(
        s.outstanding,
      );
    } finally {
      await db.close();
    }
  });

  it("el libro es append-only: ni editar ni borrar asientos, ni como dueño de la sesión del navegador", async () => {
    const db = await setup();
    try {
      await saveProgram(db, { basePercent: 10 });
      const { orderId } = await paidOrder(db, "append-only");
      await fails(
        owner(
          db,
          "update private.loyalty_ledger set points=1 where order_id=$1",
          [orderId],
        ),
        "APPEND_ONLY",
      );
      await fails(
        owner(db, "delete from private.loyalty_ledger where order_id=$1", [
          orderId,
        ]),
        "APPEND_ONLY",
      );
    } finally {
      await db.close();
    }
  });

  it("cada cuenta ve solo su saldo; el resumen del local no expone clientes", async () => {
    const db = await setup();
    try {
      await saveProgram(db, { basePercent: 10 });
      const { total } = await paidOrder(db, "privacy");
      expect(await balance(db, ids.customer)).toBe(Math.floor(total / 1000));
      expect(await balance(db, ids.other)).toBe(0);
      const s = await summary(db);
      expect(Object.keys(s).sort()).toEqual([
        "by_funder",
        "expired",
        "issued",
        "outstanding",
        "redeemed",
        "reversed",
      ]);
    } finally {
      await db.close();
    }
  });
});
