import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (
  process.env.DEMO_MODE !== "true" ||
  process.env.REAL_PAYMENTS_ENABLED !== "false" ||
  process.env.PAYMENT_PROVIDER !== "mock"
)
  throw new Error("Solo un proyecto demo aislado con pagos mock.");
if (!url || !key)
  throw new Error(
    "Configurá URL y SUPABASE_SERVICE_ROLE_KEY (solo para este script).",
  );
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const venues = {
  north: "20000000-0000-4000-8000-000000000001",
  patio: "20000000-0000-4000-8000-000000000002",
};
const definitions = [
  ["BARTENDER", venues.north, "bartender"],
  ["BARTENDER_2", venues.patio, "bartender"],
  ["ADMIN", venues.north, "admin"],
  ["ONZA", venues.north, "onza"],
];
let existing = [];
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw error;
  existing.push(...data.users);
  if (data.users.length < 100) break;
}
for (const [alias, venue_id, role] of definitions) {
  const email = process.env[`DEMO_${alias}_EMAIL`];
  const password = process.env[`DEMO_${alias}_PASSWORD`];
  if (!email && !password) continue;
  if (!email || !password || password.length < 12)
    throw new Error(
      `DEMO_${alias}: correo y contraseña de al menos 12 caracteres requeridos.`,
    );
  let user = existing.find((u) => u.email === email);
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
  }
  const { error } = await db
    .from("memberships")
    .upsert(
      { user_id: user.id, venue_id, role },
      { onConflict: "user_id,venue_id" },
    );
  if (error) throw error;
  console.log(`Cuenta ${alias} asignada: ${user.id} (${role})`);
}
// Personal (customer) demo account: confirmed, no venue membership, never staff.
// The profile is completed by the person in /onboarding (age, terms and preferences are theirs to give).
{
  const email = process.env.DEMO_CUSTOMER_EMAIL;
  const password = process.env.DEMO_CUSTOMER_PASSWORD;
  if (email || password) {
    if (!email || !password || password.length < 12)
      throw new Error(
        "DEMO_CUSTOMER: correo y contraseña de al menos 12 caracteres requeridos.",
      );
    const staffEmails = definitions
      .map(([alias]) => process.env[`DEMO_${alias}_EMAIL`])
      .filter(Boolean);
    if (staffEmails.includes(email))
      throw new Error(
        "DEMO_CUSTOMER debe ser un correo distinto de las cuentas del equipo.",
      );
    let user = existing.find((u) => u.email === email);
    if (!user) {
      const { data, error } = await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw error;
      user = data.user;
    }
    const { data: memberships, error } = await db
      .from("memberships")
      .select("venue_id")
      .eq("user_id", user.id);
    if (error) throw error;
    if (memberships.length)
      throw new Error(
        "DEMO_CUSTOMER ya tiene permisos laborales: usá otro correo.",
      );
    console.log(`Cuenta CUSTOMER lista: ${user.id}`);
  }
}
console.log(
  "Usuarios demo preparados. Las contraseñas existentes se conservan.",
);
