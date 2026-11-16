import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (
  url !== "https://ukdjuubekpanizcmppod.supabase.co" ||
  process.env.DEMO_MODE !== "true" ||
  process.env.REAL_PAYMENTS_ENABLED !== "false"
)
  throw new Error("Dedicated mock project required");
const client = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const checks = [];
function check(name, ok) {
  checks.push({ name, passed: !!ok });
  if (!ok) throw new Error(`CHECK_FAILED: ${name}`);
}
try {
  const a = client(),
    b = client(),
    staff = client();
  check("anonymous A", !(await a.auth.signInAnonymously()).error);
  check("anonymous B", !(await b.auth.signInAnonymously()).error);
  const venue = "20000000-0000-4000-8000-000000000001";
  const product = "30000000-0000-4000-8000-000000000001";
  const published = await a
    .from("products")
    .select("version,price_minor")
    .eq("id", product)
    .single();
  check("published product version readable", !published.error);
  const token = randomBytes(32).toString("base64url");
  const input = {
    action: "create",
    venueId: venue,
    items: [
      {
        productId: product,
        quantity: 1,
        expectedProductVersion: published.data.version,
      },
    ],
    idempotencyKey: randomBytes(16).toString("hex"),
    termsVersion: "demo-v1",
    privacyVersion: "demo-v1",
    adult: true,
    scenario: "approved",
    tokenHash: createHash("sha256").update(token).digest("hex"),
    encryptedToken: "test-only-security-check",
  };
  const { data: order, error } = await a.rpc("onza_command", { input });
  check(
    "order created server total",
    !error && order?.total_minor === published.data.price_minor,
  );
  const own = await a.from("orders").select("id").eq("id", order.id);
  check("owner can read", !own.error && own.data.length === 1);
  const alien = await b.from("orders").select("id").eq("id", order.id);
  check("other anonymous cannot read", !alien.error && alien.data.length === 0);
  const denied = await b.rpc("onza_command", {
    input: { action: "get", orderId: order.id },
  });
  check("backend denies alien order", !!denied.error);
  const mutation = await a
    .from("orders")
    .update({ total_minor: 1 })
    .eq("id", order.id);
  check(
    "direct total update denied",
    !!mutation.error || mutation.data?.length === 0,
  );
  const membership = await a.from("memberships").insert({
    user_id: (await a.auth.getUser()).data.user.id,
    venue_id: venue,
    role: "admin",
  });
  check("anonymous cannot self grant role", !!membership.error);
  check(
    "patio staff authentication",
    !(
      await staff.auth.signInWithPassword({
        email: process.env.DEMO_BARTENDER_2_EMAIL,
        password: process.env.DEMO_BARTENDER_2_PASSWORD,
      })
    ).error,
  );
  const cross = await staff.from("orders").select("id").eq("venue_id", venue);
  check(
    "staff cannot read another venue",
    !cross.error && cross.data.length === 0,
  );
  const pause = await staff.rpc("onza_command", {
    input: { action: "venue_update", venueId: venue, paused: true },
  });
  check("staff cannot mutate another venue", !!pause.error);
  const cancel = await a.rpc("onza_command", {
    input: {
      action: "cancel",
      orderId: order.id,
      expectedVersion: order.version,
      idempotencyKey: randomBytes(16).toString("hex"),
      reason: "Prueba de seguridad completada",
    },
  });
  check(
    "test order canceled by owner",
    !cancel.error && cancel.data.status === "canceled",
  );
  const admin = client();
  check(
    "admin authentication",
    !(
      await admin.auth.signInWithPassword({
        email: process.env.DEMO_ADMIN_EMAIL,
        password: process.env.DEMO_ADMIN_PASSWORD,
      })
    ).error,
  );
  const original = await admin
    .from("products")
    .select("*")
    .eq("id", product)
    .single();
  const toggle = await admin.rpc("onza_command", {
    input: {
      action: "product_save",
      venueId: venue,
      productId: product,
      expectedVersion: original.data.version,
      available: !original.data.available,
    },
  });
  check(
    "admin changes availability",
    !toggle.error && toggle.data.available !== original.data.available,
  );
  const restore = await admin.rpc("onza_command", {
    input: {
      action: "product_save",
      venueId: venue,
      productId: product,
      expectedVersion: toggle.data.version,
      available: original.data.available,
    },
  });
  check(
    "availability restored",
    !restore.error && restore.data.available === original.data.available,
  );
  const venueBefore = await admin
    .from("venues")
    .select("paused")
    .eq("id", venue)
    .single();
  check(
    "admin pauses venue",
    !(
      await admin.rpc("onza_command", {
        input: { action: "venue_update", venueId: venue, paused: true },
      })
    ).error,
  );
  const paused = await a.rpc("onza_command", {
    input: {
      ...input,
      idempotencyKey: randomBytes(16).toString("hex"),
      items: [
        {
          productId: product,
          quantity: 1,
          expectedProductVersion: restore.data.version,
        },
      ],
    },
  });
  const resumed = await admin.rpc("onza_command", {
    input: {
      action: "venue_update",
      venueId: venue,
      paused: venueBefore.data.paused,
    },
  });
  check("venue pause restored", !resumed.error);
  check(
    "paused venue rejects client creation",
    !!paused.error && paused.error.message.includes("VENUE_PAUSED"),
  );
  const venueProfile = await admin
    .from("venues")
    .select("latitude,longitude")
    .eq("id", venue)
    .single();
  check("venue coordinates readable", !venueProfile.error);
  const sameLocation = await admin.rpc("update_venue_branding", {
    input: {
      venueId: venue,
      latitude: venueProfile.data.latitude,
      longitude: venueProfile.data.longitude,
    },
  });
  check(
    "admin saves existing venue coordinates without inventing location",
    !sameLocation.error,
  );
  const invalidLocation = await admin.rpc("update_venue_branding", {
    input: { venueId: venue, latitude: 91, longitude: 0 },
  });
  check("invalid coordinates rejected", !!invalidLocation.error);
  const crossLocation = await admin.rpc("update_venue_branding", {
    input: {
      venueId: "20000000-0000-4000-8000-000000000002",
      latitude: null,
      longitude: null,
    },
  });
  check("admin cannot change another venue coordinates", !!crossLocation.error);
  const { readFileSync } = await import("node:fs");
  const files = (await import("node:fs")).readdirSync("public/demo-products");
  const png = readFileSync(
    `public/demo-products/${files.find((f) => f.endsWith(".png"))}`,
  );
  const imagePath = `${venue}/product-verification-${randomBytes(8).toString("hex")}.png`;
  const beforeImage = await admin
    .from("products")
    .select("image_url")
    .eq("id", product)
    .single();
  let uploaded = false;
  try {
    const upload = await admin.storage
      .from("venue-images")
      .upload(imagePath, png, { contentType: "image/png", upsert: false });
    check("admin real Storage upload in own venue", !upload.error);
    uploaded = true;
    const imageUrl = admin.storage.from("venue-images").getPublicUrl(imagePath)
      .data.publicUrl;
    const savedImage = await admin.rpc("update_product_image", {
      input: { productId: product, imageUrl },
    });
    check(
      "admin saves real uploaded product image",
      !savedImage.error && savedImage.data.image_url === imageUrl,
    );
    const foreignImage = await staff.rpc("update_product_image", {
      input: { productId: product, imageUrl: null },
    });
    check("foreign bartender cannot edit product image", !!foreignImage.error);
    const foreignPath = `20000000-0000-4000-8000-000000000002/product-verification-${randomBytes(8).toString("hex")}.png`;
    const foreignUpload = await admin.storage
      .from("venue-images")
      .upload(foreignPath, png, { contentType: "image/png", upsert: false });
    if (!foreignUpload.error)
      await admin.storage.from("venue-images").remove([foreignPath]);
    check(
      "admin cannot upload to another venue Storage folder",
      !!foreignUpload.error,
    );
  } finally {
    const restoredImage = await admin.rpc("update_product_image", {
      input: { productId: product, imageUrl: beforeImage.data.image_url },
    });
    check("original product image restored", !restoredImage.error);
    if (uploaded)
      check(
        "temporary Storage image removed",
        !(await admin.storage.from("venue-images").remove([imagePath])).error,
      );
  }
  writeFileSync(
    "docs/evidence/hosted/security-checks.json",
    JSON.stringify({ projectRef: "ukdjuubekpanizcmppod", checks }, null, 2),
  );
  console.log(JSON.stringify({ passed: checks.length, checks }));
} catch (error) {
  console.error(
    error.message.startsWith("CHECK_FAILED:")
      ? error.message
      : "Hosted security check failed; sensitive details omitted.",
  );
  process.exitCode = 1;
}
