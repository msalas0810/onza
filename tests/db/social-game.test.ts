import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { actor, ids, installStorageStub } from "./helpers";
import { owner, paidOrder, relaxLimits, rpc, setup, users } from "./economy-helpers";

type Db = Awaited<ReturnType<typeof setup>>;

/** Deja a cliente y amigo como amistad aceptada. */
async function befriend(db: Db, a: string = ids.customer, b: string = users.friend) {
  await db.exec("reset role");
  await db.exec(
    `insert into public.friendships(requester,addressee,status) values('${a}','${b}','accepted')`,
  );
}

async function checkin(db: Db, who: string, share: boolean) {
  await db.exec("reset role");
  await db.exec(
    `insert into public.venue_checkins(user_id,venue_id,share_with_friends,expires_at) values('${who}','${ids.venue}',${share},now()+interval '2 hours')`,
  );
}

const privacy = (db: Db, who: string, presence: string, rank = false) =>
  rpc(db, who, "avatar_privacy_save", { presence, show_in_rankings: rank });

const presence = async (db: Db, who: string) =>
  rpc<{ people: { user_id: string }[]; total_active: number | null }>(
    db,
    who,
    "venue_presence",
    ids.venue,
  );

describe("social: rankings y mapa", () => {
  it("el ranking entre amigos incluye a la persona y a sus amistades aceptadas, ordenado, y nadie más", async () => {
    const db = await setup();
    try {
      await befriend(db);
      await owner(db, "select private.xp_grant($1,40,'s','test',null,'lb-1')", [ids.customer]);
      await owner(db, "select private.xp_grant($1,90,'s','test',null,'lb-2')", [users.friend]);
      await owner(db, "select private.xp_grant($1,500,'s','test',null,'lb-3')", [users.stranger]);
      const board = await rpc<{ rank: number; me: boolean; avatar: { user_id: string } }[]>(
        db,
        ids.customer,
        "social_leaderboard_friends",
        "xp",
      );
      expect(board.map((r) => r.avatar.user_id)).toEqual([users.friend, ids.customer]);
      expect(board.map((r) => r.rank)).toEqual([1, 2]);
      expect(board[1].me).toBe(true);
      await expect(
        rpc(db, ids.customer, "social_leaderboard_friends", "dinero"),
      ).rejects.toThrow(/INVALID_INPUT/);
    } finally {
      await db.close();
    }
  });

  it("el ranking por bar muestra solo a quien lo activó, por visitas verificadas", async () => {
    const db = await setup();
    try {
      await relaxLimits(db);
      await paidOrder(db, "lb-v1");
      await paidOrder(db, "lb-v2");
      await paidOrder(db, "lb-v3", users.friend);
      const empty = await rpc<{ entries: unknown[]; participating: boolean }>(
        db,
        users.stranger,
        "venue_leaderboard",
        ids.venue,
      );
      expect(empty).toMatchObject({ entries: [], participating: false });
      await privacy(db, ids.customer, "friends", true);
      await privacy(db, users.friend, "friends", true);
      const board = await rpc<{
        entries: { rank: number; visits: number; avatar: { user_id: string } }[];
      }>(db, users.stranger, "venue_leaderboard", ids.venue);
      expect(board.entries.map((e) => [e.avatar.user_id, e.visits])).toEqual([
        [ids.customer, 2],
        [users.friend, 1],
      ]);
      await privacy(db, users.friend, "friends", false);
      const after = await rpc<{ entries: unknown[] }>(
        db,
        users.stranger,
        "venue_leaderboard",
        ids.venue,
      );
      expect(after.entries).toHaveLength(1);
    } finally {
      await db.close();
    }
  });

  it("un bar se desbloquea con un pedido entregado, no con un check-in", async () => {
    const db = await setup();
    try {
      await checkin(db, ids.customer, false);
      const locked = await rpc<{ unlocked: number; venues: { venueId: string; unlocked: boolean; name: string | null }[] }>(
        db,
        ids.customer,
        "social_bar_map",
      );
      expect(locked.unlocked).toBe(0);
      expect(locked.venues.every((v) => !v.unlocked && v.name === null)).toBe(true);
      await relaxLimits(db);
      await paidOrder(db, "map-1");
      const open = await rpc<{ unlocked: number; venues: { venueId: string; unlocked: boolean; name: string | null }[] }>(
        db,
        ids.customer,
        "social_bar_map",
      );
      expect(open.unlocked).toBe(1);
      const venue = open.venues.find((v) => v.venueId === ids.venue);
      expect(venue).toMatchObject({ unlocked: true });
      expect(venue?.name).toBeTruthy();
    } finally {
      await db.close();
    }
  });
});

describe("social: quién está en el bar", () => {
  it("sin «compartir» nadie te ve; con compartir, según tu privacidad de avatar", async () => {
    const db = await setup();
    try {
      await befriend(db);
      await checkin(db, ids.customer, false);
      expect((await presence(db, users.friend)).people).toHaveLength(0);
      expect((await presence(db, ids.customer)).people).toHaveLength(1); // uno mismo siempre
      await db.exec("reset role");
      await db.exec("update public.venue_checkins set share_with_friends=true");

      // amistades: por defecto
      expect((await presence(db, users.friend)).people.map((p) => p.user_id)).toEqual([ids.customer]);
      expect((await presence(db, users.stranger)).people).toHaveLength(0);

      await privacy(db, ids.customer, "everyone");
      expect((await presence(db, users.stranger)).people).toHaveLength(1);

      await privacy(db, ids.customer, "nobody");
      expect((await presence(db, users.friend)).people).toHaveLength(0);
      expect((await presence(db, users.stranger)).people).toHaveLength(0);
    } finally {
      await db.close();
    }
  });

  it("el total de personas solo se revela con 5 o más activas", async () => {
    const db = await setup();
    try {
      await checkin(db, ids.customer, false);
      expect((await presence(db, ids.customer)).total_active).toBeNull();
      await db.exec("reset role");
      await db.exec(
        `insert into auth.users(id) select ('10000000-0000-4000-8000-0000000001'||lpad(g::text,2,'0'))::uuid from generate_series(1,4) g;
         insert into public.profiles(user_id,full_name,username,phone_country,phone_e164,birth_date,terms_version,privacy_version,terms_accepted_at)
          select ('10000000-0000-4000-8000-0000000001'||lpad(g::text,2,'0'))::uuid,'Extra '||g,'extra'||g,'+506','+5068888'||(7000+g),'1990-01-01','demo-v1','demo-v1',now() from generate_series(1,4) g;
         insert into public.venue_checkins(user_id,venue_id,expires_at)
          select ('10000000-0000-4000-8000-0000000001'||lpad(g::text,2,'0'))::uuid,'${ids.venue}',now()+interval '1 hour' from generate_series(1,4) g`,
      );
      expect((await presence(db, ids.customer)).total_active).toBe(5);
    } finally {
      await db.close();
    }
  });
});

describe("social: enviar un trago", () => {
  const venueOn = (db: Db) =>
    rpc(db, ids.admin, "venue_social_settings_save", { venueId: ids.venue, gifts_enabled: true });
  const propose = (db: Db, extra: Record<string, unknown> = {}) =>
    rpc<{ id: string; status: string }>(db, ids.customer, "gift_propose", {
      recipientId: users.friend,
      venueId: ids.venue,
      productId: ids.product,
      message: "¡Salud!",
      ...extra,
    });
  const enable = async (db: Db) => {
    await db.exec("reset role");
    await db.exec("update public.economy_settings set social_gifts_available=true");
  };

  it("está apagado hasta que el checkout lo soporte y el local lo habilite", async () => {
    const db = await setup();
    try {
      await befriend(db);
      await expect(propose(db)).rejects.toThrow(/GIFTS_NOT_AVAILABLE/);
      await enable(db);
      await expect(propose(db)).rejects.toThrow(/VENUE_GIFTS_DISABLED/);
      await expect(
        rpc(db, ids.customer, "venue_social_settings_save", { venueId: ids.venue, gifts_enabled: true }),
      ).rejects.toThrow(/NOT_AUTHORIZED/);
      await venueOn(db);
      expect(await propose(db)).toMatchObject({ status: "awaiting_payment" });
    } finally {
      await db.close();
    }
  });

  it("exige amistad aceptada, mayoría de edad de ambas partes y un producto del local", async () => {
    const db = await setup();
    try {
      await enable(db);
      await venueOn(db);
      await expect(propose(db)).rejects.toThrow(/NOT_FRIENDS/);
      await befriend(db, ids.customer, users.minor);
      await expect(propose(db, { recipientId: users.minor })).rejects.toThrow(/ADULT_REQUIRED/);
      await befriend(db);
      await expect(propose(db, { productId: "30000000-0000-4000-8000-0000000000ff" })).rejects.toThrow(
        /PRODUCT_NOT_AVAILABLE/,
      );
      await expect(propose(db, { recipientId: ids.customer })).rejects.toThrow(/INVALID_INPUT/);
      await expect(propose(db, { message: "x".repeat(141) })).rejects.toThrow(/INVALID_INPUT/);
    } finally {
      await db.close();
    }
  });

  it("el trago solo se acepta después de pagado; entrega un código una vez y da XP a ambos", async () => {
    const db = await setup();
    try {
      await enable(db);
      await venueOn(db);
      await befriend(db);
      const gift = await propose(db);
      await expect(rpc(db, users.friend, "gift_respond", gift.id, true)).rejects.toThrow(/GIFT_NOT_PENDING/);
      await actor(db, ids.customer, "otro", false);
      await expect(
        db.query("select public.gift_mark_paid($1,null)", [gift.id]),
      ).rejects.toThrow(/permission denied/);
      await owner(db, "select public.gift_mark_paid($1,null)", [gift.id]);
      await expect(rpc(db, users.stranger, "gift_respond", gift.id, true)).rejects.toThrow(/NOT_FOUND/);
      const accepted = await rpc<{ status: string; delivery_code: string }>(
        db,
        users.friend,
        "gift_respond",
        gift.id,
        true,
      );
      expect(accepted.status).toBe("accepted");
      expect(accepted.delivery_code).toMatch(/^\d{6}$/);
      const [row] = await owner<{ delivery_code_hash: string }>(
        db,
        "select delivery_code_hash from private.drink_gifts where id=$1",
        [gift.id],
      );
      expect(row.delivery_code_hash).not.toContain(accepted.delivery_code);
      await expect(rpc(db, users.friend, "gift_respond", gift.id, true)).rejects.toThrow(/GIFT_NOT_PENDING/);
      const [sender] = await owner<{ n: number }>(
        db,
        "select count(*)::int n from private.xp_ledger where user_id=$1 and source_type='event:gift_sent'",
        [ids.customer],
      );
      expect(sender.n).toBe(1);
    } finally {
      await db.close();
    }
  });

  it("se puede rechazar, cancelar y vence; hay un máximo de pendientes", async () => {
    const db = await setup();
    try {
      await enable(db);
      await venueOn(db);
      await befriend(db);
      const a = await propose(db);
      await owner(db, "select public.gift_mark_paid($1,null)", [a.id]);
      expect(await rpc(db, users.friend, "gift_respond", a.id, false)).toMatchObject({ status: "declined" });
      const b = await propose(db);
      expect(await rpc(db, ids.customer, "gift_cancel", b.id)).toMatchObject({ status: "canceled" });
      await expect(rpc(db, ids.customer, "gift_cancel", b.id)).rejects.toThrow(/GIFT_NOT_CANCELABLE/);
      const c = await propose(db);
      await owner(db, "update private.drink_gifts set expires_at=now()-interval '1 minute' where id=$1", [c.id]);
      const overview = await rpc<{ sent: { id: string; status: string }[] }>(db, ids.customer, "gift_overview");
      expect(overview.sent.find((g) => g.id === c.id)?.status).toBe("expired");
      for (let i = 0; i < 3; i++) await propose(db);
      await expect(propose(db)).rejects.toThrow(/TOO_MANY_PENDING/);
    } finally {
      await db.close();
    }
  });
});

describe("social: Drink Stories", () => {
  const path = (who: string, n = 1, ext = "jpg") => `${who}/story-${n}.${ext}`;
  const create = (db: Db, who: string, extra: Record<string, unknown> = {}) =>
    rpc<{ id: string }>(db, who, "story_create", {
      venueId: ids.venue,
      productId: ids.product,
      mediaPath: path(who),
      mediaType: "image",
      caption: "Mi trago",
      visibility: "friends",
      ...extra,
    });
  const feed = (db: Db, who: string, input: Record<string, unknown> = { scope: "friends" }) =>
    rpc<{ id: string; product_link: string | null; mine: boolean }[]>(db, who, "story_feed", input);

  it("publicar valida la ruta, el tipo, el local y el producto, y da XP", async () => {
    const db = await setup();
    try {
      const s = await create(db, ids.customer);
      expect(s.id).toBeTruthy();
      await expect(create(db, ids.customer)).rejects.toThrow(/ALREADY_EXISTS/);
      await expect(create(db, ids.customer, { mediaPath: path(users.friend, 2) })).rejects.toThrow(/INVALID_INPUT/);
      await expect(create(db, ids.customer, { mediaPath: path(ids.customer, 3, "exe") })).rejects.toThrow(/INVALID_INPUT/);
      await expect(
        create(db, ids.customer, { mediaPath: path(ids.customer, 4, "mp4"), mediaType: "image" }),
      ).rejects.toThrow(/INVALID_INPUT/);
      await expect(
        create(db, ids.customer, { mediaPath: path(ids.customer, 5), productId: "30000000-0000-4000-8000-0000000000ff" }),
      ).rejects.toThrow(/PRODUCT_NOT_FOUND/);
      await expect(create(db, ids.customer, { mediaPath: path(ids.customer, 6), caption: "x".repeat(201) })).rejects.toThrow(
        /INVALID_INPUT/,
      );
      const [xp] = await owner<{ n: number }>(
        db,
        "select count(*)::int n from private.xp_ledger where user_id=$1 and source_type='event:story_posted'",
        [ids.customer],
      );
      expect(xp.n).toBe(1);
    } finally {
      await db.close();
    }
  });

  it("solo adultos publican y un local puede apagar las historias", async () => {
    const db = await setup();
    try {
      await expect(create(db, users.minor)).rejects.toThrow(/ADULT_REQUIRED/);
      await rpc(db, ids.admin, "venue_social_settings_save", { venueId: ids.venue, gifts_enabled: false, stories_enabled: false });
      await expect(create(db, ids.customer)).rejects.toThrow(/VENUE_STORIES_DISABLED/);
    } finally {
      await db.close();
    }
  });

  it("el feed respeta amistad y visibilidad; las públicas se ven en la página del local con enlace al producto", async () => {
    const db = await setup();
    try {
      await befriend(db);
      const priv = await create(db, ids.customer, { mediaPath: path(ids.customer, 1) });
      const pub = await create(db, ids.customer, { mediaPath: path(ids.customer, 2), visibility: "public" });
      expect((await feed(db, users.friend)).map((s) => s.id).sort()).toEqual([priv.id, pub.id].sort());
      expect(await feed(db, users.stranger)).toHaveLength(0);
      const venue = await feed(db, users.stranger, { scope: "venue", venueId: ids.venue });
      expect(venue.map((s) => s.id)).toEqual([pub.id]);
      expect(venue[0].product_link).toMatch(/^\/v\/[a-z0-9-]+\/p\/[0-9a-f-]{36}$/);
      expect((await feed(db, ids.customer))[0].mine).toBe(true);
      await expect(feed(db, users.friend, { scope: "venue" })).rejects.toThrow(/INVALID_INPUT/);
    } finally {
      await db.close();
    }
  });

  it("vencen a las 24 h, se pueden borrar y solo su autor las borra", async () => {
    const db = await setup();
    try {
      await befriend(db);
      const s = await create(db, ids.customer);
      await owner(db, "update public.drink_stories set expires_at=now()-interval '1 minute' where id=$1", [s.id]);
      expect(await feed(db, users.friend)).toHaveLength(0);
      const t = await create(db, ids.customer, { mediaPath: path(ids.customer, 9) });
      await expect(rpc(db, users.friend, "story_delete", t.id)).rejects.toThrow(/NOT_FOUND/);
      await rpc(db, ids.customer, "story_delete", t.id);
    } finally {
      await db.close();
    }
  });

  it("tres reportes la ocultan; ONZA modera y ve los reportes; reportar dos veces no cuenta doble", async () => {
    const db = await setup();
    try {
      const s = await create(db, ids.customer, { visibility: "public" });
      const report = (who: string) => rpc<{ hidden?: boolean; replayed?: boolean }>(db, who, "story_report", s.id, "Contenido ofensivo");
      await expect(rpc(db, ids.customer, "story_report", s.id, "Contenido ofensivo")).rejects.toThrow(/NOT_FOUND/);
      await expect(rpc(db, users.friend, "story_report", s.id, "x")).rejects.toThrow(/INVALID_INPUT/);
      expect((await report(users.friend)).hidden).toBe(false);
      expect((await report(users.friend)).replayed).toBe(true);
      expect((await report(users.stranger)).hidden).toBe(false);
      expect((await report(users.minor)).hidden).toBe(true);
      expect(await feed(db, ids.customer, { scope: "venue", venueId: ids.venue })).toHaveLength(0);
      const reports = await rpc<{ story_id: string; reports: number; hidden: boolean }[]>(db, "onza", "story_admin_reports");
      expect(reports[0]).toMatchObject({ story_id: s.id, reports: 3, hidden: true });
      await expect(rpc(db, ids.customer, "story_admin_reports")).rejects.toThrow(/NOT_AUTHORIZED/);
      await rpc(db, "onza", "story_moderate", s.id, false);
      expect(await feed(db, ids.customer, { scope: "venue", venueId: ids.venue })).toHaveLength(1);
      await rpc(db, "onza", "story_moderate", s.id, true, "Spam");
      expect(await feed(db, ids.customer, { scope: "venue", venueId: ids.venue })).toHaveLength(0);
    } finally {
      await db.close();
    }
  });

  it("nadie accede directo a las tablas ni a las funciones internas", async () => {
    const db = await setup();
    try {
      await actor(db, ids.customer, "dev-x", false);
      for (const sql of [
        "select * from public.drink_stories",
        "select * from private.drink_gifts",
        "select * from public.venue_social_settings",
        "select private.are_friends(auth.uid(),auth.uid())",
        "select private.gift_sweep()",
      ])
        await expect(db.query(sql)).rejects.toThrow(/permission denied/);
    } finally {
      await db.close();
    }
  });

  it("bucket privado: cada persona sube a su carpeta y solo lee lo que la base le permite ver", async () => {
    const db = await setup();
    try {
      await installStorageStub(db);
      await db.exec(readFileSync("supabase/migrations/202611270032_stories_storage.sql", "utf8"));
      await befriend(db);
      await create(db, ids.customer, { mediaPath: path(ids.customer, 1) });
      await create(db, ids.customer, { mediaPath: path(ids.customer, 2), visibility: "public" });
      const insert = (who: string, name: string) =>
        actor(db, who, `s-${who.slice(-3)}`, false).then(() =>
          db.query("insert into storage.objects(bucket_id,name) values('stories',$1)", [name]),
        );
      await insert(ids.customer, path(ids.customer, 1));
      await insert(ids.customer, path(ids.customer, 2));
      await expect(insert(ids.customer, path(users.friend, 3))).rejects.toThrow();
      await expect(insert(ids.customer, `${ids.customer}/x/story-1.jpg`)).rejects.toThrow();
      await expect(insert(ids.customer, `${ids.customer}/foto.jpg`)).rejects.toThrow();
      const visible = async (who: string) => {
        await actor(db, who, `r-${who.slice(-3)}`, false);
        return (await db.query<{ name: string }>("select name from storage.objects where bucket_id='stories' order by name")).rows.map((r) => r.name);
      };
      expect(await visible(users.friend)).toHaveLength(2);
      expect(await visible(users.stranger)).toEqual([path(ids.customer, 2)]);
      await db.exec("reset role");
      expect((await db.query<{ public: boolean }>("select public from storage.buckets where id='stories'")).rows[0].public).toBe(false);
    } finally {
      await db.close();
    }
  });
});
