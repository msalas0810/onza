import { describe, it, expect } from "vitest";
import { actor, command, database, ids } from "./helpers";

type Db = Awaited<ReturnType<typeof database>>;
const extra = {
  marta: "10000000-0000-4000-8000-0000000000a1", // administradora de otro local
  nuevo: "10000000-0000-4000-8000-0000000000a2", // empleado sin contraseña propia todavía
  cliente: "10000000-0000-4000-8000-0000000000a3", // cuenta personal con correo
};
async function setup() {
  const db = await database();
  await db.exec("reset role");
  await db.exec(`
    update auth.users set email='ana@equipo.demo' where id='${ids.admin}';
    update auth.users set email='jorge@equipo.demo' where id='${ids.staff}';
    insert into auth.users(id,email) values('${extra.marta}','marta@equipo.demo'),('${extra.nuevo}','nuevo@equipo.demo'),('${extra.cliente}','maria@correo.demo');
    insert into public.memberships(user_id,venue_id,role) values('${extra.marta}','${ids.patio}','admin'),('${ids.staff}','${ids.patio}','bartender');
    insert into public.staff_accounts(user_id,display_name) values('${ids.admin}','Ana Rojas'),('${ids.staff}','Jorge Mora');
  `);
  return db;
}
const as = (db: Db, user: string) => actor(db, user, "device", false);
async function fails(promise: Promise<unknown>, text: string) {
  await expect(promise).rejects.toThrow(text);
}
const team = async (db: Db, venue = ids.venue) =>
  (
    await db.query<{ r: { userId: string; role: string }[] }>(
      "select public.list_venue_team($1) as r",
      [venue],
    )
  ).rows[0].r;

describe("equipo del local (migración 011)", () => {
  it("solo el administrador del local ve el equipo; empleados, clientes y otros locales no", async () => {
    const db = await setup();
    try {
      await as(db, ids.admin);
      const list = await team(db);
      expect(list.map((m) => m.role).sort()).toEqual(["admin", "bartender"]);
      expect(list.find((m) => m.userId === ids.admin)).toMatchObject({
        self: true,
        email: "ana@equipo.demo",
      });
      for (const user of [ids.staff, ids.customer, extra.marta]) {
        await as(db, user);
        await fails(team(db), "NOT_AUTHORIZED");
      }
      await as(db, extra.marta);
      expect(await team(db, ids.patio)).toHaveLength(2);
    } finally {
      await db.close();
    }
  });

  it("cambiar permiso: solo admin, nunca el propio, nunca dejar el local sin administrador", async () => {
    const db = await setup();
    try {
      await as(db, ids.staff);
      await fails(
        db.query("select public.team_set_role($1,$2,'admin')", [
          ids.venue,
          ids.staff,
        ]),
        "NOT_AUTHORIZED",
      );
      await as(db, extra.marta);
      await fails(
        db.query("select public.team_set_role($1,$2,'admin')", [
          ids.venue,
          ids.staff,
        ]),
        "NOT_AUTHORIZED",
      );
      await as(db, ids.admin);
      await fails(
        db.query("select public.team_set_role($1,$2,'bartender')", [
          ids.venue,
          ids.admin,
        ]),
        "SELF_CHANGE",
      );
      await fails(
        db.query("select public.team_set_role($1,$2,'dueño')", [
          ids.venue,
          ids.staff,
        ]),
        "INVALID_ROLE",
      );
      await db.query("select public.team_set_role($1,$2,'admin')", [
        ids.venue,
        ids.staff,
      ]);
      // Con dos administradores, el segundo puede bajar al primero; con uno solo no.
      await as(db, ids.staff);
      await db.query("select public.team_set_role($1,$2,'bartender')", [
        ids.venue,
        ids.admin,
      ]);
      await as(db, ids.admin);
      await fails(team(db), "NOT_AUTHORIZED");
      await as(db, ids.staff);
      await fails(
        db.query("select public.team_set_role($1,$2,'bartender')", [
          ids.venue,
          ids.staff,
        ]),
        "SELF_CHANGE",
      );
    } finally {
      await db.close();
    }
  });

  it("quitar acceso borra solo la membresía de ese local y rechaza acciones posteriores allí", async () => {
    const db = await setup();
    try {
      // Jorge trabaja en dos locales.
      await as(db, ids.staff);
      await command(db, {
        action: "venue_update",
        venueId: ids.venue,
        paused: true,
      });
      await command(db, {
        action: "venue_update",
        venueId: ids.patio,
        paused: true,
      });
      await as(db, ids.admin);
      const { rows } = await db.query<{ r: { remainingMemberships: number } }>(
        "select public.team_revoke($1,$2) as r",
        [ids.venue, ids.staff],
      );
      expect(rows[0].r.remainingMemberships).toBe(1);
      await as(db, ids.staff);
      await fails(
        command(db, {
          action: "venue_update",
          venueId: ids.venue,
          paused: false,
        }),
        "NOT_AUTHORIZED",
      );
      expect(
        (await db.query("select public.has_venue_access($1) as r", [ids.venue]))
          .rows[0],
      ).toMatchObject({ r: false });
      // En el otro local sigue operando.
      await command(db, {
        action: "venue_update",
        venueId: ids.patio,
        paused: false,
      });
      expect(
        (await db.query("select count(*)::int as n from public.memberships"))
          .rows[0],
      ).toMatchObject({ n: 1 });
    } finally {
      await db.close();
    }
  });

  it("no se puede quitar el acceso propio, el del último administrador ni el de otro local", async () => {
    const db = await setup();
    try {
      await as(db, ids.admin);
      await fails(
        db.query("select public.team_revoke($1,$2)", [ids.venue, ids.admin]),
        "SELF_CHANGE",
      );
      await fails(
        db.query("select public.team_revoke($1,$2)", [ids.patio, extra.marta]),
        "NOT_AUTHORIZED",
      );
      await fails(
        db.query("select public.team_revoke($1,$2)", [ids.venue, extra.nuevo]),
        "NOT_MEMBER",
      );
      // El último administrador solo lo protege otro administrador que intente quitarlo: se prueba con dos.
      await db.query("select public.team_set_role($1,$2,'admin')", [
        ids.venue,
        ids.staff,
      ]);
      await db.query("select public.team_revoke($1,$2)", [
        ids.venue,
        ids.staff,
      ]);
      await as(db, ids.staff);
      await fails(team(db), "NOT_AUTHORIZED");
    } finally {
      await db.close();
    }
  });

  it("una persona del equipo sin locales sigue siendo del equipo, nunca cliente", async () => {
    const db = await setup();
    try {
      await as(db, ids.admin);
      await db.query("select public.team_revoke($1,$2)", [
        ids.venue,
        ids.staff,
      ]);
      await db
        .query("select public.team_revoke($1,$2)", [ids.patio, ids.staff])
        .catch(() => undefined);
      await as(db, extra.marta);
      await db.query("select public.team_revoke($1,$2)", [
        ids.patio,
        ids.staff,
      ]);
      await as(db, ids.staff);
      expect(
        (await db.query("select public.current_account() as r")).rows[0],
      ).toMatchObject({ r: { kind: "staff" } });
    } finally {
      await db.close();
    }
  });

  it("la contraseña temporal pendiente bloquea toda operación hasta cambiarla", async () => {
    const db = await setup();
    try {
      await db.exec("reset role");
      await db.exec(
        `update public.staff_accounts set must_change_password=true where user_id='${ids.staff}'`,
      );
      await as(db, ids.staff);
      expect(
        (await db.query("select public.current_account() as r")).rows[0],
      ).toMatchObject({ r: { kind: "staff", mustChangePassword: true } });
      expect(
        (await db.query("select public.has_venue_access($1) as r", [ids.venue]))
          .rows[0],
      ).toMatchObject({ r: false });
      await fails(
        command(db, {
          action: "venue_update",
          venueId: ids.venue,
          paused: true,
        }),
        "NOT_AUTHORIZED",
      );
      // No puede marcarse a sí misma como lista desde el navegador.
      await fails(
        db.query("select public.complete_password_change($1)", [ids.staff]),
        "permission denied",
      );
      await db.exec("reset role");
      await db.query("select public.complete_password_change($1)", [ids.staff]);
      await as(db, ids.staff);
      await command(db, {
        action: "venue_update",
        venueId: ids.venue,
        paused: true,
      });
    } finally {
      await db.close();
    }
  });

  it("las cuentas que ya existían (sin fila de equipo) siguen operando igual", async () => {
    const db = await setup();
    try {
      await db.exec("reset role");
      await db.exec(`delete from public.staff_accounts`);
      await as(db, ids.staff);
      await command(db, {
        action: "venue_update",
        venueId: ids.venue,
        paused: true,
      });
      expect(
        (await db.query("select public.current_account() as r")).rows[0],
      ).toMatchObject({ r: { kind: "staff" } });
    } finally {
      await db.close();
    }
  });

  it("alta: cuenta nueva con clave temporal, existente del equipo sin clave nueva, y el correo de un cliente se rechaza", async () => {
    const db = await setup();
    try {
      await db.exec("reset role");
      // El correo de una cuenta personal nunca se convierte ni se vincula.
      await fails(
        db.query(
          "select public.team_attach($1,$2,'María Solís','bartender',$3,false)",
          [ids.venue, extra.cliente, ids.admin],
        ),
        "CUSTOMER_EMAIL",
      );
      expect(
        (
          await db.query(
            "select public.team_lookup_email('MARIA@correo.demo') as r",
          )
        ).rows[0],
      ).toMatchObject({ r: { kind: "customer" } });
      expect(
        (
          await db.query(
            "select public.team_lookup_email('jorge@equipo.demo') as r",
          )
        ).rows[0],
      ).toMatchObject({ r: { kind: "staff" } });
      expect(
        (
          await db.query(
            "select public.team_lookup_email('nadie@equipo.demo') as r",
          )
        ).rows[0],
      ).toMatchObject({ r: { kind: "none" } });
      // Nueva: queda con clave temporal pendiente.
      await db.query(
        "select public.team_attach($1,$2,'Luis Brenes','bartender',$3,true)",
        [ids.venue, extra.nuevo, ids.admin],
      );
      expect(
        (
          await db.query(
            "select must_change_password from public.staff_accounts where user_id=$1",
            [extra.nuevo],
          )
        ).rows[0],
      ).toMatchObject({ must_change_password: true });
      await fails(
        db.query(
          "select public.team_attach($1,$2,'Luis Brenes','bartender',$3,true)",
          [ids.venue, extra.nuevo, ids.admin],
        ),
        "ALREADY_MEMBER",
      );
      // Existente del equipo en otro local: se agrega sin pedirle otra clave.
      await db.query(
        "select public.team_attach($1,$2,'Marta','bartender',$3,false)",
        [ids.venue, extra.marta, ids.admin],
      );
      expect(
        (
          await db.query(
            "select must_change_password from public.staff_accounts where user_id=$1",
            [extra.marta],
          )
        ).rows,
      ).toEqual([{ must_change_password: false }]);
      // Un empleado o el administrador de otro local no puede dar altas.
      await fails(
        db.query(
          "select public.team_attach($1,$2,'Otra','bartender',$3,true)",
          [ids.venue, extra.cliente, ids.staff],
        ),
        "NOT_AUTHORIZED",
      );
      await fails(
        db.query("select public.team_attach($1,$2,'Otra','admin',$3,true)", [
          ids.venue,
          extra.cliente,
          extra.marta,
        ]),
        "NOT_AUTHORIZED",
      );
    } finally {
      await db.close();
    }
  });

  it("las funciones de servidor no se pueden llamar desde el navegador y cada persona ve solo su fila", async () => {
    const db = await setup();
    try {
      await as(db, ids.admin);
      await fails(
        db.query("select public.team_lookup_email('x@y.z')"),
        "permission denied",
      );
      await fails(
        db.query("select public.team_attach($1,$2,'X Y','admin',$3,true)", [
          ids.venue,
          extra.nuevo,
          ids.admin,
        ]),
        "permission denied",
      );
      expect(
        (await db.query("select count(*)::int as n from public.staff_accounts"))
          .rows[0],
      ).toMatchObject({ n: 1 });
      await actor(db, ids.customer, "device", false);
      expect(
        (await db.query("select count(*)::int as n from public.staff_accounts"))
          .rows[0],
      ).toMatchObject({ n: 0 });
    } finally {
      await db.close();
    }
  });
});
