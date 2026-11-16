// Idempotent seeding of demo drink images. Pure logic (no env, no filesystem) so it can be tested with a fake client.
export const BUCKET = "venue-images";

// Which illustration each demo drink gets. Matching is by name (lowercase, trimmed); unknown names are skipped.
export const drinkTypeByName = {
  paloma: "highball",
  negroni: "cocktail",
  "gin tonic": "highball",
  margarita: "cocktail",
  cerveza: "beer",
  "soda cítrica": "soft",
};

export function demoProductImageUrl(supabaseUrl, venueId, type) {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET}/${venueId}/product-demo-${type}.png`;
}

/**
 * Uploads the illustration of each demo drink into its own venue's folder and points products.image_url at it.
 * - Re-running changes nothing: fixed object names per venue and type, upload with upsert, update only when different.
 * - Never overwrites an image an admin chose: if image_url holds anything other than the demo URL, it is kept.
 * `readAsset(type)` returns { body } or null when there is no illustration for that type.
 */
export async function seedProductImages({
  db,
  supabaseUrl,
  readAsset,
  log = console.log,
}) {
  const bucket = await db.storage.getBucket(BUCKET);
  if (bucket.error || !bucket.data)
    throw new Error(
      `El bucket ${BUCKET} no existe. Aplicá primero la migración 202611160006_venue_images_storage.sql.`,
    );
  const { data: products, error } = await db
    .from("products")
    .select("id,venue_id,name,image_url")
    .order("venue_id")
    .order("name");
  if (error)
    throw new Error(
      `No se pudo leer products (¿falta la migración 202611160007_product_images.sql?): ${error.message}`,
    );
  const summary = { uploaded: 0, updated: 0, kept: 0, skipped: 0 };
  const uploaded = new Set();
  for (const product of products) {
    const type =
      drinkTypeByName[product.name.trim().toLocaleLowerCase("es-CR")];
    const asset = type ? readAsset(type) : null;
    if (!type || !asset) {
      log(`${product.name}: sin ilustración asignada, se omite.`);
      summary.skipped++;
      continue;
    }
    const url = demoProductImageUrl(supabaseUrl, product.venue_id, type);
    if (product.image_url && product.image_url !== url) {
      log(`${product.name}: imagen propia del local, se conserva.`);
      summary.kept++;
      continue;
    }
    const objectKey = `${product.venue_id}/product-demo-${type}.png`;
    if (!uploaded.has(objectKey)) {
      const { error: uploadError } = await db.storage
        .from(BUCKET)
        .upload(objectKey, asset.body, {
          contentType: "image/png",
          cacheControl: "3600",
          upsert: true,
        });
      if (uploadError)
        throw new Error(
          `${product.name}: no se subió ${type}: ${uploadError.message}`,
        );
      uploaded.add(objectKey);
      summary.uploaded++;
    }
    if (product.image_url !== url) {
      const { error: updateError } = await db
        .from("products")
        .update({ image_url: url })
        .eq("id", product.id);
      if (updateError)
        throw new Error(
          `${product.name}: no se guardó la URL: ${updateError.message}`,
        );
      summary.updated++;
      log(`${product.name}: imagen ${type} asignada.`);
    }
  }
  return summary;
}
