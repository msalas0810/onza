import { chromium } from "playwright";
import { createServerClient } from "@supabase/ssr";
import { writeFileSync } from "node:fs";
const origin = "http://127.0.0.1:3000",
  venue = "20000000-0000-4000-8000-000000000001";
const browser = await chromium.launch({ channel: "chrome" });
const checks = [];
const failures = [];
async function auth(context, alias) {
  const values = [];
  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { cookies: { getAll: () => [], setAll: (c) => values.push(...c) } },
  );
  const { error } = await db.auth.signInWithPassword({
    email: process.env[`DEMO_${alias}_EMAIL`],
    password: process.env[`DEMO_${alias}_PASSWORD`],
  });
  if (error) throw new Error("Authentication failed; details omitted");
  await context.addCookies(
    values.map(({ name, value }) => ({
      name,
      value,
      domain: "127.0.0.1",
      path: "/",
      sameSite: "Lax",
    })),
  );
}
try {
  for (const width of [390, 1280])
    for (const theme of ["light", "dark"])
      for (const role of ["customer", "BARTENDER", "ADMIN"]) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          colorScheme: theme,
        });
        if (role !== "customer") await auth(context, role);
        const page = await context.newPage();
        page.on("pageerror", () =>
          failures.push({
            role,
            width,
            theme,
            type: "pageerror; details withheld",
          }),
        );
        const routes =
          role === "customer"
            ? [
                "/",
                "/v/sala-norte",
                "/v/sala-norte/p/30000000-0000-4000-8000-000000000001",
                "/orders",
                "/login",
              ]
            : role === "ADMIN"
              ? [`/admin/${venue}`]
              : [`/staff/${venue}`];
        for (const route of routes) {
          const response = await page.goto(origin + route);
          await page.waitForTimeout(600);
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          );
          const runtimeError = await page
            .getByText(
              /unsupported type.*use\(|react\.use|application error|client-side exception/i,
            )
            .count();
          checks.push({
            route,
            role,
            width,
            theme,
            status: response.status(),
            overflow,
            runtimeError: runtimeError > 0,
          });
          await page.addStyleTag({ content: "nextjs-portal{display:none}" });
          await page.screenshot({
            path: `docs/evidence/hosted/${role.toLowerCase()}-${width}-${theme}-${routes.indexOf(route)}.png`,
            fullPage: true,
            mask: [
              page.locator(".code"),
              page.locator("h2,h3,p").filter({ hasText: /#[A-F0-9]{6}/ }),
            ],
          });
        }
        await context.close();
      }
  writeFileSync(
    "docs/evidence/hosted/ui-checks.json",
    JSON.stringify({ checks, failures }, null, 2),
  );
  console.log(
    JSON.stringify({
      screens: checks.length,
      overflow: checks.filter((c) => c.overflow),
      runtimeErrors: checks.filter((c) => c.runtimeError),
      pageErrors: failures.length,
    }),
  );
  if (
    failures.length ||
    checks.some((c) => c.overflow || c.runtimeError || c.status !== 200)
  )
    process.exitCode = 1;
} finally {
  await browser.close();
}
