// Uploads the original drink illustrations in public/demo-products to the venue-images bucket (one folder per venue) and
// links them to the demo drinks. Idempotent and non-destructive (see scripts/lib/product-images-seed.mjs). Service role is
// used only here, never in the web runtime.
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { seedProductImages } from "./lib/product-images-seed.mjs";
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
const readAsset = (type) => {
  const file = new URL(`../public/demo-products/${type}.png`, import.meta.url);
  return existsSync(file) ? { body: readFileSync(file) } : null;
};
const summary = await seedProductImages({ db, supabaseUrl: url, readAsset });
console.log("Imágenes demo de tragos listas:", summary);
