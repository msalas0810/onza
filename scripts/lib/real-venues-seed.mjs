// Idempotent, non-destructive seeding of the real demo venues. Pure logic (no env, no filesystem): `assetExists` and `db`
// are injected so it can be tested with a fake client. Real facts and simulated demo data stay separated in the fixture.
import { createHash } from "node:crypto";

export const FICTIONAL_SLUGS = ["sala-norte", "patio-central", "club-cero"];

/** Stable UUID derived from a name, so re-running never creates duplicates. Shape only; not a secret. */
export function stableId(namespace, name) {
  const hex = createHash("sha1").update(`${namespace}:${name}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Image only if the file exists AND has an entry with source and license in SOURCES.json. */
export function approvedAsset(sources, venue, kind, assetExists) {
  const entry = sources.assets?.find(
    (a) => a.venue === venue && a.kind === kind && a.source_url && a.license,
  );
  return entry && assetExists(entry.file)
    ? `/demo-venues/real/${entry.file}`
    : null;
}

/** Coordinates only with a verified source; never invented. */
export function verifiedCoordinates(facts) {
  const c = facts.coordinates;
  if (
    !c ||
    !Number.isFinite(c.latitude) ||
    !Number.isFinite(c.longitude) ||
    !c.verified_on ||
    !c.source
  )
    return { latitude: null, longitude: null };
  return { latitude: c.latitude, longitude: c.longitude };
}

export async function seedRealVenues({
  db,
  fixture,
  sources,
  assetExists,
  log = console.log,
}) {
  const summary = {
    venues: 0,
    categories: 0,
    products: 0,
    hidden: 0,
    memberships: 0,
    images: 0,
  };
  const { error: columnError } = await db
    .from("venues")
    .select("demo_listed")
    .limit(1);
  if (columnError)
    throw new Error(
      `Falta la columna venues.demo_listed. Aplicá primero la migración 202611170012_demo_listing.sql: ${columnError.message}`,
    );
  for (const entry of fixture.venues) {
    const { facts, demo } = entry;
    const id = stableId("onza-real-venue", entry.slug);
    const cover = approvedAsset(sources, entry.slug, "cover", assetExists);
    const logo = approvedAsset(sources, entry.slug, "logo", assetExists);
    const row = {
      id,
      slug: entry.slug,
      name: facts.name,
      zone: facts.zone,
      open_state: demo.open_state,
      pickup_label: demo.pickup_label,
      hours: demo.hours,
      eta_minutes: demo.eta_minutes,
      capacity: demo.capacity,
      demo_listed: true,
      ...verifiedCoordinates(facts),
      cover_url: cover,
      logo_url: logo,
    };
    // Never replaces an existing record: an admin's edits to a venue survive any re-run.
    const { data: existing, error } = await db
      .from("venues")
      .select("id")
      .eq("slug", entry.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!existing) {
      const { error: insertError } = await db.from("venues").insert(row);
      if (insertError) throw new Error(`${entry.slug}: ${insertError.message}`);
      summary.venues++;
    } else {
      // Only fills images/listing that are still empty; never overwrites what exists.
      const patch = {};
      const { data: current } = await db
        .from("venues")
        .select("id,cover_url,logo_url,demo_listed")
        .eq("id", existing.id)
        .single();
      if (cover && !current.cover_url) patch.cover_url = cover;
      if (logo && !current.logo_url) patch.logo_url = logo;
      if (Object.keys(patch).length) {
        const { error: patchError } = await db
          .from("venues")
          .update(patch)
          .eq("id", existing.id);
        if (patchError) throw new Error(patchError.message);
      }
    }
    if (cover || logo) summary.images++;
    const venueId = existing?.id ?? id;
    const menu = fixture.menus[demo.menu] ?? [];
    for (const [position, [label, items]] of menu.entries()) {
      const categoryId = stableId(
        "onza-real-category",
        `${entry.slug}:${label}`,
      );
      const { error: categoryError } = await db
        .from("categories")
        .upsert(
          { id: categoryId, venue_id: venueId, label, position: position + 1 },
          { onConflict: "id", ignoreDuplicates: true },
        );
      if (categoryError) throw new Error(categoryError.message);
      summary.categories++;
      for (const [name, description, colones, kind] of items) {
        const { error: productError } = await db.from("products").upsert(
          {
            id: stableId("onza-real-product", `${entry.slug}:${name}`),
            venue_id: venueId,
            category_id: categoryId,
            name,
            description,
            price_minor: colones * 100,
            available: true,
            image_url: `/demo-products/${kind}.png`,
          },
          { onConflict: "id", ignoreDuplicates: true },
        );
        if (productError) throw new Error(productError.message);
        summary.products++;
      }
    }
  }
  // The fictional demo venues stop being listed (not deleted): orders and staff keep working and it is reversible.
  const { data: hidden, error: hideError } = await db
    .from("venues")
    .update({ demo_listed: false })
    .in("slug", FICTIONAL_SLUGS)
    .eq("demo_listed", true)
    .select("id");
  if (hideError) throw new Error(hideError.message);
  summary.hidden = hidden?.length ?? 0;
  log("Locales reales listos:", summary);
  return summary;
}
