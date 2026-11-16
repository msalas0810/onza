// Idempotent seeding of demo venue images. Pure logic (no env, no filesystem) so it can be tested with a fake client.
export const BUCKET = "venue-images";
const demo = {
  cover: { name: "cover-demo.jpg", contentType: "image/jpeg" },
  logo: { name: "logo-demo.png", contentType: "image/png" },
};
const columns = { cover: "cover_url", logo: "logo_url" };

export function demoImageUrl(supabaseUrl, venueId, kind) {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET}/${venueId}/${demo[kind].name}`;
}

/**
 * Uploads the placeholder art for every venue that has it and points cover_url/logo_url at it.
 * - Re-running changes nothing: fixed object names, upload with upsert, update only when the value differs.
 * - Never overwrites an image an admin uploaded: if the column holds anything other than the demo URL, it is kept.
 * `readAsset(slug, kind)` returns { body } or null when there is no art for that venue.
 */
export async function seedVenueImages({
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
  const { data: venues, error } = await db
    .from("venues")
    .select("id,slug,cover_url,logo_url")
    .order("slug");
  if (error)
    throw new Error(
      `No se pudo leer venues (¿falta la migración 202611160005_venue_images.sql?): ${error.message}`,
    );
  const summary = { uploaded: 0, updated: 0, kept: 0, skipped: 0 };
  for (const venue of venues) {
    const patch = {};
    for (const kind of ["cover", "logo"]) {
      const asset = readAsset(venue.slug, kind);
      if (!asset) {
        log(`${venue.slug}: sin arte de ${kind}, se omite.`);
        summary.skipped++;
        continue;
      }
      const url = demoImageUrl(supabaseUrl, venue.id, kind);
      const current = venue[columns[kind]];
      if (current && current !== url) {
        log(`${venue.slug}: ${kind} propio del local, se conserva.`);
        summary.kept++;
        continue;
      }
      const { error: uploadError } = await db.storage
        .from(BUCKET)
        .upload(`${venue.id}/${demo[kind].name}`, asset.body, {
          contentType: demo[kind].contentType,
          cacheControl: "3600",
          upsert: true,
        });
      if (uploadError)
        throw new Error(
          `${venue.slug}: no se subió ${kind}: ${uploadError.message}`,
        );
      summary.uploaded++;
      if (current !== url) patch[columns[kind]] = url;
    }
    if (Object.keys(patch).length) {
      const { error: updateError } = await db
        .from("venues")
        .update(patch)
        .eq("id", venue.id);
      if (updateError)
        throw new Error(
          `${venue.slug}: no se guardó la URL: ${updateError.message}`,
        );
      summary.updated++;
      log(`${venue.slug}: ${Object.keys(patch).join(" y ")} actualizado.`);
    }
  }
  return summary;
}
