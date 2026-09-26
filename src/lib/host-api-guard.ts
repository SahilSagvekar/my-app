// Deny-by-default API guard for Host Portal accounts.
//
// Why this exists: hundreds of API routes only check "is this a logged-in user"
// (a few dozen don't look at the role at all — client records, drive, media
// previews, task search, ...). Adding a new `host` role would silently give
// those accounts access to all of it. Instead of auditing every route, hosts
// are blocked from the whole /api surface except an explicit allow-list.
//
// Runs in the Worker entrypoint (worker.ts) before the request reaches Next.js.
// Dependency-free (Web Crypto only). FAILS OPEN: any problem reading or
// verifying the token lets the request through, so this guard can never take
// the app down or lock out other roles — it only ever *adds* a block for a
// verified, host-only JWT. (Route handlers still do their own auth.)

// Paths a host account may call. Everything else under /api/ is refused.
const HOST_ALLOWED_PREFIXES = [
  '/api/host/', // the Host Portal's own endpoints (always scoped to the caller)
  '/api/auth/', // session (me, otp, password reset, ...)
  '/api/login',
  '/api/logout',
  '/api/profile',
  '/api/user/navigation', // sidebar items for the current role
  '/api/portal/access', // app shell probe — harmless for non-clients
  '/api/health',
];

export function isHostAllowedPath(pathname: string): boolean {
  return HOST_ALLOWED_PREFIXES.some((p) => {
    const base = p.endsWith('/') ? p.slice(0, -1) : p;
    return pathname === base || pathname.startsWith(base + '/');
  });
}

function b64urlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Verifies an HS256 JWT and returns its payload, or null if invalid/expired. */
export async function verifyJwtHs256(token: string, secret: string): Promise<Record<string, any> | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;

  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
  if (header?.alg !== 'HS256') return null;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    b64urlToBytes(sig) as unknown as BufferSource,
    new TextEncoder().encode(`${h}.${p}`) as unknown as BufferSource
  );
  if (!ok) return null;

  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
  if (typeof payload?.exp === 'number' && payload.exp * 1000 < Date.now()) return null;
  return payload;
}

function readToken(request: Request): string | null {
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(/(?:^|;\s*)authToken=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);
  const auth = request.headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return null;
}

/**
 * Returns a 403 Response when the caller is a verified host-only account hitting a
 * non-allow-listed /api route; otherwise null (let the request through).
 */
export async function blockHostFromInternalApi(request: Request, env: { JWT_SECRET?: string }): Promise<Response | null> {
  try {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith('/api/') || isHostAllowedPath(pathname)) return null;

    const secret = env?.JWT_SECRET;
    const token = readToken(request);
    if (!secret || !token) return null;

    const payload = await verifyJwtHs256(token, secret);
    if (!payload) return null;

    const roles = [payload.role, ...(Array.isArray(payload.roles) ? payload.roles : [])]
      .filter((r): r is string => typeof r === 'string' && r.length > 0)
      .map((r) => r.toLowerCase());
    const hostOnly = roles.includes('host') && roles.every((r) => r === 'host');
    if (!hostOnly) return null;

    return new Response(JSON.stringify({ ok: false, error: 'Forbidden', message: 'Host accounts cannot access this resource' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  } catch {
    return null; // fail open — never break the app because of the guard
  }
}
