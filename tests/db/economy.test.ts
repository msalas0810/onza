import { describe, it, expect } from "vitest";
import { actor, command, ids } from "./helpers";
import {
  adminCommand,
  asUser,
  owner,
  paidOrder,
  relaxLimits,
  rpc,
  setup,
  users,
  wallet,
} from "./economy-helpers";

// Pedido de prueba: ₡9.000 (900 000 minor). Con crc_per_coin=100 son 90 monedas; con el valor por defecto (500), 18.

describe("economía: Avatar Coins y XP", () => {
  it("un pedido entregado abona monedas y XP, registra la visita verificada y es idempotente", async () => {
    const db = await setup();
    try {
      await relaxLimits(db);
      const orderId = await paidOrder(db, "eco-1");
      const w = await wallet(db);
      // Pedido: 90 monedas y 10 XP. Primera visita: 10 monedas y 25 XP. Logro «primer pedido»: 5 monedas y 20 XP.
      expect(w.venues_unlocked).toBe(1);
      expect(w.coins).toBe(105);
      expect(w.xp).toBe(55);
      const before = await owner<{ n: number }>(
        db,
        "select count(*)::int n from private.coin_ledger where user_id=$1",
        [ids.customer],
      );
      await owner(db, "select private.economy_award_order($1)", [orderId]);
      const after = await owner<{ n: number }>(
        db,
        "select count(*)::int n from private.coin_ledger where user_id=$1",
        [ids.customer],
      );
      expect(after[0].n).toBe(before[0].n);
      expect(
        (await wallet(db)).achievements.find((a) => a.code === "primer_pedido")
          ?.unlocked_at,
      ).toBeTruthy();
    } finally {
      await db.close();
    }
  });

  it("los tres sistemas son independientes: ganar monedas y XP no crea puntos de cashback", async () => {
    const db = await setup();
    try {
      await relaxLimits(db);
      await paidOrder(db, "eco-indep");
      const [cash] = await owner<{ n: number }>(
        db,
        "select count(*)::int n from private.loyalty_ledger",
      );
      expect(cash.n).toBe(0);
      expect((await wallet(db)).coins).toBeGreaterThan(0);
    } finally {
      await db.close();
    }
  });

  it("anti-exceso: el segundo pedido pegado queda limitado y deja una señal de revisión", async () => {
    const db = await setup();
    try {
      await adminCommand(db, "settings", {
        crc_per_coin: 100,
        max_rewarded_orders_per_day: 5,
        min_minutes_between_rewarded: 90,
      });
      await paidOrder(db, "eco-gap-1");
      const first = await wallet(db);
      await paidOrder(db, "eco-gap-2");
      const second = await wallet(db);
      expect(second.coins).toBe(first.coins);
      expect(second.xp).toBe(first.xp);
      const flags = await owner<{ kind: string }>(
        db,
        "select kind from private.economy_flags where user_id=$1",
        [ids.customer],
      );
      expect(flags.map((f) => f.kind)).toContain("order_reward_limited");
    } finally {
      await db.close();
    }
  });

  it("anti-exceso: el tope de pedidos premiados por día se respeta", async () => {
    const db = await setup();
    try {
      await adminCommand(db, "settings", {
        crc_per_coin: 100,
        max_rewarded_orders_per_day: 1,
        min_minutes_between_rewarded: 0,
        daily_coin_cap: 1000,
        daily_xp_cap: 1000,
      });
      await paidOrder(db, "eco-day-1");
      const first = await wallet(db);
      await paidOrder(db, "eco-day-2");
      expect((await wallet(db)).coins).toBe(first.coins);
    } finally {
      await db.close();
    }
  });

  it("el tope diario de monedas recorta lo ganado", async () => {
    const db = await setup();
    try {
      await adminCommand(db, "settings", {
        crc_per_coin: 100,
        max_rewarded_orders_per_day: 50,
        min_minutes_between_rewarded: 0,
        daily_coin_cap: 3,
        daily_xp_cap: 1000,
      });
      await paidOrder(db, "eco-cap");
      const [reward] = await owner<{ coins: number }>(
        db,
        "select coins from private.order_rewards where user_id=$1",
        [ids.customer],
      );
      expect(reward.coins).toBe(3);
      const flags = await owner<{ kind: string }>(
        db,
        "select kind from private.economy_flags where kind='daily_cap'",
      );
      expect(flags.length).toBeGreaterThan(0);
    } finally {
      await db.close();
    }
  });

  it("una campaña multiplica lo ganado", async () => {
    const db = await setup();
    try {
      await relaxLimits(db);
      await adminCommand(db, "campaign", {
        name: "Doble",
        coin_multiplier: 2,
        xp_multiplier: 2,
        starts_at: new Date(Date.now() - 3_600_000).toISOString(),
        ends_at: new Date(Date.now() + 3_600_000).toISOString(),
      });
      await paidOrder(db, "eco-camp");
      const [row] = await owner<{ coins: number; xp: number }>(
        db,
        "select coins,xp from private.order_rewards where user_id=$1",
        [ids.customer],
      );
      expect(row.coins).toBe(180);
      expect(row.xp).toBe(20);
    } finally {
      await db.close();
    }
  });

  it("un reembolso revierte monedas y XP del pedido, una sola vez", async () => {
    const db = await setup();
    try {
      await relaxLimits(db);
      const orderId = await paidOrder(db, "eco-refund");
      const [reward] = await owner<{ coins: number; xp: number }>(
        db,
        "select coins,xp from private.order_rewards where order_id=$1",
        [orderId],
      );
      const before = await wallet(db);
      await actor(db, ids.admin, "admin-refund", false);
      await command(db, {
        action: "refund",
        orderId,
        reason: "Devolución de prueba",
      });
      const after = await wallet(db);
      expect(after.coins).toBe(before.coins - reward.coins);
      expect(after.xp).toBe(before.xp - reward.xp);
      await owner(db, "select private.economy_revoke_order($1)", [orderId]);
      expect((await wallet(db)).coins).toBe(after.coins);
    } finally {
      await db.close();
    }
  });

  it("un error en la economía nunca bloquea la entrega de un pedido: deja una señal y el pedido sigue", async () => {
    const db = await setup();
    try {
      await owner(
        db,
        "create or replace function private.economy_award_order(p_order uuid) returns void language plpgsql as $$ begin raise exception 'boom'; end $$",
      );
      const orderId = await paidOrder(db, "eco-failsafe");
      const [order] = await owner<{ status: string }>(db, "select status from public.orders where id=$1", [orderId]);
      expect(order.status).toBe("delivered");
      const flags = await owner<{ kind: string; details: { message: string } }>(
        db,
        "select kind,details from private.economy_flags where kind='trigger_error'",
      );
      expect(flags).toHaveLength(1);
      expect(flags[0].details.message).toMatch(/boom/);
      expect((await wallet(db)).coins).toBe(0);
    } finally {
      await db.close();
    }
  });

  it("los libros no se pueden editar ni borrar", async () => {
    const db = await setup();
    try {
      await relaxLimits(db);
      await paidOrder(db, "eco-append");
      await expect(
        owner(db, "update private.coin_ledger set amount=999"),
      ).rejects.toThrow(/APPEND_ONLY/);
      await expect(owner(db, "delete from private.xp_ledger")).rejects.toThrow(
        /APPEND_ONLY/,
      );
    } finally {
      await db.close();
    }
  });

  it("gastar sin saldo falla y repetir la clave no gasta dos veces", async () => {
    const db = await setup();
    try {
      await expect(
        owner(
          db,
          "select private.coin_spend($1,5,'x','test',null,'spend-1')",
          [ids.customer],
        ),
      ).rejects.toThrow(/INSUFFICIENT_COINS/);
      await owner(
        db,
        "select private.coin_grant($1,20,'earn','semilla','test',null,'seed-1')",
        [ids.customer],
      );
      const first = await owner<{ ok: boolean }>(
        db,
        "select private.coin_spend($1,5,'x','test',null,'spend-2') ok",
        [ids.customer],
      );
      const again = await owner<{ ok: boolean }>(
        db,
        "select private.coin_spend($1,5,'x','test',null,'spend-2') ok",
        [ids.customer],
      );
      expect([first[0].ok, again[0].ok]).toEqual([true, false]);
      expect((await wallet(db)).coins).toBe(15);
    } finally {
      await db.close();
    }
  });

  it("el saldo nunca queda negativo ni siquiera al revertir de más", async () => {
    const db = await setup();
    try {
      await owner(
        db,
        "select private.coin_grant($1,4,'earn','semilla','test',null,'seed-2')",
        [ids.customer],
      );
      const [r] = await owner<{ taken: number }>(
        db,
        "select private.coin_revoke($1,10,'x','test',null,'rev-1') taken",
        [ids.customer],
      );
      expect(r.taken).toBe(4);
      expect((await wallet(db)).coins).toBe(0);
      const flags = await owner<{ kind: string }>(
        db,
        "select kind from private.economy_flags where kind='reversal_shortfall'",
      );
      expect(flags).toHaveLength(1);
    } finally {
      await db.close();
    }
  });

  it("el check-in y las amistades dan XP con tope diario", async () => {
    const db = await setup();
    try {
      await db.exec("reset role");
      await db.exec(
        `insert into public.venue_checkins(user_id,venue_id,expires_at) values('${ids.customer}','${ids.venue}',now()+interval '1 hour');
         update public.venue_checkins set ended_at=now();
         insert into public.venue_checkins(user_id,venue_id,expires_at) values('${ids.customer}','${ids.venue}',now()+interval '1 hour');
         update public.venue_checkins set ended_at=now() where ended_at is null;
         insert into public.venue_checkins(user_id,venue_id,expires_at) values('${ids.customer}','${ids.venue}',now()+interval '1 hour')`,
      );
      // checkin: 5 XP, tope 2 por día → 10
      expect((await wallet(db)).xp).toBe(10);
      await db.exec("reset role");
      await db.exec(
        `insert into public.friendships(requester,addressee,status) values('${ids.customer}','${users.friend}','pending');
         update public.friendships set status='accepted'`,
      );
      expect((await wallet(db)).xp).toBe(20);
      expect((await wallet(db, users.friend)).xp).toBe(10);
    } finally {
      await db.close();
    }
  });

  it("los logros se desbloquean una sola vez y dan su recompensa", async () => {
    const db = await setup();
    try {
      await relaxLimits(db);
      await adminCommand(db, "achievement", {
        code: "dos_pedidos",
        name: "Dos pedidos",
        metric: "orders",
        threshold: 2,
        reward_coins: 7,
        reward_xp: 3,
      });
      await paidOrder(db, "eco-ach-1");
      const one = await wallet(db);
      expect(
        one.achievements.find((a) => a.code === "dos_pedidos")?.unlocked_at,
      ).toBeFalsy();
      await paidOrder(db, "eco-ach-2");
      const two = await wallet(db);
      expect(
        two.achievements.find((a) => a.code === "dos_pedidos")?.unlocked_at,
      ).toBeTruthy();
      await owner(db, "select private.economy_achievements($1)", [
        ids.customer,
      ]);
      const [n] = await owner<{ n: number }>(
        db,
        "select count(*)::int n from private.coin_ledger where idempotency_key like 'ach:%' and user_id=$1 and amount=7",
        [ids.customer],
      );
      expect(n.n).toBe(1);
    } finally {
      await db.close();
    }
  });

  it("los niveles salen del XP total", async () => {
    const db = await setup();
    try {
      await owner(
        db,
        "select private.xp_grant($1,160,'semilla','test',null,'lvl-1')",
        [ids.customer],
      );
      expect((await wallet(db)).level).toBe(3);
    } finally {
      await db.close();
    }
  });

  it("solo clientes con perfil participan: invitados, equipo y cuentas sin perfil quedan fuera", async () => {
    const db = await setup();
    try {
      await actor(db, ids.other, "guest-1", true);
      await expect(db.query("select public.economy_wallet()")).rejects.toThrow(
        /ACCOUNT_REQUIRED/,
      );
      await actor(db, ids.staff, "staff-1", false);
      await expect(db.query("select public.economy_wallet()")).rejects.toThrow(
        /STAFF_NOT_PLAYER/,
      );
      await actor(db, ids.other, "noprofile", false);
      await expect(db.query("select public.economy_wallet()")).rejects.toThrow(
        /ONBOARDING_REQUIRED/,
      );
    } finally {
      await db.close();
    }
  });

  it("nadie tiene acceso directo a las tablas ni a las funciones internas", async () => {
    const db = await setup();
    try {
      await asUser(db);
      for (const sql of [
        "select * from public.economy_settings",
        "select * from public.coin_packages",
        "select * from private.coin_ledger",
        "insert into public.levels values(99,1,'x')",
        "select private.coin_grant(auth.uid(),999,'earn','x','t',null,'k')",
      ])
        await expect(db.query(sql)).rejects.toThrow(/permission denied/);
    } finally {
      await db.close();
    }
  });
});

describe("economía: administración y paquetes", () => {
  it("solo el megaadministrador ve y cambia la configuración", async () => {
    const db = await setup();
    try {
      await expect(
        rpc(db, ids.customer, "economy_admin_overview"),
      ).rejects.toThrow(/NOT_AUTHORIZED/);
      await expect(
        rpc(db, ids.admin, "economy_admin_command", {
          entity: "settings",
          values: { daily_coin_cap: 1 },
        }),
      ).rejects.toThrow(/NOT_AUTHORIZED/);
      const overview = await rpc<{ settings: { daily_coin_cap: number } }>(
        db,
        "onza",
        "economy_admin_overview",
      );
      expect(overview.settings.daily_coin_cap).toBe(40);
    } finally {
      await db.close();
    }
  });

  it("valida la entrada y deja registro de cada cambio", async () => {
    const db = await setup();
    try {
      await expect(
        adminCommand(db, "settings", { daily_coin_cap: -5 }),
      ).rejects.toThrow(/INVALID_INPUT/);
      await expect(
        adminCommand(db, "settings", { daily_coin_cap: "mucho" }),
      ).rejects.toThrow(/INVALID_INPUT/);
      await expect(adminCommand(db, "otra_cosa", {})).rejects.toThrow(
        /INVALID_INPUT/,
      );
      await adminCommand(db, "settings", { daily_coin_cap: 25 });
      const log = await owner<{ entity: string; action: string }>(
        db,
        "select entity,action from private.economy_audit_log where entity='economy_settings' order by created_at desc limit 1",
      );
      expect(log[0].action).toBe("update");
      await expect(
        owner(db, "delete from private.economy_audit_log"),
      ).rejects.toThrow(/APPEND_ONLY/);
    } finally {
      await db.close();
    }
  });

  it("comprar monedas: apagado por defecto, idempotente y sin acreditar hasta que el servidor liquida", async () => {
    const db = await setup();
    try {
      await adminCommand(db, "package", {
        code: "pack_s",
        name: "Paquete S",
        coins: 100,
        bonus_coins: 10,
        price_minor: 150000,
        enabled: true,
      });
      await expect(
        rpc(db, ids.customer, "coins_purchase_create", "pack_s", "idem-12345"),
      ).rejects.toThrow(/COIN_PURCHASES_DISABLED/);
      await adminCommand(db, "settings", { coin_purchases_enabled: true });
      const made = await rpc<{ id: string; status: string; coins: number }>(
        db,
        ids.customer,
        "coins_purchase_create",
        "pack_s",
        "idem-12345",
      );
      expect(made).toMatchObject({ status: "pending", coins: 110 });
      const again = await rpc<{ id: string; replayed: boolean }>(
        db,
        ids.customer,
        "coins_purchase_create",
        "pack_s",
        "idem-12345",
      );
      expect(again).toMatchObject({ id: made.id, replayed: true });
      expect((await wallet(db)).coins).toBe(0);

      // Un cliente no puede liquidar su propia compra.
      await asUser(db);
      await expect(
        db.query("select public.coins_purchase_settle($1,'mock','x')", [
          made.id,
        ]),
      ).rejects.toThrow(/permission denied/);

      await owner(db, "select public.coins_purchase_settle($1,'mock','ref-1')", [
        made.id,
      ]);
      await owner(db, "select public.coins_purchase_settle($1,'mock','ref-1')", [
        made.id,
      ]);
      expect((await wallet(db)).coins).toBe(110);
      const stats = await rpc<{ stats: { revenue_minor: number } }>(
        db,
        "onza",
        "economy_admin_overview",
      );
      expect(stats.stats.revenue_minor).toBe(150000);
    } finally {
      await db.close();
    }
  });

  it("reembolsar una compra revierte las monedas y se puede repetir sin efecto", async () => {
    const db = await setup();
    try {
      await adminCommand(db, "package", {
        code: "pack_r",
        name: "Paquete R",
        coins: 50,
        price_minor: 100000,
        enabled: true,
      });
      await adminCommand(db, "settings", { coin_purchases_enabled: true });
      const made = await rpc<{ id: string }>(
        db,
        ids.customer,
        "coins_purchase_create",
        "pack_r",
        "idem-refund-1",
      );
      await owner(db, "select public.coins_purchase_settle($1,'mock','r1')", [
        made.id,
      ]);
      await owner(db, "select public.coins_purchase_refund($1)", [made.id]);
      await owner(db, "select public.coins_purchase_refund($1)", [made.id]);
      expect((await wallet(db)).coins).toBe(0);
    } finally {
      await db.close();
    }
  });

  it("un paquete apagado o inexistente no se puede comprar", async () => {
    const db = await setup();
    try {
      await adminCommand(db, "settings", { coin_purchases_enabled: true });
      await adminCommand(db, "package", {
        code: "pack_off",
        name: "Apagado",
        coins: 10,
        price_minor: 10000,
        enabled: false,
      });
      await expect(
        rpc(db, ids.customer, "coins_purchase_create", "pack_off", "idem-off-1"),
      ).rejects.toThrow(/PACKAGE_NOT_FOUND/);
      await expect(
        rpc(db, ids.customer, "coins_purchase_create", "nope", "idem-off-2"),
      ).rejects.toThrow(/PACKAGE_NOT_FOUND/);
    } finally {
      await db.close();
    }
  });
});
