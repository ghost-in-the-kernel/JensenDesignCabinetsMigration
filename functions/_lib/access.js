// Who is signed in to /admin. Cloudflare Access sits in front of /admin and /api/admin and does the
// login (a one-time code by email); this checks the token Access adds, so the admin stays shut even
// if Access were taken off a hostname by mistake.

let certs = { at: 0, keys: [] };

const b64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const part = (s) => JSON.parse(new TextDecoder().decode(b64url(s)));

async function keys(team) {
  if (Date.now() - certs.at > 3600_000 || !certs.keys.length) {
    const r = await fetch(`https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`);
    certs = { at: Date.now(), keys: (await r.json()).keys || [] };
  }
  return certs.keys;
}

/** The signed-in admin's email, or null. */
export async function adminEmail(request, env) {
  const host = new URL(request.url).hostname;
  // Local development only (wrangler pages dev, set in .dev.vars): no Access in front of localhost.
  if (env.DEV_ADMIN_EMAIL && (host === 'localhost' || host === '127.0.0.1')) return env.DEV_ADMIN_EMAIL;
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token || !env.ACCESS_TEAM || !env.ACCESS_AUD) return null;
  try {
    const [h, p, s] = token.split('.');
    const header = part(h), payload = part(p);
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(env.ACCESS_AUD) || payload.exp * 1000 < Date.now()
        || payload.iss !== `https://${env.ACCESS_TEAM}.cloudflareaccess.com`) return null;
    const jwk = (await keys(env.ACCESS_TEAM)).find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(s), new TextEncoder().encode(`${h}.${p}`));
    return ok ? payload.email || 'admin' : null;
  } catch {
    return null;
  }
}
