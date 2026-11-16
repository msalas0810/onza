/** CSRF allowlist: configured origin plus this Preview's exact platform-assigned URLs.
 * Never trust request Host, a suffix supplied by the client, or arbitrary Vercel projects.
 */
export function isAllowedRequestOrigin(
  request: Request,
  env: Record<string, string | undefined> = process.env,
) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const canonical =
    env.APP_ORIGIN ??
    (env.NODE_ENV !== "production" ? new URL(request.url).origin : undefined);
  if (origin === canonical) return true;
  if (env.VERCEL !== "1" || env.VERCEL_ENV !== "preview") return false;
  return [env.VERCEL_URL, env.VERCEL_BRANCH_URL].some(
    (host) =>
      !!host &&
      /^[a-z0-9-]+\.vercel\.app$/.test(host) &&
      origin === `https://${host}`,
  );
}
