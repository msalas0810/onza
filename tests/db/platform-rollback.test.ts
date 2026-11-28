import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { actor, command, createInput, database, ids } from "./helpers";
import { OPERATOR_EMAIL, account, as, call, owner } from "./platform-helpers";

const ups = [
  "202611280033_platform_operator",
  "202611280034_organizations",
  "202611280035_platform_rpc",
];
const sql = (kind: "migrations" | "rollbacks", name: string) =>
  readFileSync(`supabase/${kind}/${name}.${kind === "migrations" ? "sql" : "down.sql"}`, "utf8");

async function present(db: Awaited<ReturnType<typeof database>>) {
  const [r] = await owner<{ tables: number; functions: number; venue_cols: number; policy: string; trigger: number }>(
    db,
    `select
      (select count(*)::int from pg_tables where (schemaname,tablename) in (('public','organizations'),('public','org_memberships'),('public','org_invitations'),('public','platform_audit'),('private','platform_operators'),('private','organization_secrets'))) tables,
      (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname<>'platform_command' and (p.proname like 'platform\\_%' or p.proname like 'org\\_%' or p.proname like 'invitation\\_%'))
         or (n.nspname='private' and p.proname in ('is_platform_operator','require_platform','org_role','org_active','gate','sync_legacy_membership','audit','in_text'))) functions,
      (select count(*)::int from information_schema.columns where table_schema='public' and table_name='venues' and column_name in ('organization_id','publication_status','suspended_at','service_modes','brand_color')) venue_cols,
      (select qual from pg_policies where tablename='venues' and policyname='venues_read') policy,
      (select count(*)::int from pg_trigger where tgname='orders_block_unavailable') trigger`,
  );
  return r;
}

describe("migraciones del panel: reversión probada", () => {
  it("baja las tres en orden inverso, deja el sistema como estaba (con pedidos funcionando) y vuelve a subir", async () => {
    const db = await database();
    try {
      const up = await present(db);
      expect(up.tables).toBe(6);
      expect(up.functions).toBeGreaterThan(40);
      expect(up.venue_cols).toBe(5);
      expect(up.trigger).toBe(1);
      expect(up.policy).not.toBe("true");

      for (const name of [...ups].reverse()) await db.exec(sql("rollbacks", name));

      const down = await present(db);
      expect(down).toEqual({ tables: 0, functions: 0, venue_cols: 0, policy: "true", trigger: 0 });
      // Los datos y el flujo anteriores siguen intactos: un pedido se crea con normalidad.
      await actor(db, ids.customer, "dev-down", false);
      await command(db, createInput("tras-bajar"));
      // El local sigue visible para el público como antes.
      await actor(db, ids.customer, "anon-down", true);
      expect((await db.query("select 1 from public.venues where id=$1", [ids.venue])).rows).toHaveLength(1);

      // Subir otra vez: todo vuelve, incluida la fila única del operador, y la comprobación funciona.
      await db.exec("reset role");
      for (const name of ups) await db.exec(sql("migrations", name));
      const again = await present(db);
      expect(again.tables).toBe(6);
      expect(again.venue_cols).toBe(5);
      expect(again.trigger).toBe(1);
      expect(await owner(db, "select email from private.platform_operators")).toEqual([{ email: OPERATOR_EMAIL }]);
      const id = await account(db, OPERATOR_EMAIL);
      await as(db, id, OPERATOR_EMAIL);
      expect(await call(db, "platform_access", false)).toMatchObject({ ok: true });
      const stranger = await account(db, "otro@ejemplo.com");
      await as(db, stranger, "otro@ejemplo.com");
      await expect(call(db, "platform_access", false)).rejects.toThrow(/NOT_FOUND/);
    } finally {
      await db.close();
    }
  });

  it("cada migración tiene su reversión y cada reversión se puede aplicar dos veces sin error", async () => {
    const db = await database();
    try {
      for (const name of [...ups].reverse()) {
        await db.exec(sql("rollbacks", name));
        await db.exec(sql("rollbacks", name));
      }
      expect((await present(db)).tables).toBe(0);
    } finally {
      await db.close();
    }
  });
});
