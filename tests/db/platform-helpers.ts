import { randomUUID } from "node:crypto";
import { database } from "./helpers";

export type Db = Awaited<ReturnType<typeof database>>;
export const OPERATOR_EMAIL = "admin.choliempresas@gmail.com";

export type Claims = {
  /** Si es false, el correo del token no corresponde a una cuenta verificada. */
  confirmed?: boolean;
  aal?: "aal1" | "aal2";
  /** Minutos desde que se verificó el segundo factor. */
  mfaMinutesAgo?: number | null;
  mfaMethod?: string;
  anonymous?: boolean;
  /** Correo que lleva el token (puede diferir del vigente de la cuenta). */
  tokenEmail?: string | null;
};

/** Crea (o actualiza) una cuenta en auth.users y devuelve su id. */
export async function account(db: Db, email: string, confirmed = true, id: string = randomUUID()) {
  await db.exec("reset role");
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3) on conflict(id) do update set email=excluded.email,email_confirmed_at=excluded.email_confirmed_at",
    [id, email, confirmed ? new Date().toISOString() : null],
  );
  return id;
}

/** Actúa como una sesión con esos claims (igual que PostgREST con un JWT). */
export async function as(db: Db, id: string, email: string | null, claims: Claims = {}) {
  await db.exec("reset role");
  const amr =
    claims.mfaMinutesAgo === null || claims.mfaMinutesAgo === undefined
      ? [{ method: "password", timestamp: Math.floor(Date.now() / 1000) - 60 }]
      : [
          { method: "password", timestamp: Math.floor(Date.now() / 1000) - 3600 },
          { method: claims.mfaMethod ?? "totp", timestamp: Math.floor(Date.now() / 1000) - claims.mfaMinutesAgo * 60 },
        ];
  const token: Record<string, unknown> = {
    sub: id,
    session_id: `s-${id.slice(0, 8)}`,
    is_anonymous: claims.anonymous ?? false,
    aal: claims.aal ?? "aal1",
    amr,
  };
  const tokenEmail = claims.tokenEmail === undefined ? email : claims.tokenEmail;
  if (tokenEmail) token.email = tokenEmail;
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify(token)]);
  await db.exec("set role authenticated");
}

/** Operador autorizado con segundo factor verificado hace unos minutos. */
export async function asOperator(db: Db, claims: Claims = { aal: "aal2", mfaMinutesAgo: 2 }) {
  const id = await account(db, OPERATOR_EMAIL, true, "10000000-0000-4000-8000-0000000000f1");
  await as(db, id, OPERATOR_EMAIL, claims);
  return id;
}

export const owner = async <T = Record<string, unknown>>(db: Db, sql: string, params: unknown[] = []) => {
  await db.exec("reset role");
  if (params.length === 0) {
    // Sin parámetros se admiten varios comandos; se devuelven las filas del último.
    const results = await db.exec(sql);
    return (results[results.length - 1]?.rows ?? []) as T[];
  }
  return (await db.query<T>(sql, params)).rows;
};

/** Ejecuta una función pública como la sesión actual y devuelve el JSON. */
export async function call<T = Record<string, unknown>>(db: Db, fn: string, ...args: unknown[]) {
  const placeholders = args.map((_, i) => `$${i + 1}${typeof args[i] === "object" && args[i] !== null ? "::jsonb" : ""}`).join(",");
  const r = await db.query<{ r: T }>(
    `select public.${fn}(${placeholders}) as r`,
    args.map((a) => (typeof a === "object" && a !== null ? JSON.stringify(a) : a)),
  );
  return r.rows[0].r;
}
