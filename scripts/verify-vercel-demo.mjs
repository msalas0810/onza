// Invoked through npm exec --package=vercel -- node --env-file=.env.local ...
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { createServerClient } from "@supabase/ssr";
const origin = "https://onza-demo-msalas0810.vercel.app",
  host = new URL(origin).hostname;
const endpoint =
  "/v1/projects/prj_ESobIM57nGYOpNXDhqMAo8Y163md/protection-bypass?teamId=team_0TPT2W9rhCAZ8hlVnEHmo5ve";
const secret = randomBytes(16).toString("hex");
function api(body) {
  execFileSync(
    "vercel",
    ["api", endpoint, "-X", "PATCH", "--input", "-", "--raw"],
    { input: JSON.stringify(body), stdio: ["pipe", "pipe", "pipe"] },
  );
}
let browser;
const checks = [];
const check = (name, ok) => {
  checks.push({ name, passed: !!ok });
  if (!ok) throw new Error(name);
};
try {
  api({ generate: { secret, note: "Temporary Onza deployment verification" } });
  browser = await chromium.launch({ channel: "chrome" });
  const aContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    bContext = await browser.newContext();
  for (const ctx of [aContext, bContext])
    await ctx.route(origin + "/**", (route) =>
      route.continue({
        headers: {
          ...route.request().headers(),
          "x-vercel-protection-bypass": secret,
        },
      }),
    );
  const a = await aContext.newPage(),
    b = await bContext.newPage();
  let errors = 0;
  let realtimeObserved = false;
  a.on("websocket", (socket) =>
    socket.on("framereceived", (frame) => {
      const payload = String(frame.payload);
      if (
        payload.includes("postgres_changes") &&
        /"status"\s*:\s*"preparing"/.test(payload)
      )
        realtimeObserved = true;
    }),
  );
  a.on("pageerror", () => errors++);
  b.on("pageerror", () => errors++);
  await a.goto(origin);
  check(
    "catalog HTTPS",
    (await a.getByRole("link").filter({ hasText: "Sala Norte" }).count()) > 0,
  );
  await a.goto(origin + "/v/sala-norte/p/30000000-0000-4000-8000-000000000001");
  await a.getByRole("button", { name: "Agregar", exact: true }).click();
  await a.goto(origin + "/checkout");
  await a.getByRole("checkbox").nth(0).check();
  await a.getByRole("checkbox").nth(1).check();
  await a.getByRole("button", { name: /^Pedir/ }).click();
  await a
    .getByRole("heading", { name: "Recibido · esperando al local", exact: true })
    .waitFor({ timeout: 30000 });
  check("guest order and mock reserve", true);
  const id = new URL(a.url()).pathname.split("/").at(-1);
  await a.reload();
  await a
    .getByRole("heading", { name: "Recibido · esperando al local", exact: true })
    .waitFor();
  check("order persists after refresh", true);
  const cookies = [];
  const auth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => [],
        setAll: (values) => {
          cookies.push(...values);
        },
      },
    },
  );
  const { error } = await auth.auth.signInWithPassword({
    email: process.env.DEMO_BARTENDER_EMAIL,
    password: process.env.DEMO_BARTENDER_PASSWORD,
  });
  check("bartender authentication", !error);
  await bContext.addCookies(
    cookies.map(({ name, value }) => ({
      name,
      value,
      domain: host,
      path: "/",
      secure: true,
      sameSite: "Lax",
    })),
  );
  await b.goto(origin + "/staff/20000000-0000-4000-8000-000000000001");
  const list = await a.evaluate(() =>
    fetch("/api/orders").then((r) => r.json()),
  );
  const order = list.find((o) => o.id === id);
  check("server reservation authorized", order?.payment_state === "authorized");
  const card = b.locator("article").filter({
    has: b.getByRole("heading", {
      name: "#" + order.public_code,
      exact: true,
    }),
  });
  await card.getByRole("button", { name: "Aceptar", exact: true }).click();
  await a
    .getByRole("heading", { name: "Preparando", exact: true })
    .waitFor({ timeout: 25000 });
  check("remote bartender accepts and client updates", true);
  await card.getByRole("button", { name: "Marcar listo" }).click();
  await a
    .getByRole("heading", { name: "Listo para retirar", exact: true })
    .waitFor({ timeout: 25000 });
  check("remote ready update", true);
  check("runtime errors absent", errors === 0);
  check("Realtime WebSocket event", realtimeObserved);
  // Pickup validation is expressly excluded: the user's reported issue remains open.
  const current = (
    await a.evaluate(() => fetch("/api/orders").then((r) => r.json()))
  ).find((o) => o.id === id);
  const canceled = await b.evaluate(
    async ({ id, version }) => {
      const r = await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          orderId: id,
          expectedVersion: version,
          idempotencyKey: crypto.randomUUID(),
          reason: "Verificación de despliegue completada, sin prueba de retiro",
        }),
      });
      return { ok: r.ok, body: await r.json() };
    },
    { id, version: current.version },
  );
  check(
    "test order canceled without capture",
    canceled.ok && canceled.body.status === "canceled",
  );
  writeFileSync(
    "docs/evidence/vercel-verification.json",
    JSON.stringify(
      {
        origin,
        checks,
        pickupValidation: "PENDING_USER_REPORTED_ISSUE_NOT_TESTED",
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ origin, checks, pickupValidation: "PENDING_NOT_TESTED" }),
  );
} catch (error) {
  if (error.stderr)
    console.error(
      String(error.stderr).replaceAll(secret, "[REDACTED]").slice(0, 1400),
    );
  console.error(
    "Deployment verification failed at: " +
      (checks.find((c) => !c.passed)?.name ??
        "browser step; credential details withheld"),
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
  try {
    api({ revoke: { secret, regenerate: false } });
  } catch {
    console.error("Temporary bypass revocation needs review");
    process.exitCode = 1;
  }
}
