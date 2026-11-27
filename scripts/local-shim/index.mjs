// Servidor de verificación local: las migraciones REALES sobre PGlite detrás de la parte de la API de Supabase que usa la app
// (REST de tablas, RPC y Auth). Sirve para recorrer la app completa sin red ni proyecto remoto.
//
// NO es Supabase: sin Realtime, sin Storage, sin contraseñas reales (cualquier contraseña entra) y sin límites de tasa.
// Los resultados de una ejecución contra este servidor no sustituyen la verificación contra onza-dev.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { stableId } from "../lib/real-venues-seed.mjs";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const MIGRATIONS = [
  "202611150001_core.sql",
  "202611150003_platform.sql",
  "202611160004_explicit_private_permissions.sql",
  "202611160005_venue_images.sql",
  "202611160007_product_images.sql",
  "202611160008_secure_pickup.sql",
  "202611160009_venue_coordinates.sql",
  "202611170010_customer_accounts.sql",
  "202611170011_team_management.sql",
  "202611170012_demo_listing.sql",
  "202611190013_order_window_availability.sql",
  "202611190014_profile_avatar.sql",
  "202611190016_summary_range.sql",
  "202611190017_venue_cover_focus.sql",
  "202611190018_abuse_waitlist.sql",
  "202611190019_auto_accept.sql",
  "202611190020_profile_details.sql",
  "202611210021_audit_hardening.sql",
  "202611210022_revoke_public_table_writes.sql",
  "202611210023_scale_fixes.sql",
  "202611210024_resolve_rate_limit.sql",
  "202611270025_loyalty_foundation.sql",
];
const TABLES = new Set([
  "venues",
  "categories",
  "products",
  "memberships",
  "staff_accounts",
  "profiles",
  "orders",
  "order_items",
  "order_events",
]);
export const SERVICE_KEY = "local-shim-service-role";
export const PUBLISHABLE_KEY = "local-shim-publishable";

// Personas de la verificación. Los identificadores son fijos para poder crear sesiones sin pasar por el formulario.
export const people = {
  maria: {
    id: "10000000-0000-4000-8000-0000000000b1",
    email: "maria@correo.demo",
    name: "María Solís",
    username: "mariasolis",
    kind: "customer",
  },
  sofia: {
    id: "10000000-0000-4000-8000-0000000000b2",
    email: "sofia@correo.demo",
    name: "Sofía Vargas",
    username: "sofiav",
    kind: "customer",
  },
  jorge: {
    id: "10000000-0000-4000-8000-0000000000c1",
    email: "jorge@equipo.demo",
    name: "Jorge Mora",
    kind: "staff",
  },
  ana: {
    id: "10000000-0000-4000-8000-0000000000c2",
    email: "ana@equipo.demo",
    name: "Ana Rojas",
    kind: "staff",
  },
  luis: {
    id: "10000000-0000-4000-8000-0000000000c3",
    email: "luis@equipo.demo",
    name: "Luis Brenes",
    kind: "staff",
  },
};

export async function createDatabase() {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);
     create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
     create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;
     grant usage on schema auth to authenticated,anon;grant execute on all functions in schema auth to authenticated,anon;`,
  );
  for (const file of MIGRATIONS)
    await db.exec(read(`supabase/migrations/${file}`));
  await db.exec(read("supabase/seed.sql"));
  const fixture = JSON.parse(read("fixtures/real-venues.json"));
  const q = (v) =>
    v === null || v === undefined
      ? "null"
      : `'${String(v).replaceAll("'", "''")}'`;
  for (const { slug, facts, demo } of fixture.venues) {
    const venueId = stableId("onza-real-venue", slug);
    await db.exec(
      `insert into public.venues(id,slug,name,zone,open_state,pickup_label,hours,eta_minutes,capacity) values(${q(venueId)},${q(slug)},${q(facts.name)},${q(facts.zone)},${q(demo.open_state)},${q(demo.pickup_label)},${q(demo.hours)},${demo.eta_minutes},${demo.capacity})`,
    );
    for (const [position, [label, items]] of fixture.menus[
      demo.menu
    ].entries()) {
      const categoryId = stableId("onza-real-category", `${slug}:${label}`);
      await db.exec(
        `insert into public.categories(id,venue_id,label,position) values(${q(categoryId)},${q(venueId)},${q(label)},${position + 1})`,
      );
      for (const [name, description, colones, kind] of items)
        await db.exec(
          `insert into public.products(id,venue_id,category_id,name,description,price_minor,image_url) values(${q(stableId("onza-real-product", `${slug}:${name}`))},${q(venueId)},${q(categoryId)},${q(name)},${q(description)},${colones * 100},'/demo-products/${kind}.png')`,
        );
    }
  }
  await db.exec(
    `update public.venues set demo_listed=false where slug in ('sala-norte','patio-central','club-cero')`,
  );
  for (const p of Object.values(people))
    await db.exec(
      `insert into auth.users(id,email) values(${q(p.id)},${q(p.email)})`,
    );
  for (const p of [people.maria, people.sofia])
    await db.exec(
      `insert into public.profiles(user_id,full_name,username,phone_country,phone_e164,birth_date,terms_version,privacy_version,terms_accepted_at) values(${q(p.id)},${q(p.name)},${q(p.username)},'+506','+50688887777','1995-05-05','borrador-1','borrador-1',now())`,
    );
  const id = (slug) => stableId("onza-real-venue", slug);
  await db.exec(`
    insert into public.staff_accounts(user_id,display_name,must_change_password) values
      (${q(people.jorge.id)},'Jorge Mora',false),(${q(people.ana.id)},'Ana Rojas',false),(${q(people.luis.id)},'Luis Brenes',true);
    insert into public.memberships(user_id,venue_id,role) values
      (${q(people.jorge.id)},${q(id("mil948"))},'bartender'),
      (${q(people.ana.id)},${q(id("mil948"))},'admin'),
      (${q(people.ana.id)},${q(id("stiefel-pub"))},'bartender'),
      (${q(people.luis.id)},${q(id("mil948"))},'bartender');
  `);
  return db;
}

const claims = (userId) => ({
  sub: userId,
  role: "authenticated",
  is_anonymous: false,
  session_id: `shim-${userId}`,
});
const tokenOf = (id) => `t.${id}`;
const userOf = (token) => (token?.startsWith("t.") ? token.slice(2) : null);
const sessionFor = (person) => ({
  access_token: tokenOf(person.id),
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: `r.${person.id}`,
  user: userJson(person),
});
const userJson = (p) => ({
  id: p.id,
  aud: "authenticated",
  role: "authenticated",
  email: p.email,
  email_confirmed_at: new Date().toISOString(),
  is_anonymous: false,
  app_metadata: { provider: "email" },
  user_metadata: { full_name: p.name },
  created_at: new Date().toISOString(),
});

export async function startShim({ port = 54321, quiet = true } = {}) {
  const db = await createDatabase();
  const passwords = new Map();
  const extra = new Map(); // personas creadas desde la app (alta de equipo)
  // Ganchos SOLO de verificación (no existen en Supabase): fallas transitorias inyectadas y registro de cierres de sesión.
  const faults = { user: 0, account: 0 };
  const logouts = [];
  let lock = Promise.resolve();
  const serial = (task) => {
    const next = lock.then(task, task);
    lock = next.catch(() => undefined);
    return next;
  };
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Expose-Headers": "*",
  };
  const send = (res, status, body, extraHeaders = {}) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      ...cors,
      ...extraHeaders,
    });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };
  const findPerson = async (key, value) => {
    const { rows } = await db.query(
      `select id,email from auth.users where ${key}=$1`,
      [value],
    );
    if (!rows[0]) return null;
    const known =
      Object.values(people).find((p) => p.id === rows[0].id) ??
      extra.get(rows[0].id);
    return (
      known ?? { id: rows[0].id, email: rows[0].email, name: rows[0].email }
    );
  };
  const asRole = async (auth, fn) => {
    const token = auth?.replace(/^Bearer /i, "");
    const service = token === SERVICE_KEY;
    const userId = userOf(token);
    return serial(() =>
      db.transaction(async (tx) => {
        if (!service) {
          await tx.query("select set_config('request.jwt.claims',$1,true)", [
            userId ? JSON.stringify(claims(userId)) : "",
          ]);
          await tx.exec(`set local role ${userId ? "authenticated" : "anon"}`);
        }
        return fn(tx);
      }),
    );
  };
  const failure = (res, error) => {
    const message = error?.message ?? String(error);
    const permission = /permission denied/i.test(message);
    send(res, permission ? 403 : 400, {
      code: error?.code ?? "P0001",
      message,
      details: null,
      hint: null,
    });
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://shim");
    if (req.method === "OPTIONS") return send(res, 204);
    let body = "";
    for await (const chunk of req) body += chunk;
    const json = body ? JSON.parse(body) : {};
    const auth = req.headers.authorization ?? "";
    try {
      /* ---------- Auth ---------- */
      if (url.pathname === "/auth/v1/user" && req.method === "GET") {
        if (faults.user > 0) {
          faults.user--;
          return send(res, 503, { code: 503, msg: "fallo transitorio inyectado" });
        }
        const id = userOf(auth.replace(/^Bearer /i, ""));
        const person = id && (await findPerson("id", id));
        return person
          ? send(res, 200, userJson(person))
          : send(res, 401, { code: 401, msg: "invalid JWT" });
      }
      if (url.pathname === "/auth/v1/user" && req.method === "PUT") {
        const id = userOf(auth.replace(/^Bearer /i, ""));
        const person = id && (await findPerson("id", id));
        if (!person) return send(res, 401, { code: 401, msg: "invalid JWT" });
        if (json.password) {
          if (passwords.get(person.id) === json.password)
            return send(res, 422, {
              code: 422,
              error_code: "same_password",
              msg: "New password should be different from the old password.",
            });
          passwords.set(person.id, json.password);
        }
        return send(res, 200, userJson(person));
      }
      if (url.pathname === "/auth/v1/token") {
        const person =
          url.searchParams.get("grant_type") === "refresh_token"
            ? await findPerson(
                "id",
                String(json.refresh_token).replace(/^r\./, ""),
              )
            : await findPerson("email", String(json.email ?? "").toLowerCase());
        if (!person)
          return send(res, 400, {
            code: 400,
            error_code: "invalid_credentials",
            msg: "Invalid login credentials",
          });
        return send(res, 200, sessionFor(person));
      }
      if (url.pathname === "/auth/v1/logout") {
        logouts.push({ scope: url.searchParams.get("scope") ?? "global", user: userOf(auth.replace(/^Bearer /i, "")) });
        return send(res, 204);
      }
      if (url.pathname === "/auth/v1/admin/users" && req.method === "POST") {
        if (auth.replace(/^Bearer /i, "") !== SERVICE_KEY)
          return send(res, 403, { msg: "not admin" });
        const exists = await findPerson("email", json.email);
        if (exists)
          return send(res, 422, {
            code: 422,
            error_code: "email_exists",
            msg: "A user with this email address has already been registered",
          });
        const id = crypto.randomUUID();
        await serial(() =>
          db.query("insert into auth.users(id,email) values($1,$2)", [
            id,
            json.email,
          ]),
        );
        const person = {
          id,
          email: json.email,
          name: json.user_metadata?.full_name ?? json.email,
        };
        extra.set(id, person);
        if (json.password) passwords.set(id, json.password);
        return send(res, 200, userJson(person));
      }
      const adminUser = url.pathname.match(
        /^\/auth\/v1\/admin\/users\/([0-9a-f-]{36})$/,
      );
      if (adminUser && req.method === "DELETE") {
        await serial(() =>
          db.query("delete from auth.users where id=$1", [adminUser[1]]),
        );
        return send(res, 200, {});
      }
      /* ---------- RPC ---------- */
      const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
      if (rpc) {
        if (rpc[1] === "current_account" && faults.account > 0) {
          faults.account--;
          return send(res, 503, { code: "PGRST000", message: "fallo transitorio inyectado" });
        }
        const keys = Object.keys(json);
        const args = keys
          .map((k, i) => `${k.replace(/[^a-z_]/g, "")} => $${i + 1}`)
          .join(", ");
        const values = keys.map((k) =>
          typeof json[k] === "object" && json[k] !== null
            ? JSON.stringify(json[k])
            : json[k],
        );
        const result = await asRole(auth, (tx) =>
          tx.query(`select to_jsonb(public.${rpc[1]}(${args})) as r`, values),
        );
        const value = result.rows[0]?.r;
        return value === null || value === undefined
          ? send(res, 200, null)
          : send(res, 200, value);
      }
      /* ---------- Tablas ---------- */
      const table = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/);
      if (table && req.method === "GET") {
        if (!TABLES.has(table[1]))
          return send(res, 404, { message: "relation not exposed" });
        const where = [];
        const values = [];
        for (const [key, raw] of url.searchParams) {
          if (["select", "order", "limit", "offset"].includes(key)) continue;
          const [op, ...rest] = raw.split(".");
          const operand = rest.join(".");
          if (op === "eq") {
            values.push(operand);
            where.push(`"${key}"::text = $${values.length}`);
          } else if (op === "in") {
            const list = operand
              .replace(/^\(|\)$/g, "")
              .split(",")
              .map((s) => s.replace(/^"|"$/g, ""));
            const marks = list.map(
              (v) => (values.push(v), `$${values.length}`),
            );
            where.push(`"${key}"::text in (${marks.join(",")})`);
          } else if (op === "is")
            where.push(
              `"${key}" is ${operand === "null" ? "null" : operand === "true" ? "true" : "false"}`,
            );
        }
        const order = (url.searchParams.get("order") ?? "")
          .split(",")
          .filter(Boolean)
          .map((part) => {
            const [column, dir] = part.split(".");
            return `"${column.replace(/[^a-z_]/g, "")}" ${dir === "desc" ? "desc" : "asc"}`;
          });
        const sql = `select * from public.${table[1]}${where.length ? ` where ${where.join(" and ")}` : ""}${order.length ? ` order by ${order.join(", ")}` : ""}${url.searchParams.get("limit") ? ` limit ${Number(url.searchParams.get("limit"))}` : ""}${url.searchParams.get("offset") ? ` offset ${Number(url.searchParams.get("offset"))}` : ""}`;
        const result = await asRole(auth, (tx) => tx.query(sql, values));
        if (/vnd\.pgrst\.object/.test(req.headers.accept ?? "")) {
          if (result.rows.length !== 1)
            return send(res, 406, {
              code: "PGRST116",
              message: "JSON object requested, multiple (or no) rows returned",
              details: `The result contains ${result.rows.length} rows`,
              hint: null,
            });
          return send(res, 200, result.rows[0]);
        }
        return send(res, 200, result.rows);
      }
      // Solo verificación: SQL de fixtures (p. ej. membresías extra) con la clave de servicio. No existe en Supabase.
      if (url.pathname === "/__fixture/sql" && req.method === "POST") {
        if (!auth.endsWith(SERVICE_KEY)) return send(res, 401, { message: "requiere la clave de servicio del shim" });
        await serial(() => db.exec(json.sql));
        return send(res, 200, { ok: true });
      }
      if (url.pathname === "/__fixture/fault" && req.method === "POST") {
        if (!auth.endsWith(SERVICE_KEY)) return send(res, 401, { message: "requiere la clave de servicio del shim" });
        faults[json.target] = Number(json.count ?? 0);
        return send(res, 200, { ok: true });
      }
      if (url.pathname === "/__fixture/logouts") return send(res, 200, logouts);
      return send(res, 404, {
        message: `shim: ${req.method} ${url.pathname} no implementado`,
      });
    } catch (error) {
      if (!quiet) console.error("shim:", url.pathname, error.message);
      return failure(res, error);
    }
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${port}`,
    db,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      await db.close();
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.SHIM_PORT ?? 54321);
  const shim = await startShim({ port, quiet: false });
  console.log(
    `Servidor de verificación local en ${shim.url} (no es Supabase). Ctrl+C para salir.`,
  );
}
