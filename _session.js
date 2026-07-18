// Stateless sessions — signed JWT (HS256) using Node's crypto. No database needed.
// Env var: JWT_SECRET — any long random string (e.g. `openssl rand -hex 32`)

import crypto from 'crypto';

const b64u = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();

const SESSION_DAYS = 30; // returning clients skip OTP for 30 days

export function issueToken(phone) {
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64u(
    JSON.stringify({
      phone,
      exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 3600,
    })
  );
  const sig = crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest();
  return `${header}.${payload}.${b64u(sig)}`;
}

/** Returns { phone } or null. Pass the raw Authorization header. */
export function verifyToken(authHeader) {
  try {
    const token = (authHeader || '').replace(/^Bearer\s+/i, '');
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;
    const expected = b64u(
      crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${h}.${p}`).digest()
    );
    if (!crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected))) return null;
    const payload = JSON.parse(fromB64u(p));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { phone: payload.phone };
  } catch {
    return null;
  }
}

export function requireAuth(req, res) {
  const session = verifyToken(req.headers.authorization);
  if (!session) {
    res.status(401).json({ ok: false, message: 'Session expired. Log in again.' });
    return null;
  }
  return session;
}
