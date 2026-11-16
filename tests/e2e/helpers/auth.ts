import { createServerClient } from "@supabase/ssr";
import { expect, type Page } from "@playwright/test";
export async function loginStaff(page: Page, alias = "BARTENDER") {
  const cookies: { name: string; value: string }[] = [];
  const auth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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
    email: process.env[`DEMO_${alias}_EMAIL`]!,
    password: process.env[`DEMO_${alias}_PASSWORD`]!,
  });
  if (error)
    throw new Error(
      `Staff authentication failed (${error.code ?? error.status}); credentials omitted.`,
    );
  await page.context().addCookies(
    cookies.map(({ name, value }) => ({
      name,
      value,
      domain: "127.0.0.1",
      path: "/",
      sameSite: "Lax" as const,
    })),
  );
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Tus espacios de trabajo" }),
  ).toBeVisible();
}
