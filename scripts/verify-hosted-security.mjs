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
    .select("version")
    .eq("id", product)
    .single();
  check("published product version readable", !published.error);
  const token = randomBytes(32).toString("base64url");
  const input = {
    action: "create",
    venueId: venue,
    items: [{ productId: product, quantity: 1, expectedProductVersion: 1 }],
    idempotencyKey: randomBytes(16).toString("hex"),
    termsVersion: "demo-v1",
    privacyVersion: "demo-v1",
    adult: true,
    scenario: "approved",
    tokenHash: createHash("sha256").update(token).digest("hex"),
    encryptedToken: "test-only-security-check",
  };
  const { data: order, error } = await a.rpc("onza_command", { input });
  check("order created server total", !error && order?.total_minor === 450000);
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
