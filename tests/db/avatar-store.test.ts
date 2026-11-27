import { describe, it, expect } from "vitest";
import { ids } from "./helpers";
import {
  adminCommand,
  asUser,
  owner,
  rpc,
  setup,
  users,
  wallet,
} from "./economy-helpers";

type Item = {
  item_id: string;
  sku: string;
  owned: boolean;
  locked_by_level: boolean;
  equipped: boolean;
  category: string;
};

const store = async (db: Awaited<ReturnType<typeof setup>>, who = ids.customer) =>
  (await rpc<{ items: Item[]; coins: number }>(db, who, "avatar_store", null));

async function itemId(db: Awaited<ReturnType<typeof setup>>, sku: string) {
  const [row] = await owner<{ id: string }>(
    db,
    "select id from public.avatar_items where sku=$1",
    [sku],
  );
  return row.id;
}

async function fund(
  db: Awaited<ReturnType<typeof setup>>,
  coins: number,
  xp = 0,
  who = ids.customer,
) {
  await owner(db, "select private.coin_grant($1,$2,'earn','semilla','test',null,$3)", [
    who,
    coins,
    `seed-${who}-${coins}-${xp}`,
  ]);
  if (xp > 0)
    await owner(db, "select private.xp_grant($1,$2,'semilla','test',null,$3)", [
      who,
      xp,
      `seed-xp-${who}-${xp}`,
    ]);
}

describe("avatares: tienda y equipamiento", () => {
  it("la tienda muestra solo artículos activos y disponibles, con su estado para la persona", async () => {
    const db = await setup();
    try {
      await db.exec("reset role");
      await db.exec(
        `insert into public.avatar_items(sku,name,category,price_coins,status) values('borrador_1','Borrador','hat',5,'draft');
         insert into public.avatar_items(sku,name,category,price_coins,status,available_until) values('vencido_1','Vencido','hat',5,'active',now()-interval '1 day')`,
      );
      const s = await store(db);
      const skus = s.items.map((i) => i.sku);
      expect(skus).toContain("prov_hat_01");
      expect(skus).not.toContain("borrador_1");
      expect(skus).not.toContain("vencido_1");
      const hats = (
        await rpc<{ items: Item[] }>(db, ids.customer, "avatar_store", "hat")
      ).items;
      expect(hats.every((i) => i.category === "hat")).toBe(true);
    } finally {
      await db.close();
    }
  });

  it("comprar gasta monedas, entrega el artículo una sola vez y no permite repetir", async () => {
    const db = await setup();
    try {
      await fund(db, 50);
      const hat = await itemId(db, "prov_hat_01"); // 20 monedas
      const bought = await rpc<{ price: number; coins: number }>(
        db,
        ids.customer,
        "avatar_item_buy",
        hat,
      );
      expect(bought).toMatchObject({ price: 20, coins: 30 });
      await expect(
        rpc(db, ids.customer, "avatar_item_buy", hat),
      ).rejects.toThrow(/ALREADY_OWNED/);
      expect((await wallet(db)).coins).toBe(30);
      const item = (await store(db)).items.find((i) => i.sku === "prov_hat_01");
      expect(item?.owned).toBe(true);
    } finally {
      await db.close();
    }
  });

  it("sin saldo suficiente no se compra y no se pierde nada", async () => {
    const db = await setup();
    try {
      await fund(db, 10);
      await expect(
        rpc(db, ids.customer, "avatar_item_buy", await itemId(db, "prov_hat_01")),
      ).rejects.toThrow(/INSUFFICIENT_COINS/);
      expect((await wallet(db)).coins).toBe(10);
      const [n] = await owner<{ n: number }>(
        db,
        "select count(*)::int n from private.avatar_inventory",
      );
      expect(n.n).toBe(0);
    } finally {
      await db.close();
    }
  });

  it("el nivel mínimo, los exclusivos y las ventanas de venta se respetan", async () => {
    const db = await setup();
    try {
      await fund(db, 500);
      await expect(
        rpc(db, ids.customer, "avatar_item_buy", await itemId(db, "prov_jacket_01")),
      ).rejects.toThrow(/LEVEL_TOO_LOW/);
      await expect(
        rpc(db, ids.customer, "avatar_item_buy", await itemId(db, "prov_exclusive_hat")),
      ).rejects.toThrow(/NOT_FOR_SALE/);
      await owner(
        db,
        "update public.avatar_items set available_from=now()+interval '1 day' where sku='prov_hat_02'",
      );
      await expect(
        rpc(db, ids.customer, "avatar_item_buy", await itemId(db, "prov_hat_02")),
      ).rejects.toThrow(/ITEM_NOT_AVAILABLE/);
      await fund(db, 0 + 1, 160); // XP 160 → nivel 3
      await rpc(db, ids.customer, "avatar_item_buy", await itemId(db, "prov_jacket_01"));
    } finally {
      await db.close();
    }
  });

  it("equipar exige ser dueño y que el artículo sea de esa ranura; un conflicto quita otra ranura", async () => {
    const db = await setup();
    try {
      await fund(db, 300, 160);
      const hat = await itemId(db, "prov_hat_01");
      const top = await itemId(db, "prov_top_01");
      const jacket = await itemId(db, "prov_jacket_01");
      await expect(
        rpc(db, ids.customer, "avatar_equip", { slot: "hat", itemId: hat }),
      ).rejects.toThrow(/ITEM_NOT_OWNED/);
      for (const i of [hat, top, jacket])
        await rpc(db, ids.customer, "avatar_item_buy", i);
      await expect(
        rpc(db, ids.customer, "avatar_equip", { slot: "top", itemId: hat }),
      ).rejects.toThrow(/ITEM_NOT_FOUND/);
      await expect(
        rpc(db, ids.customer, "avatar_equip", { slot: "capa", itemId: hat }),
      ).rejects.toThrow(/INVALID_INPUT/);
      await rpc(db, ids.customer, "avatar_equip", { slot: "top", itemId: top });
      await owner(
        db,
        `update public.avatar_items set compat='{"conflicts":["top"]}' where sku='prov_jacket_01'`,
      );
      const card = await rpc<{ equipped: Record<string, { sku: string }> }>(
        db,
        ids.customer,
        "avatar_equip",
        { slot: "jacket", itemId: jacket },
      );
      expect(Object.keys(card.equipped)).toEqual(["jacket"]);
      const cleared = await rpc<{ equipped: Record<string, unknown> }>(
        db,
        ids.customer,
        "avatar_equip",
        { slot: "jacket", itemId: null },
      );
      expect(cleared.equipped).toEqual({});
    } finally {
      await db.close();
    }
  });

  it("la compatibilidad por cuerpo bloquea artículos que no le quedan al avatar", async () => {
    const db = await setup();
    try {
      await fund(db, 100);
      await owner(
        db,
        `update public.avatar_items set compat='{"bodies":["b"]}' where sku='prov_shoes_01'`,
      );
      const shoes = await itemId(db, "prov_shoes_01");
      await rpc(db, ids.customer, "avatar_item_buy", shoes);
      await expect(
        rpc(db, ids.customer, "avatar_equip", { slot: "shoes", itemId: shoes }),
      ).rejects.toThrow(/INCOMPATIBLE_ITEM/);
      await rpc(db, ids.customer, "avatar_base_save", { skin: "tone-3", body: "b" });
      await rpc(db, ids.customer, "avatar_equip", { slot: "shoes", itemId: shoes });
      await expect(
        rpc(db, ids.customer, "avatar_base_save", { skin: "../x", body: "b" }),
      ).rejects.toThrow(/INVALID_INPUT/);
    } finally {
      await db.close();
    }
  });

  it("un artículo retirado sigue en el inventario y equipado, pero ya no se vende", async () => {
    const db = await setup();
    try {
      await fund(db, 100);
      const hat = await itemId(db, "prov_hat_01");
      await rpc(db, ids.customer, "avatar_item_buy", hat);
      await rpc(db, ids.customer, "avatar_equip", { slot: "hat", itemId: hat });
      await rpc(db, "onza", "avatar_item_save", { sku: "prov_hat_01", status: "retired" });
      const me = await rpc<{ equipped: { hat?: { sku: string } }; owned: unknown[] }>(
        db,
        ids.customer,
        "avatar_me",
      );
      expect(me.equipped.hat?.sku).toBe("prov_hat_01");
      expect(me.owned).toHaveLength(1);
      expect((await store(db, users.friend)).items.map((i) => i.sku)).not.toContain(
        "prov_hat_01",
      );
    } finally {
      await db.close();
    }
  });

  it("la privacidad del avatar se valida y por defecto no aparece en rankings", async () => {
    const db = await setup();
    try {
      const me = await rpc<{ presence: string; show_in_rankings: boolean }>(
        db,
        ids.customer,
        "avatar_me",
      );
      expect(me).toMatchObject({ presence: "friends", show_in_rankings: false });
      await expect(
        rpc(db, ids.customer, "avatar_privacy_save", { presence: "todos" }),
      ).rejects.toThrow(/INVALID_INPUT/);
      await rpc(db, ids.customer, "avatar_privacy_save", {
        presence: "nobody",
        show_in_rankings: true,
      });
      expect(
        (await rpc<{ presence: string }>(db, ids.customer, "avatar_me")).presence,
      ).toBe("nobody");
    } finally {
      await db.close();
    }
  });

  it("un logro puede otorgar un artículo exclusivo", async () => {
    const db = await setup();
    try {
      await adminCommand(db, "achievement", {
        code: "premio_sombrero",
        name: "Premio",
        metric: "level",
        threshold: 2,
        reward_coins: 0,
        reward_xp: 0,
      });
      await rpc(db, "onza", "achievement_reward_item_set", {
        code: "premio_sombrero",
        itemId: await itemId(db, "prov_exclusive_hat"),
      });
      await fund(db, 1, 60);
      await owner(db, "select private.economy_achievements($1)", [ids.customer]);
      const me = await rpc<{ owned: { sku: string }[] }>(db, ids.customer, "avatar_me");
      expect(me.owned.map((o) => o.sku)).toContain("prov_exclusive_hat");
    } finally {
      await db.close();
    }
  });

  it("ONZA puede conceder un artículo a una persona; nadie más", async () => {
    const db = await setup();
    try {
      const input = {
        userId: users.friend,
        itemId: await itemId(db, "prov_exclusive_hat"),
      };
      await expect(
        rpc(db, ids.customer, "avatar_item_grant", input),
      ).rejects.toThrow(/NOT_AUTHORIZED/);
      await rpc(db, "onza", "avatar_item_grant", input);
      expect(
        (await rpc<{ owned: unknown[] }>(db, users.friend, "avatar_me")).owned,
      ).toHaveLength(1);
    } finally {
      await db.close();
    }
  });

  it("nadie lee ni escribe directo en las tablas del catálogo y del inventario", async () => {
    const db = await setup();
    try {
      await asUser(db);
      for (const sql of [
        "select * from public.avatar_items",
        "insert into public.avatar_items(sku,name,category) values('x1','xx','hat')",
        "select * from private.avatar_inventory",
        "select * from private.catalog_imports",
        "select private.avatar_item_upsert('{}'::jsonb)",
      ])
        await expect(db.query(sql)).rejects.toThrow(/permission denied/);
    } finally {
      await db.close();
    }
  });
});

describe("importador CSV del catálogo", () => {
  const rows = (...r: Record<string, unknown>[]) => r;

  it("la vista previa valida todo sin escribir y dice qué se crearía y qué se actualizaría", async () => {
    const db = await setup();
    try {
      const staged = await rpc<{
        id: string;
        created: number;
        updated: number;
        errors: { line: number; message: string }[];
        preview: { sku: string; action: string; changes: string[] }[];
      }>(db, "onza", "catalog_import_stage", {
        filename: "diseños.csv",
        rows: rows(
          { sku: "nuevo_hat", name: "Sombrero nuevo", category: "hat", price_coins: 40, status: "active" },
          { sku: "prov_hat_01", name: "Gorra final", asset_ref: "avatars/hat-01.png" },
          { sku: "mal_cat", name: "Malo", category: "capa" },
          { sku: "mal_ref", name: "Malo", category: "hat", asset_ref: "javascript:alert(1)" },
          { sku: "../x", name: "Malo", category: "hat" },
        ),
        errors: [{ line: 7, message: "Columna price_coins inválida" }],
      });
      expect(staged.created).toBe(1);
      expect(staged.updated).toBe(1);
      expect(staged.errors).toHaveLength(4);
      expect(staged.preview.find((p) => p.sku === "prov_hat_01")?.changes).toEqual(
        expect.arrayContaining(["name", "asset_ref"]),
      );
      const [n] = await owner<{ n: number }>(
        db,
        "select count(*)::int n from public.avatar_items where sku in ('nuevo_hat','mal_cat')",
      );
      expect(n.n).toBe(0);
    } finally {
      await db.close();
    }
  });

  it("aplicar crea y actualiza por sku, omite las filas con error y deja historial", async () => {
    const db = await setup();
    try {
      const staged = await rpc<{ id: string }>(db, "onza", "catalog_import_stage", {
        filename: "lote-1.csv",
        rows: rows(
          { sku: "nuevo_hat", name: "Sombrero nuevo", category: "hat", price_coins: 40, status: "active" },
          { sku: "mal_cat", name: "Malo", category: "capa" },
        ),
      });
      const applied = await rpc<{ created: number; errors: unknown[] }>(
        db,
        "onza",
        "catalog_import_apply",
        staged.id,
      );
      expect(applied.created).toBe(1);
      expect(applied.errors).toHaveLength(1);
      await expect(
        rpc(db, "onza", "catalog_import_apply", staged.id),
      ).rejects.toThrow(/IMPORT_NOT_PENDING/);
      const history = await rpc<{ filename: string; status: string; errors: number }[]>(
        db,
        "onza",
        "catalog_import_list",
      );
      expect(history[0]).toMatchObject({ filename: "lote-1.csv", status: "applied", errors: 1 });
      const detail = await rpc<{ errors: { sku: string }[] }>(
        db,
        "onza",
        "catalog_import_get",
        staged.id,
      );
      expect(detail.errors[0].sku).toBe("mal_cat");
    } finally {
      await db.close();
    }
  });

  it("actualizar un diseño por sku conserva el id, las compras y lo equipado", async () => {
    const db = await setup();
    try {
      await fund(db, 100);
      const hat = await itemId(db, "prov_hat_01");
      await rpc(db, ids.customer, "avatar_item_buy", hat);
      await rpc(db, ids.customer, "avatar_equip", { slot: "hat", itemId: hat });
      const staged = await rpc<{ id: string }>(db, "onza", "catalog_import_stage", {
        filename: "diseno-final.csv",
        rows: rows({
          sku: "prov_hat_01",
          name: "Gorra Onza",
          asset_ref: "https://cdn.ejemplo.test/avatars/gorra-onza.png",
          preview_ref: "avatars/gorra-onza-preview.png",
          rarity: "rare",
          price_coins: 35,
        }),
      });
      await rpc(db, "onza", "catalog_import_apply", staged.id);
      expect(await itemId(db, "prov_hat_01")).toBe(hat);
      const me = await rpc<{
        equipped: { hat: { name: string; asset_ref: string } };
        owned: { sku: string }[];
      }>(db, ids.customer, "avatar_me");
      expect(me.owned.map((o) => o.sku)).toContain("prov_hat_01");
      expect(me.equipped.hat).toMatchObject({
        name: "Gorra Onza",
        asset_ref: "https://cdn.ejemplo.test/avatars/gorra-onza.png",
      });
      const [paid] = await owner<{ price_paid: number }>(
        db,
        "select price_paid from private.avatar_inventory where item_id=$1",
        [hat],
      );
      expect(paid.price_paid).toBe(20); // lo pagado no cambia con el nuevo precio
    } finally {
      await db.close();
    }
  });

  it("una columna ausente conserva el valor actual y una vacía borra los opcionales", async () => {
    const db = await setup();
    try {
      await rpc(db, "onza", "avatar_item_save", {
        sku: "prov_hat_01",
        asset_ref: "avatars/a.png",
        season: "navidad",
      });
      const run = async (row: Record<string, unknown>) => {
        const s = await rpc<{ id: string }>(db, "onza", "catalog_import_stage", {
          filename: "x.csv",
          rows: [row],
        });
        await rpc(db, "onza", "catalog_import_apply", s.id);
        return (
          await owner<{ asset_ref: string | null; season: string | null; name: string }>(
            db,
            "select asset_ref,season,name from public.avatar_items where sku='prov_hat_01'",
          )
        )[0];
      };
      expect(await run({ sku: "prov_hat_01", name: "Solo nombre" })).toMatchObject({
        asset_ref: "avatars/a.png",
        season: "navidad",
        name: "Solo nombre",
      });
      expect(await run({ sku: "prov_hat_01", season: "" })).toMatchObject({
        asset_ref: "avatars/a.png",
        season: null,
      });
    } finally {
      await db.close();
    }
  });

  it("no se puede cambiar la categoría de un artículo existente", async () => {
    const db = await setup();
    try {
      const staged = await rpc<{ errors: { message: string }[] }>(
        db,
        "onza",
        "catalog_import_stage",
        {
          filename: "x.csv",
          rows: rows({ sku: "prov_hat_01", category: "shoes" }),
        },
      );
      expect(staged.errors[0].message).toMatch(/CATEGORY_CHANGE_NOT_ALLOWED/);
    } finally {
      await db.close();
    }
  });

  it("descartar una vista previa la deja sin efecto; solo ONZA importa", async () => {
    const db = await setup();
    try {
      await expect(
        rpc(db, ids.customer, "catalog_import_stage", {
          filename: "x.csv",
          rows: [{ sku: "zz_1", name: "ZZ", category: "hat" }],
        }),
      ).rejects.toThrow(/NOT_AUTHORIZED/);
      await expect(
        rpc(db, ids.admin, "catalog_import_list"),
      ).rejects.toThrow(/NOT_AUTHORIZED/);
      const staged = await rpc<{ id: string }>(db, "onza", "catalog_import_stage", {
        filename: "x.csv",
        rows: [{ sku: "zz_1", name: "ZZ", category: "hat" }],
      });
      await rpc(db, "onza", "catalog_import_discard", staged.id);
      await expect(
        rpc(db, "onza", "catalog_import_apply", staged.id),
      ).rejects.toThrow(/IMPORT_NOT_PENDING/);
      const [n] = await owner<{ n: number }>(
        db,
        "select count(*)::int n from public.avatar_items where sku='zz_1'",
      );
      expect(n.n).toBe(0);
    } finally {
      await db.close();
    }
  });

  it("rechaza importaciones vacías o demasiado grandes", async () => {
    const db = await setup();
    try {
      await expect(
        rpc(db, "onza", "catalog_import_stage", { filename: "x.csv", rows: [] }),
      ).rejects.toThrow(/EMPTY_IMPORT/);
      await expect(
        rpc(db, "onza", "catalog_import_stage", { filename: "", rows: [{ sku: "a1" }] }),
      ).rejects.toThrow(/INVALID_INPUT/);
      await expect(
        rpc(db, "onza", "catalog_import_stage", { filename: "x.csv", rows: "no" }),
      ).rejects.toThrow(/INVALID_INPUT/);
    } finally {
      await db.close();
    }
  });
});
