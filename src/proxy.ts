import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isConfigured, supabaseConfig } from "@/lib/supabase/config";
import {
  accountsRequired,
  decideAccess,
  guestsAllowed,
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
  const { data, error: authError } = await db.auth.getUser();
  // Un fallo transitorio de Auth no es «sin sesión»: no se redirige al acceso ni se adivina la cuenta. Se pide reintentar.
  if (authError && transientFailure(authError) && !PASS_THROUGH.test(pathname))
    return retryResponse(request);
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
    const { data: result, error: accountError } =
      await db.rpc("current_account");
    // Si la base no responde NO se asume «cliente»: una cuenta del equipo terminaría en «cuenta personal sin acceso».
    if (accountError && !PASS_THROUGH.test(pathname))
      return retryResponse(request);
    const value = result as Partial<Account> | null;
    account = {
      kind: value?.kind ?? (data.user.is_anonymous ? "guest" : "customer"),
      onboarded: value?.onboarded === true,
      mustChangePassword: value?.mustChangePassword === true,
    };
  }
  const target = decideAccess(pathname, account, guestsAllowed());
  return target ? redirect(request, response, target) : response;
}
function transientFailure(error: { name?: string; status?: number }) {
  return (
    error.name === "AuthRetryableFetchError" ||
    (typeof error.status === "number" && error.status >= 500)
  );
}
/** Página mínima de reintento: 503 sin caché, con la ruta actual para volver a intentar. */
function retryResponse(request: NextRequest) {
  const here = request.nextUrl.pathname.replace(/[^A-Za-z0-9/_\-.%]/g, "");
  return new NextResponse(
    `<!doctype html><html lang="es-CR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Onza · Reintentá</title><body style="font-family:system-ui;margin:0;display:grid;min-height:100vh;place-items:center;background:#111;color:#f4f1ea"><main style="max-width:360px;padding:24px"><h1 style="font-size:1.25rem">No pudimos verificar tu sesión</h1><p>Es un problema temporal de conexión. Tu sesión y tus pedidos siguen guardados.</p><a href="${here}" style="color:inherit">Reintentar</a></main></body></html>`,
    {
      status: 503,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "retry-after": "3",
      },
    },
  );
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
