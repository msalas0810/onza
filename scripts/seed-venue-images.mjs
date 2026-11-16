// Uploads the original placeholder art in public/demo-venues to the venue-images bucket and links it to the demo venues.
// Idempotent and non-destructive (see scripts/lib/venue-images-seed.mjs). Service role is used only here, never in the web runtime.
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { seedVenueImages } from "./lib/venue-images-seed.mjs";
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
const readAsset = (slug, kind) => {
  const file = new URL(
    `../public/demo-venues/${slug}-${kind}.${kind === "cover" ? "jpg" : "png"}`,
    import.meta.url,
  );
  return existsSync(file) ? { body: readFileSync(file) } : null;
};
const summary = await seedVenueImages({ db, supabaseUrl: url, readAsset });
console.log("Imágenes demo de locales listas:", summary);
