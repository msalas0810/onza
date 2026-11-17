import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isConfigured, supabaseConfig } from "@/lib/supabase/config";
import {
  accountsRequired,
  decideAccess,
  type Account,
} from "@/lib/access-policy";
const PASS_THROUGH = /^\/(api|auth)(\/|$)/;
const STAFF_AREA = /^\/(staff|admin|onza)(\/|$)|^\/equipo\/locales$/;
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
  const { pathname } = request.nextUrl;
  const { data } = await db.auth.getUser();
  if (pathname === "/login")
    return redirect(request, response, "/equipo/acceso");
  if (!accountsRequired() || PASS_THROUGH.test(pathname)) {
    // Aun sin cuentas obligatorias, una clave temporal pendiente no puede operar el área del equipo.
    if (
      !PASS_THROUGH.test(pathname) &&
      STAFF_AREA.test(pathname) &&
      data.user &&
      !data.user.is_anonymous
    ) {
      const { data: result } = await db.rpc("current_account");
      const value = result as Partial<Account> | null;
      if (value?.kind === "staff" && value.mustChangePassword)
        return redirect(request, response, "/equipo/clave");
    }
    return response;
  }
  let account: Account = { kind: "none", onboarded: false };
  if (data.user) {
    // The account kind is decided in the database (membership), never by the browser.
    const { data: result } = await db.rpc("current_account");
    const value = result as Partial<Account> | null;
    account = {
      kind: value?.kind ?? (data.user.is_anonymous ? "guest" : "customer"),
      onboarded: value?.onboarded === true,
      mustChangePassword: value?.mustChangePassword === true,
    };
  }
  const target = decideAccess(pathname, account);
  return target ? redirect(request, response, target) : response;
}
function redirect(request: NextRequest, current: NextResponse, target: string) {
  const next = NextResponse.redirect(new URL(target, request.url));
  current.cookies.getAll().forEach((cookie) => next.cookies.set(cookie));
  return next;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|brand|fonts|demo-venues|demo-products|favicon.ico|manifest.webmanifest).*)",
  ],
};
