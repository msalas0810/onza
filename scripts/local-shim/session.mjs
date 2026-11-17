// Cookies de sesión para Playwright contra el servidor de verificación local (mismo formato que produce @supabase/ssr).
import { createServerClient } from "@supabase/ssr";
import { PUBLISHABLE_KEY } from "./index.mjs";

export async function sessionCookies(url, email, host = "127.0.0.1") {
  const cookies = [];
  const auth = createServerClient(url, PUBLISHABLE_KEY, {
    cookies: { getAll: () => [], setAll: (values) => cookies.push(...values) },
  });
  const { error } = await auth.auth.signInWithPassword({
    email,
    password: "cualquiera-largo-1",
  });
  if (error) throw new Error(`Sesión de ${email}: ${error.message}`);
  return cookies.map(({ name, value }) => ({
    name,
    value,
    domain: host,
    path: "/",
    sameSite: "Lax",
  }));
}
