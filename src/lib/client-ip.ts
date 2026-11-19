/**
 * The address a request came from, for rate limits only.
 *
 * On Vercel, `x-real-ip` and the first entry of `x-forwarded-for` are set by
 * the platform from the connection itself, overwriting whatever the client
 * sent, so they cannot be forged to dodge a limit. Elsewhere (local, tests)
 * they may be missing, and every request then shares one bucket, which only
 * matters to someone testing the limits themselves.
 */
export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}
