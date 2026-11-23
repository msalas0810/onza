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
  // Con la sesión del equipo, el acceso entra directo a la barra o, si la persona administra un solo local, a su administración; con varios locales muestra la lista.
  await page.goto("/equipo/acceso");
  await expect(page).toHaveURL(/\/(staff\/|admin\/|equipo\/locales)/);
}
