/** CSRF allowlist: only the configured origin (each Worker environment has its own APP_ORIGIN).
 * Never trust the request Host or a suffix supplied by the client.
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
  return origin === canonical;
}
