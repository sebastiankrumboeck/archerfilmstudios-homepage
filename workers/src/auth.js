export async function hashPassword(pw) {
  const salt = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const data = new TextEncoder().encode(`${salt}:${pw}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${salt}$${hash}`;
}

export async function verifyPassword(pw, stored) {
  if (!stored?.includes('$')) {
    // legacy unsalted hash
    const data = new TextEncoder().encode(`archer:${pw}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('') === stored;
  }
  const [salt, hash] = stored.split('$');
  const data = new TextEncoder().encode(`${salt}:${pw}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('') === hash;
}

export function uid(prefix = 'id') {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function nowISO() {
  return new Date().toISOString();
}

export async function getSessionUser(c) {
  const cookie = c.req.header('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)(?:app-session|__Host-session)=([^;]+)/);
  if (!match) return null;
  const row = await c.env.DB.prepare('SELECT s.*, u.is_admin FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?')
    .bind(match[1], nowISO()).first();
  return row ?? null;
}

export async function requireUser(c, next) {
  const session = await getSessionUser(c);
  if (!session) return c.json({ ok: false, error: 'Please log in.' }, 401);
  c.set('session', session);
  await next();
}

export async function requireAdmin(c, next) {
  const session = await getSessionUser(c);
  if (!session) return c.json({ ok: false, error: 'Please log in.' }, 401);
  if (!session.is_admin) return c.json({ ok: false, error: 'Admins only.' }, 403);
  c.set('session', session);
  await next();
}
