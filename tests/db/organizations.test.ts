import { describe, it, expect } from "vitest";
import { command, createInput, database, ids, actor } from "./helpers";
import { OPERATOR_EMAIL, account, as, asOperator, owner } from "./platform-helpers";

const A = "a0000000-0000-4000-8000-000000000001";
const B = "b0000000-0000-4000-8000-000000000001";
const userA = "10000000-0000-4000-8000-00000000a0a1";
const userB = "10000000-0000-4000-8000-00000000b0b1";
const adminA = "10000000-0000-4000-8000-00000000a0a2";

async function world() {
  const db = await database();
  await owner(
    db,
    `insert into public.organizations(id,name,slug) values('${A}','Empresa A','empresa-a'),('${B}','Empresa B','empresa-b');
     update public.venues set organization_id='${A}' where id='${ids.venue}';
     update public.venues set organization_id='${B}' where id='${ids.patio}'`,
  );
  await account(db, "dueno.a@ejemplo.com", true, userA);
  await account(db, "dueno.b@ejemplo.com", true, userB);
  await account(db, "gerente.a@ejemplo.com", true, adminA);
  await owner(
    db,
    `insert into public.org_memberships(organization_id,user_id,role,venue_ids) values
      ('${A}','${userA}','owner',null),('${B}','${userB}','owner',null),('${A}','${adminA}','venue_manager',array['${ids.venue}']::uuid[])`,
  );
  return db;
}

describe("empresas: restricciones de datos", () => {
  it("valida slug, roles y que los locales asignados sean de la propia empresa", async () => {
    const db = await world();
    try {
      await expect(owner(db, "insert into public.organizations(name,slug) values('X Empresa','Mal Slug')")).rejects.toThrow();
      await expect(owner(db, "insert into public.organizations(name,slug) values('X Empresa','empresa-a')")).rejects.toThrow(/unique|duplicate/i);
      await expect(owner(db, "insert into public.organizations(name,slug,status) values('X Empresa','x-empresa','eliminada')")).rejects.toThrow();
      const u = await account(db, "nuevo@ejemplo.com");
      // venue_manager sin locales y owner con locales no son válidos.
      await expect(owner(db, `insert into public.org_memberships(organization_id,user_id,role) values('${A}','${u}','venue_manager')`)).rejects.toThrow();
      await expect(
        owner(db, `insert into public.org_memberships(organization_id,user_id,role,venue_ids) values('${A}','${u}','owner',array['${ids.venue}']::uuid[])`),
      ).rejects.toThrow();
      await expect(owner(db, `insert into public.org_memberships(organization_id,user_id,role) values('${A}','${u}','jefe')`)).rejects.toThrow();
      // Un local de la empresa B no se puede asignar a una membresía de la A.
      await expect(
        owner(db, `insert into public.org_memberships(organization_id,user_id,role,venue_ids) values('${A}','${u}','cashier',array['${ids.patio}']::uuid[])`),
      ).rejects.toThrow(/VENUE_NOT_IN_ORGANIZATION/);
      await owner(db, `insert into public.org_memberships(organization_id,user_id,role,venue_ids) values('${A}','${u}','analyst',null)`);
    } finally {
      await db.close();
    }
  });

  it("las invitaciones guardan solo el hash, una pendiente por correo y empresa", async () => {
    const db = await world();
    try {
      const hash = "a".repeat(64);
      await owner(db, `insert into public.org_invitations(organization_id,email,role,token_hash) values('${A}','nuevo@ejemplo.com','admin','${hash}')`);
      await expect(
        owner(db, `insert into public.org_invitations(organization_id,email,role,token_hash) values('${A}','nuevo@ejemplo.com','admin','${"b".repeat(64)}')`),
      ).rejects.toThrow(/unique|duplicate/i);
      await expect(
        owner(db, `insert into public.org_invitations(organization_id,email,role,token_hash) values('${A}','otro@ejemplo.com','admin','token-en-claro')`),
      ).rejects.toThrow();
      await expect(
        owner(db, `insert into public.org_invitations(organization_id,email,role,token_hash) values('${A}','Mayus@Ejemplo.com','admin','${"c".repeat(64)}')`),
      ).rejects.toThrow();
      const [row] = await owner<{ days: number }>(db, "select round(extract(epoch from expires_at-created_at)/86400)::int days from public.org_invitations");
      expect(row.days).toBe(7);
    } finally {
      await db.close();
    }
  });
});

describe("empresas: aislamiento por RLS", () => {
  it("cada empresa ve solo lo suyo; el operador ve todo; nadie más ve nada", async () => {
    const db = await world();
    try {
      const names = async () => (await db.query<{ slug: string }>("select slug from public.organizations order by slug")).rows.map((r) => r.slug);
      await as(db, userA, "dueno.a@ejemplo.com");
      expect(await names()).toEqual(["empresa-a"]);
      await as(db, userB, "dueno.b@ejemplo.com");
      expect(await names()).toEqual(["empresa-b"]);
      await asOperator(db);
      expect(await names()).toEqual(["empresa-a", "empresa-b"]);
      const stranger = await account(db, "consumidor@ejemplo.com");
      await as(db, stranger, "consumidor@ejemplo.com");
      expect(await names()).toEqual([]);
      // Una sesión anónima (JWT de invitado) no ve nada; el rol anónimo del catálogo ni siquiera tiene permiso.
      await actor(db, ids.customer, "anon-1", true);
      expect(await names()).toEqual([]);
      await db.exec("reset role");
      await db.exec("set role anon");
      await expect(db.query("select * from public.organizations")).rejects.toThrow(/permission denied/);
    } finally {
      await db.close();
    }
  });

  it("las membresías: el propietario ve las de su empresa, un gerente solo la propia, nunca las de otra empresa", async () => {
    const db = await world();
    try {
      const members = async () => (await db.query<{ user_id: string }>("select user_id from public.org_memberships")).rows.map((r) => r.user_id).sort();
      await as(db, userA, "dueno.a@ejemplo.com");
      expect(await members()).toEqual([userA, adminA].sort());
      await as(db, adminA, "gerente.a@ejemplo.com");
      expect(await members()).toEqual([adminA]);
      await as(db, userB, "dueno.b@ejemplo.com");
      expect(await members()).toEqual([userB]);
      await asOperator(db);
      expect(await members()).toHaveLength(3);
    } finally {
      await db.close();
    }
  });

  it("nadie de la aplicación (ni el operador) escribe estas tablas directo: todo pasa por funciones", async () => {
    const db = await world();
    try {
      for (const who of ["owner", "operator", "consumer"] as const) {
        if (who === "owner") await as(db, userA, "dueno.a@ejemplo.com");
        else if (who === "operator") await asOperator(db);
        else await as(db, await account(db, "consumidor@ejemplo.com"), "consumidor@ejemplo.com");
        for (const sql of [
          "insert into public.organizations(name,slug) values('Hack Empresa','hack-empresa')",
          "update public.organizations set name='Hack'",
          "delete from public.organizations",
          `insert into public.org_memberships(organization_id,user_id,role) values('${A}','${userA}','analyst')`,
          "update public.org_memberships set role='owner'",
          "select * from public.org_invitations",
          "insert into public.org_invitations(organization_id,email,role,token_hash) values(null,'a@b.co','admin','x')",
          "select * from private.organization_secrets",
        ])
          await expect(db.query(sql)).rejects.toThrow(/permission denied/);
      }
    } finally {
      await db.close();
    }
  });
});

describe("empresas: visibilidad de los locales", () => {
  const visible = async (db: Awaited<ReturnType<typeof database>>) =>
    (await db.query<{ id: string }>("select id from public.venues")).rows.map((r) => r.id);

  it("el público solo ve locales publicados, no suspendidos y de empresas activas; los anteriores al modelo siguen visibles", async () => {
    const db = await world();
    try {
      await actor(db, ids.customer, "anon-2", true);
      expect(await visible(db)).toEqual(expect.arrayContaining([ids.venue, ids.patio]));
      await owner(db, `update public.venues set publication_status='draft' where id='${ids.venue}'`);
      await actor(db, ids.customer, "anon-2", true);
      expect(await visible(db)).not.toContain(ids.venue);
      await owner(db, `update public.venues set publication_status='archived' where id='${ids.venue}'`);
      await actor(db, ids.customer, "anon-2", true);
      expect(await visible(db)).not.toContain(ids.venue);
      await owner(db, `update public.venues set publication_status='published',suspended_at=now() where id='${ids.venue}'`);
      await actor(db, ids.customer, "anon-2", true);
      expect(await visible(db)).not.toContain(ids.venue);
      await owner(db, `update public.venues set suspended_at=null where id='${ids.venue}'; update public.organizations set status='suspended' where id='${B}'`);
      await actor(db, ids.customer, "anon-2", true);
      const seen = await visible(db);
      expect(seen).toContain(ids.venue);
      expect(seen).not.toContain(ids.patio);
      // Locales sin empresa (anteriores al modelo): siguen publicados.
      await owner(db, `update public.venues set organization_id=null where id='${ids.patio}'`);
      await actor(db, ids.customer, "anon-2", true);
      expect(await visible(db)).toContain(ids.patio);
    } finally {
      await db.close();
    }
  });

  it("el operador, el equipo del local y los miembros de la empresa siguen viendo un local no publicado", async () => {
    const db = await world();
    try {
      await owner(db, `update public.venues set publication_status='draft' where id='${ids.venue}'`);
      await asOperator(db);
      expect(await visible(db)).toContain(ids.venue);
      await as(db, userA, "dueno.a@ejemplo.com");
      expect(await visible(db)).toContain(ids.venue);
      await as(db, adminA, "gerente.a@ejemplo.com");
      expect(await visible(db)).toContain(ids.venue);
      await as(db, userB, "dueno.b@ejemplo.com");
      expect(await visible(db)).not.toContain(ids.venue);
      await actor(db, ids.staff, "bar-1", false);
      expect(await visible(db)).toContain(ids.venue);
    } finally {
      await db.close();
    }
  });
});

describe("empresas: una empresa o un local suspendido no puede operar", () => {
  it("bloquea pedidos nuevos y los vuelve a permitir al reactivar", async () => {
    const db = await world();
    try {
      const order = async (key: string) => {
        await actor(db, ids.customer, `dev-${key}`, false);
        return command(db, createInput(key));
      };
      await order("ok-1");
      await owner(db, `update public.venues set suspended_at=now() where id='${ids.venue}'`);
      await expect(order("susp-venue")).rejects.toThrow(/VENUE_SUSPENDED/);
      await owner(db, `update public.venues set suspended_at=null where id='${ids.venue}'; update public.organizations set status='suspended' where id='${A}'`);
      await expect(order("susp-org")).rejects.toThrow(/ORGANIZATION_SUSPENDED/);
      await owner(db, `update public.organizations set status='closed' where id='${A}'`);
      await expect(order("closed-org")).rejects.toThrow(/ORGANIZATION_SUSPENDED/);
      await owner(db, `update public.organizations set status='active' where id='${A}'; update public.venues set publication_status='draft' where id='${ids.venue}'`);
      await expect(order("draft")).rejects.toThrow(/VENUE_UNAVAILABLE/);
      await owner(db, `update public.venues set publication_status='published' where id='${ids.venue}'`);
      await order("ok-2");
    } finally {
      await db.close();
    }
  });
});

void OPERATOR_EMAIL;
