import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isConfigured, supabaseConfig } from "@/lib/supabase/config";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isConfigured()) return response;
  const { url, key } = supabaseConfig();
  const db = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  await db.auth.getUser();
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|brand|fonts|favicon.ico|manifest.webmanifest).*)",
  ],
};
