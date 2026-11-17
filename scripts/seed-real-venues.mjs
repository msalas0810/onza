// Seeds the real demo venues (names and published locations with their sources; simulated menus and prices). Non-destructive
// and idempotent. Service role is used only here, never in the web runtime. Run only against the isolated demo project.
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { seedRealVenues } from "./lib/real-venues-seed.mjs";

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
const read = (path) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const summary = await seedRealVenues({
  db,
  fixture: read("../fixtures/real-venues.json"),
  sources: read("../public/demo-venues/real/SOURCES.json"),
  assetExists: (file) =>
    existsSync(new URL(`../public/demo-venues/real/${file}`, import.meta.url)),
});
// Existing demo staff accounts (no new credentials) also get access to the new venues, so the bar can be tried end to end.
const { data: members, error } = await db
  .from("memberships")
  .select("user_id,role");
if (error) throw error;
const { data: venues } = await db.from("venues").select("id,slug");
const real = new Set(
  read("../fixtures/real-venues.json").venues.map((v) => v.slug),
);
let granted = 0;
for (const venue of (venues ?? []).filter((v) => real.has(v.slug)))
  for (const m of members.filter((x) => x.role !== "onza")) {
    const { error: grantError } = await db
      .from("memberships")
      .upsert(
        { user_id: m.user_id, venue_id: venue.id, role: m.role },
        { onConflict: "user_id,venue_id", ignoreDuplicates: true },
      );
    if (grantError) throw grantError;
    granted++;
  }
console.log(
  `Cuentas demo del equipo con acceso a los locales reales: ${granted} asignaciones.`,
);
console.log("Resumen:", summary);
