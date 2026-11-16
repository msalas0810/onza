import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (
  url !== "https://ukdjuubekpanizcmppod.supabase.co" ||
  process.env.REAL_PAYMENTS_ENABLED !== "false"
)
  throw new Error("Dedicated mock project required");
const client = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const customer = client(),
  staff = client(),
  admin = client();
let channel, order;
try {
  if ((await customer.auth.signInAnonymously()).error)
    throw new Error("anonymous authentication");
  for (const [c, alias] of [
    [staff, "BARTENDER"],
    [admin, "ADMIN"],
  ])
    if (
      (
        await c.auth.signInWithPassword({
          email: process.env[`DEMO_${alias}_EMAIL`],
          password: process.env[`DEMO_${alias}_PASSWORD`],
        })
      ).error
    )
      throw new Error("staff authentication");
  const product = "30000000-0000-4000-8000-000000000001",
    venue = "20000000-0000-4000-8000-000000000001";
  const p = await customer
    .from("products")
    .select("version")
    .eq("id", product)
    .single();
  const token = randomBytes(32).toString("hex");
  const created = await customer.rpc("onza_command", {
    input: {
      action: "create",
      venueId: venue,
      items: [
        {
          productId: product,
          quantity: 1,
          expectedProductVersion: p.data.version,
        },
      ],
      idempotencyKey: randomBytes(16).toString("hex"),
      termsVersion: "demo-v1",
      privacyVersion: "demo-v1",
      adult: true,
      scenario: "approved",
      tokenHash: createHash("sha256").update(token).digest("hex"),
      encryptedToken: "test-only-realtime-check",
    },
  });
  if (created.error) throw new Error("creation");
  order = created.data;
  let receive;
  const event = new Promise((resolve) => (receive = resolve));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("subscription timeout")),
      20000,
    );
    channel = customer
      .channel("isolated-proof:" + order.id)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${order.id}`,
        },
        (payload) => {
          if (payload.new.status === "preparing") receive(true);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timer);
          resolve();
        }
      });
  });
  const accepted = await staff.rpc("onza_command", {
    input: {
      action: "accept",
      orderId: order.id,
      expectedVersion: order.version,
      idempotencyKey: randomBytes(16).toString("hex"),
    },
  });
  if (accepted.error) throw new Error("acceptance");
  let timer;
  const delivered = await Promise.race([
    event,
    new Promise(
      (_, reject) =>
        (timer = setTimeout(() => reject(new Error("event timeout")), 15000)),
    ),
  ]);
  clearTimeout(timer);
  if (!delivered) throw new Error("no event");
  const canceled = await admin.rpc("onza_command", {
    input: {
      action: "cancel",
      orderId: order.id,
      expectedVersion: accepted.data.version,
      idempotencyKey: randomBytes(16).toString("hex"),
      reason: "Prueba de Realtime completada",
    },
  });
  if (canceled.error) throw new Error("cleanup");
  const result = {
    projectRef: "ukdjuubekpanizcmppod",
    websocketSubscribed: true,
    postgresUpdateReceived: true,
    pollingUsed: false,
    testOrderCanceled: true,
  };
  writeFileSync(
    "docs/evidence/hosted/realtime-check.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} catch {
  console.error(
    "Realtime verification failed; credential and payload details omitted.",
  );
  process.exitCode = 1;
} finally {
  if (channel) await customer.removeChannel(channel);
  await Promise.all([
    customer.auth.signOut(),
    staff.auth.signOut(),
    admin.auth.signOut(),
  ]);
}
