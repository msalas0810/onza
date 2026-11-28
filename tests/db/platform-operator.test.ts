import { describe, it, expect } from "vitest";
import { database, ids } from "./helpers";
import { OPERATOR_EMAIL, account, as, asOperator, call, owner } from "./platform-helpers";

const noAccess = /NOT_FOUND/;

describe("super administrador: lista de operadores", () => {
  it("hay una única fila (el correo autorizado) y nadie puede agregar, cambiar ni borrar operadores", async () => {
    const db = await database();
    try {
      expect(await owner(db, "select email,role from private.platform_operators")).toEqual([
        { email: OPERATOR_EMAIL, role: "super_admin" },
      ]);
      await expect(
        owner(db, "insert into private.platform_operators(email) values('otro@ejemplo.com')"),
      ).rejects.toThrow(/OPERATOR_LIST_LOCKED/);
      await expect(owner(db, "update private.platform_operators set email='otro@ejemplo.com'")).rejects.toThrow(/OPERATOR_LIST_LOCKED/);
      await expect(owner(db, "delete from private.platform_operators")).rejects.toThrow(/OPERATOR_LIST_LOCKED/);
      await expect(
        owner(db, "insert into private.platform_operators(email) values('Mayus@Ejemplo.com')"),
      ).rejects.toThrow();
    } finally {
      await db.close();
    }
  });

  it("solo el script de operación (interruptor local a su transacción) puede agregar un operador", async () => {
    const db = await database();
    try {
      await db.exec("reset role");
      await db.exec(
        "begin; select set_config('onza.allow_operator_change','on',true); insert into private.platform_operators(email) values('futuro@ejemplo.com'); commit",
      );
      expect((await owner<{ n: number }>(db, "select count(*)::int n from private.platform_operators"))[0].n).toBe(2);
      await expect(owner(db, "insert into private.platform_operators(email) values('otro@ejemplo.com')")).rejects.toThrow(/OPERATOR_LIST_LOCKED/);
    } finally {
      await db.close();
    }
  });

  it("la aplicación y los usuarios no leen ni escriben la tabla de operadores", async () => {
    const db = await database();
    try {
      const id = await account(db, OPERATOR_EMAIL);
      await as(db, id, OPERATOR_EMAIL, { aal: "aal2", mfaMinutesAgo: 1 });
      await expect(db.query("select * from private.platform_operators")).rejects.toThrow(/permission denied/);
      await expect(db.query("insert into private.platform_operators(email) values('x@y.com')")).rejects.toThrow(/permission denied/);
      await expect(db.query("select private.require_platform(false)")).rejects.toThrow(/permission denied/);
    } finally {
      await db.close();
    }
  });
});

describe("super administrador: quién entra", () => {
  it("el correo autorizado, verificado y coincidente entra (sin importar mayúsculas)", async () => {
    const db = await database();
    try {
      const id = await account(db, "Admin.CholiEmpresas@Gmail.com");
      await as(db, id, "ADMIN.CHOLIEMPRESAS@GMAIL.COM");
      expect(await call(db, "platform_access", false)).toMatchObject({ ok: true });
    } finally {
      await db.close();
    }
  });

  it("otro correo, correo sin verificar, invitado, sin correo y correo cambiado reciben NOT_FOUND", async () => {
    const db = await database();
    try {
      const other = await account(db, "otra@ejemplo.com");
      await as(db, other, "otra@ejemplo.com", { aal: "aal2", mfaMinutesAgo: 1 });
      await expect(call(db, "platform_access", false)).rejects.toThrow(noAccess);

      const unverified = await account(db, OPERATOR_EMAIL, false, "10000000-0000-4000-8000-0000000000f2");
      await as(db, unverified, OPERATOR_EMAIL, { aal: "aal2", mfaMinutesAgo: 1 });
      await expect(call(db, "platform_access", false)).rejects.toThrow(noAccess);

      const guest = await account(db, OPERATOR_EMAIL, true, "10000000-0000-4000-8000-0000000000f3");
      await as(db, guest, OPERATOR_EMAIL, { anonymous: true });
      await expect(call(db, "platform_access", false)).rejects.toThrow(noAccess);

      const noEmail = await account(db, OPERATOR_EMAIL, true, "10000000-0000-4000-8000-0000000000f4");
      await as(db, noEmail, null, { tokenEmail: null });
      await expect(call(db, "platform_access", false)).rejects.toThrow(noAccess);

      // El token todavía dice el correo del operador, pero la cuenta ya cambió de correo: el acceso se pierde.
      const moved = await account(db, OPERATOR_EMAIL, true, "10000000-0000-4000-8000-0000000000f5");
      await as(db, moved, OPERATOR_EMAIL);
      await owner(db, "update auth.users set email='nuevo@ejemplo.com' where id=$1", [moved]);
      await as(db, moved, OPERATOR_EMAIL);
      await expect(call(db, "platform_access", false)).rejects.toThrow(noAccess);
      // Y un token con otro correo no sirve aunque la cuenta conserve el del operador.
      await owner(db, "update auth.users set email=$2 where id=$1", [moved, OPERATOR_EMAIL]);
      await as(db, moved, OPERATOR_EMAIL, { tokenEmail: "otro@ejemplo.com" });
      await expect(call(db, "platform_access", false)).rejects.toThrow(noAccess);
    } finally {
      await db.close();
    }
  });

  it("un consumidor, un usuario de empresa y un administrador de local reciben NOT_FOUND", async () => {
    const db = await database();
    try {
      await owner(
        db,
        `insert into auth.users(id,email,email_confirmed_at) values('${ids.customer}','cliente@ejemplo.com',now()),('${ids.staff}','barra@ejemplo.com',now()),('${ids.admin}','admin@ejemplo.com',now())
         on conflict(id) do update set email=excluded.email,email_confirmed_at=excluded.email_confirmed_at`,
      );
      for (const [id, email] of [
        [ids.customer, "cliente@ejemplo.com"],
        [ids.staff, "barra@ejemplo.com"],
        [ids.admin, "admin@ejemplo.com"],
      ])
        for (const sensitive of [false, true]) {
          await as(db, id, email, { aal: "aal2", mfaMinutesAgo: 1 });
          await expect(call(db, "platform_access", sensitive)).rejects.toThrow(noAccess);
        }
    } finally {
      await db.close();
    }
  });

  it("el rol público y anónimo no pueden ni llamar a la función", async () => {
    const db = await database();
    try {
      await db.exec("reset role");
      await db.exec("set role anon");
      await expect(db.query("select public.platform_access(false)")).rejects.toThrow(/permission denied/);
      await as(db, await account(db, OPERATOR_EMAIL), OPERATOR_EMAIL);
      await expect(db.query("select public.platform_is_operator_email('a@b.com')")).rejects.toThrow(/permission denied/);
    } finally {
      await db.close();
    }
  });
});

describe("super administrador: segundo factor para acciones sensibles", () => {
  it("sin segundo factor solo hay lectura", async () => {
    const db = await database();
    try {
      await asOperator(db, { aal: "aal1" });
      expect(await call(db, "platform_access", false)).toMatchObject({ ok: true, mfa_recent: false });
      await expect(call(db, "platform_access", true)).rejects.toThrow(/REAUTH_REQUIRED/);
    } finally {
      await db.close();
    }
  });

  it("exige un segundo factor verificado en los últimos 15 minutos", async () => {
    const db = await database();
    try {
      await asOperator(db, { aal: "aal2", mfaMinutesAgo: 5 });
      expect(await call(db, "platform_access", true)).toMatchObject({ ok: true, mfa_recent: true });
      await asOperator(db, { aal: "aal2", mfaMinutesAgo: 14 });
      expect(await call(db, "platform_access", true)).toMatchObject({ ok: true });
      await asOperator(db, { aal: "aal2", mfaMinutesAgo: 16 });
      await expect(call(db, "platform_access", true)).rejects.toThrow(/REAUTH_REQUIRED/);
      // Un aal2 sin marca de segundo factor reciente, un método que no es segundo factor o un aal1 con marca no valen.
      await asOperator(db, { aal: "aal2", mfaMinutesAgo: 1, mfaMethod: "password" });
      await expect(call(db, "platform_access", true)).rejects.toThrow(/REAUTH_REQUIRED/);
      await asOperator(db, { aal: "aal1", mfaMinutesAgo: 1 });
      await expect(call(db, "platform_access", true)).rejects.toThrow(/REAUTH_REQUIRED/);
      // La llave de seguridad cuenta como segundo factor.
      await asOperator(db, { aal: "aal2", mfaMinutesAgo: 1, mfaMethod: "webauthn" });
      expect(await call(db, "platform_access", true)).toMatchObject({ ok: true });
    } finally {
      await db.close();
    }
  });

  it("quien no es el operador recibe NOT_FOUND aunque tenga un segundo factor fresco (nunca REAUTH_REQUIRED)", async () => {
    const db = await database();
    try {
      const other = await account(db, "otra@ejemplo.com");
      await as(db, other, "otra@ejemplo.com", { aal: "aal2", mfaMinutesAgo: 0 });
      await expect(call(db, "platform_access", true)).rejects.toThrow(noAccess);
    } finally {
      await db.close();
    }
  });
});

describe("super administrador: auditoría", () => {
  it("solo el operador lee la auditoría global; nadie la escribe ni la edita", async () => {
    const db = await database();
    try {
      await owner(db, "select private.audit('org.create','organization','x',null,null,'{\"a\":1}','{\"requestId\":\"r-1\",\"ip\":\"203.0.113.9\"}')");
      const other = await account(db, "otra@ejemplo.com");
      await as(db, other, "otra@ejemplo.com", { aal: "aal2", mfaMinutesAgo: 1 });
      expect((await db.query("select * from public.platform_audit")).rows).toHaveLength(0);
      await expect(db.query("insert into public.platform_audit(action,entity) values('hack','x')")).rejects.toThrow(/permission denied/);
      await expect(db.query("update public.platform_audit set action='x'")).rejects.toThrow(/permission denied/);
      await expect(db.query("delete from public.platform_audit")).rejects.toThrow(/permission denied/);
      await expect(db.query("select private.audit('x','y','z',null,null)")).rejects.toThrow(/permission denied/);

      await asOperator(db);
      const rows = (await db.query<{ request_id: string; ip: string }>("select request_id,ip from public.platform_audit")).rows;
      expect(rows).toEqual([{ request_id: "r-1", ip: "203.0.113.9" }]);
      await expect(db.query("insert into public.platform_audit(action,entity) values('hack','x')")).rejects.toThrow(/permission denied/);
      await expect(owner(db, "update public.platform_audit set action='x'")).rejects.toThrow(/APPEND_ONLY/);
      await expect(owner(db, "delete from public.platform_audit")).rejects.toThrow(/APPEND_ONLY/);
    } finally {
      await db.close();
    }
  });
});
