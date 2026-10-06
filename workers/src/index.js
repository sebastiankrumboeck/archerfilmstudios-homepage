import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { hashPassword, verifyPassword, uid, nowISO, getSessionUser, requireUser, requireAdmin, requireKassier } from './auth.js';

const app = new Hono();

const ok = (c, data, status = 200) => c.json({ ok: true, data }, status);
const fail = (c, error, status = 400) => c.json({ ok: false, error }, status);
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e ?? '');
const publicUser = (u) => ({ id: u.id, name: u.name, function: u.function, avatar_r2_key: u.avatar_r2_key, is_admin: !!u.is_admin, is_vorstand: !!u.is_vorstand, vorstand_title: u.vorstand_title, is_kassier: !!u.is_kassier });

function sessionCookie(c, id) {
  const host = c.req.header('host') ?? '';
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
  setCookie(c, 'app-session', id, { httpOnly: true, secure: !isLocal, sameSite: 'Lax', path: '/', maxAge: 30 * 86400 });
}

// --- Auth ---
app.post('/api/auth/register', async (c) => {
  const { email, password, name, function: fn = '' } = await c.req.json();
  if (!isEmail(email)) return fail(c, 'Invalid email.', 400);
  if (!password || password.length < 8) return fail(c, 'Password must be at least 8 characters.', 400);
  if (!name?.trim()) return fail(c, 'Name is required.', 400);
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first();
  if (existing) return fail(c, 'Email already registered.', 409);
  const id = uid('u');
  await c.env.DB.prepare('INSERT INTO users (id, email, pass_hash, name, function, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, email.toLowerCase(), await hashPassword(password), name.trim(), fn, nowISO()).run();
  const sid = uid('s');
  await c.env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(sid, id, new Date(Date.now() + 30 * 864e5).toISOString()).run();
  sessionCookie(c, sid);
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  return ok(c, { user: publicUser(user) }, 201);
});

app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json();
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind((email ?? '').toLowerCase()).first();
  if (!user || !(await verifyPassword(password ?? '', user.pass_hash))) return fail(c, 'Wrong email or password.', 401);
  const sid = uid('s');
  await c.env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(sid, user.id, new Date(Date.now() + 30 * 864e5).toISOString()).run();
  sessionCookie(c, sid);
  return ok(c, { user: publicUser(user) });
});

app.post('/api/auth/logout', async (c) => {
  const sid = getCookie(c, 'app-session') ?? getCookie(c, '__Host-session');
  if (sid) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sid).run();
  deleteCookie(c, 'app-session');
  deleteCookie(c, '__Host-session');
  return ok(c, {});
});

app.get('/api/me', async (c) => {
  const session = await getSessionUser(c);
  if (!session) return fail(c, 'Please log in.', 401);
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.user_id).first();
  return ok(c, { user: publicUser(user) });
});

// --- Users ---
app.get('/api/users', requireUser, async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM users ORDER BY created_at').all();
  return ok(c, { users: results.map(publicUser), links: await vorstandLinkMap(c.env.DB) });
});

app.get('/api/users/:id', requireUser, async (c) => {
  const { id } = c.req.param();
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!user) return fail(c, 'Not found.', 404);
  const joined = await c.env.DB.prepare(
    'SELECT p.id, p.title FROM memberships m JOIN projects p ON p.id = m.project_id WHERE m.user_id = ? ORDER BY p.start_at',
  ).bind(id).all();
  const headed = await c.env.DB.prepare('SELECT id, title FROM projects WHERE head_user_id = ? ORDER BY start_at')
    .bind(id).all();
  return ok(c, { user: publicUser(user), projects: { joined: joined.results, headed: headed.results } });
});

app.patch('/api/users/:id', requireUser, async (c) => {
  const session = c.get('session');
  const { id } = c.req.param();
  if (id !== session.user_id && !session.is_admin) return fail(c, 'Admins only.', 403);
  const { name, function: fn } = await c.req.json();
  await c.env.DB.prepare('UPDATE users SET name = COALESCE(?, name), function = COALESCE(?, function) WHERE id = ?')
    .bind(name ?? null, fn ?? null, id).run();
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!user) return fail(c, 'Not found.', 404);
  return ok(c, { user: publicUser(user) });
});

app.patch('/api/users/:id/admin', requireAdmin, async (c) => {
  const { id } = c.req.param();
  const { is_admin } = await c.req.json();
  if (!is_admin) {
    const admins = await c.env.DB.prepare('SELECT id FROM users WHERE is_admin = 1').all();
    if (admins.results.length === 1 && admins.results[0].id === id) {
      return fail(c, 'Cannot remove the last admin.', 409);
    }
  }
  await c.env.DB.prepare('UPDATE users SET is_admin = ? WHERE id = ?').bind(is_admin ? 1 : 0, id).run();
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!user) return fail(c, 'Not found.', 404);
  return ok(c, { user: publicUser(user) });
});

app.patch('/api/users/:id/vorstand', requireAdmin, async (c) => {
  const { id } = c.req.param();
  const { is_vorstand, vorstand_title } = await c.req.json();
  await c.env.DB.prepare('UPDATE users SET is_vorstand = ?, vorstand_title = ? WHERE id = ?')
    .bind(is_vorstand ? 1 : 0, vorstand_title ?? null, id).run();
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!user) return fail(c, 'Not found.', 404);
  return ok(c, { user: publicUser(user) });
});

export const VORSTAND_SLOTS = ['obmann', 'obmann-stellvertreterin', 'kassier', 'kassier-stellvertreter', 'schriftfuehrer', 'schriftfuehrer-stellvertreter'];

async function vorstandLinkMap(db) {
  const { results } = await db.prepare('SELECT slot, user_id FROM vorstand_links').all();
  return Object.fromEntries((results ?? []).map((r) => [r.slot, r.user_id]));
}

app.get('/api/vorstand-links', requireUser, async (c) => {
  return ok(c, { links: await vorstandLinkMap(c.env.DB) });
});

app.put('/api/vorstand-links', requireAdmin, async (c) => {
  const { slot, user_id } = await c.req.json();
  if (!VORSTAND_SLOTS.includes(slot)) return fail(c, 'Unknown board seat.', 400);
  const headErr = validateHeadId(user_id);
  if (headErr) return fail(c, headErr, 400);
  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(user_id).first();
  if (!user) return fail(c, 'Unknown member.', 400);
  await c.env.DB.prepare('INSERT OR REPLACE INTO vorstand_links (slot, user_id) VALUES (?, ?)')
    .bind(slot, user_id).run();
  return ok(c, { links: await vorstandLinkMap(c.env.DB) });
});

app.delete('/api/vorstand-links/:slot', requireAdmin, async (c) => {
  await c.env.DB.prepare('DELETE FROM vorstand_links WHERE slot = ?').bind(c.req.param('slot')).run();
  return ok(c, { links: await vorstandLinkMap(c.env.DB) });
});

app.patch('/api/users/:id/kassier', requireAdmin, async (c) => {
  const { id } = c.req.param();
  const { is_kassier } = await c.req.json();
  await c.env.DB.prepare('UPDATE users SET is_kassier = ? WHERE id = ?')
    .bind(is_kassier ? 1 : 0, id).run();
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!user) return fail(c, 'Not found.', 404);
  return ok(c, { user: publicUser(user) });
});

// --- Dues & invoices (kassier-gated) ---
const YEARLY_CENTS = 1200;
const yearlyReason = (year) => `Mitgliedsbeitrag ${year}`;
const owesForYear = (user, year) => year > Number(String(user.created_at ?? '').slice(0, 4));

const CLUB_BILLING = { name: 'Archer FilmStudios', holder: 'Archer FilmStudios' };
const INVOICE_SENDER = 'invoices@archerfilmstudios.com';
const CONTACT_FROM = 'website@archerfilmstudios.com';
const CONTACT_TO = 'archerfilmstudios@gmail.com';

function euroText(cents) {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

const isDuesInvoice = (invoice) => invoice.reason === yearlyReason(invoice.year);

export async function sendInvoiceEmail(env, { to, invoice, memberName }) {
  if (!env.RESEND_API_KEY) return { ok: false, error: 'Email not configured.' };
  const iban = env.ARCHER_IBAN?.trim();
  if (!iban) return { ok: false, error: 'Bank details not configured.' };
  const dues = isDuesInvoice(invoice);
  const subject = dues
    ? `Mitgliedsbeitrag ${invoice.year} – ${CLUB_BILLING.name}`
    : `${invoice.reason} – ${CLUB_BILLING.name}`;
  const intro = dues
    ? `anbei deine Beitragsvorschreibung für den Mitgliedsbeitrag ${invoice.year} von ${CLUB_BILLING.name}.`
    : `anbei deine Rechnung (${invoice.reason}) von ${CLUB_BILLING.name}.`;
  const text = [
    `Hallo ${memberName},`,
    '',
    intro,
    '',
    ...(dues
      ? [`Mitgliedsbeitrag: ${euroText(invoice.amount_cents)}`, `Beitragsjahr: ${invoice.year}`]
      : [`Betrag: ${euroText(invoice.amount_cents)}`, `Grund: ${invoice.reason}`]),
    '',
    `Bitte überweise den Betrag auf folgendes Konto:`,
    '',
    `Kontoinhaber: ${CLUB_BILLING.holder}`,
    `IBAN: ${iban}`,
    `Verwendungszweck: ${invoice.year}-${invoice.user_id}`,
    '',
    `Vielen Dank für deine Mitgliedschaft!`,
    '',
    `${CLUB_BILLING.name}`,
  ].join('\n');
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: INVOICE_SENDER, to, subject, text }),
    });
    if (!res.ok) return { ok: false, error: `Email failed (${res.status}).` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function validateInvoice(body) {
  const year = body.year ?? new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { error: 'Invalid year.' };
  const amount_cents = body.amount_cents ?? YEARLY_CENTS;
  if (!Number.isInteger(amount_cents) || amount_cents < 1) return { error: 'Invalid amount.' };
  if (body.reason != null && !String(body.reason).trim()) return { error: 'Reason is required.' };
  return { year, amount_cents, reason: body.reason?.trim() || yearlyReason(year) };
}

const invoiceJson = (r) => ({ id: r.id, user_id: r.user_id, user_name: r.user_name ?? null, year: r.year, amount_cents: r.amount_cents, reason: r.reason, status: r.status, created_at: r.created_at, paid_at: r.paid_at ?? null, paid_method: r.paid_method ?? null });

app.get('/api/invoices/me', requireUser, async (c) => {
  const session = c.get('session');
  const { results } = await c.env.DB.prepare('SELECT * FROM invoices WHERE user_id = ? ORDER BY year DESC, created_at DESC').bind(session.user_id).all();
  return ok(c, { invoices: results.map(invoiceJson) });
});

app.get('/api/invoices', requireKassier, async (c) => {
  const status = c.req.query('status');
  const year = c.req.query('year');
  const method = c.req.query('method');
  let sql = 'SELECT i.*, u.name AS user_name FROM invoices i LEFT JOIN users u ON u.id = i.user_id WHERE 1 = 1';
  const args = [];
  if (status) {
    sql += ' AND i.status = ?';
    args.push(status);
  }
  if (year) {
    sql += ' AND i.year = ?';
    args.push(Number(year));
  }
  if (method) {
    if (method !== 'cash' && method !== 'transfer') return fail(c, 'Invalid method.', 400);
    sql += ' AND i.paid_method = ?';
    args.push(method);
  }
  sql += ' ORDER BY i.year DESC, i.created_at DESC';
  const { results } = await c.env.DB.prepare(sql).bind(...args).all();
  return ok(c, { invoices: results.map(invoiceJson) });
});

app.post('/api/invoices', requireKassier, async (c) => {
  const session = c.get('session');
  const body = await c.req.json();
  const v = validateInvoice(body);
  if (v.error) return fail(c, v.error, 400);
  const user = await c.env.DB.prepare('SELECT id, email, name FROM users WHERE id = ?').bind(body.user_id).first();
  if (!user) return fail(c, 'Unknown member.', 400);
  const id = uid('inv');
  await c.env.DB.prepare('INSERT INTO invoices (id, user_id, year, amount_cents, reason, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, body.user_id, v.year, v.amount_cents, v.reason, 'open', session.user_id, nowISO()).run();
  const row = await c.env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first();
  const invoice = invoiceJson(row);
  const email = await sendInvoiceEmail(c.env, { to: user.email, invoice, memberName: user.name });
  return ok(c, { invoice, email: { sent: email.ok, ...(email.ok ? {} : { error: email.error }) } }, 201);
});

app.post('/api/invoices/:id/send', requireKassier, async (c) => {
  const inv = await c.env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(c.req.param('id')).first();
  if (!inv) return fail(c, 'Not found.', 404);
  const user = await c.env.DB.prepare('SELECT id, email, name FROM users WHERE id = ?').bind(inv.user_id).first();
  if (!user) return fail(c, 'Unknown member.', 400);
  const email = await sendInvoiceEmail(c.env, { to: user.email, invoice: invoiceJson(inv), memberName: user.name });
  if (!email.ok) return fail(c, email.error, email.error.endsWith('not configured.') ? 503 : 502);
  return ok(c, { sent: true });
});

app.post('/api/invoices/generate', requireKassier, async (c) => {
  const session = c.get('session');
  const body = await c.req.json().catch(() => ({}));
  const year = body.year ?? new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return fail(c, 'Invalid year.', 400);
  const { results: users } = await c.env.DB.prepare('SELECT * FROM users').all();
  let created = 0;
  for (const u of users ?? []) {
    if (!owesForYear(u, year)) continue;
    const { results: existing } = await c.env.DB.prepare('SELECT * FROM invoices WHERE user_id = ? AND year = ?').bind(u.id, year).all();
    if (existing.some((r) => r.reason === yearlyReason(year) && r.status !== 'cancelled')) continue;
    await c.env.DB.prepare('INSERT INTO invoices (id, user_id, year, amount_cents, reason, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(uid('inv'), u.id, year, YEARLY_CENTS, yearlyReason(year), 'open', session.user_id, nowISO()).run();
    created += 1;
  }
  return ok(c, { created });
});

app.patch('/api/invoices/:id/pay', requireKassier, async (c) => {
  const session = c.get('session');
  const { method } = await c.req.json();
  if (method !== 'cash' && method !== 'transfer') return fail(c, 'Invalid method.', 400);
  const inv = await c.env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(c.req.param('id')).first();
  if (!inv) return fail(c, 'Not found.', 404);
  if (inv.status !== 'open') return fail(c, 'Already paid.', 409);
  await c.env.DB.prepare('UPDATE invoices SET status = ?, paid_at = ?, paid_method = ?, marked_by = ? WHERE id = ?')
    .bind('paid', nowISO(), method, session.user_id, inv.id).run();
  return ok(c, {});
});

app.patch('/api/invoices/:id/cancel', requireKassier, async (c) => {
  const inv = await c.env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(c.req.param('id')).first();
  if (!inv) return fail(c, 'Not found.', 404);
  if (inv.status !== 'open') return fail(c, 'Already paid.', 409);
  await c.env.DB.prepare('UPDATE invoices SET status = ? WHERE id = ?').bind('cancelled', inv.id).run();
  return ok(c, {});
});

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function storeAvatar(c, userId) {
  const contentType = c.req.header('content-type') ?? '';
  if (!ALLOWED_TYPES.some((t) => contentType.includes(t))) return { error: 'Only jpg/png/webp.', status: 415 };
  const buf = await c.req.arrayBuffer();
  if (buf.byteLength > 2 * 1024 * 1024) return { error: 'Image too large (max 2MB).', status: 413 };
  const key = `avatars/${userId}-${Date.now()}.jpg`;
  await c.env.AVATARS.put(key, buf, { httpMetadata: { contentType } });
  await c.env.DB.prepare('UPDATE users SET avatar_r2_key = ? WHERE id = ?').bind(key, userId).run();
  return { key };
}

app.post('/api/users/me/avatar', requireUser, async (c) => {
  const session = c.get('session');
  const result = await storeAvatar(c, session.user_id);
  if (result.error) return fail(c, result.error, result.status);
  return ok(c, { avatar_r2_key: result.key });
});

app.post('/api/users/:id/avatar', requireAdmin, async (c) => {
  const { id } = c.req.param();
  const exists = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
  if (!exists) return fail(c, 'Not found.', 404);
  const result = await storeAvatar(c, id);
  if (result.error) return fail(c, result.error, result.status);
  return ok(c, { avatar_r2_key: result.key });
});

export function validateHeadId(headId) {
  if (headId == null) return null;
  if (typeof headId !== 'string' || !headId.trim()) return 'Unknown member.';
  return null;
}

// --- Projects ---
export function validateProject(p) {
  const intensity = Number(p.intensity);
  if (!p.title?.trim()) return 'Title is required.';
  if (!Number.isInteger(intensity) || intensity < 1 || intensity > 5) return 'Intensity must be 1-5.';
  if (p.start_at && p.end_at && p.start_at >= p.end_at) return 'End must be after start.';
  if (p.max_members != null && (!Number.isInteger(Number(p.max_members)) || p.max_members < 1 || p.max_members > 500)) return 'Invalid max_members.';
  return null;
}

export async function withMemberCounts(db, projects) {
  return Promise.all(projects.map(async (p) => {
    const count = await db.prepare('SELECT COUNT(*) AS n FROM memberships WHERE project_id = ?').bind(p.id).first();
    const members = await db.prepare('SELECT u.* FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.project_id = ?').bind(p.id).all();
    return { ...p, member_count: count.n, members: members.results.map(publicUser) };
  }));
}

app.get('/api/projects', requireUser, async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM projects ORDER BY start_at').all();
  return ok(c, { projects: await withMemberCounts(c.env.DB, results) });
});

app.get('/api/projects/:id', requireUser, async (c) => {
  const session = c.get('session');
  const project = await c.env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(c.req.param('id')).first();
  if (!project) return fail(c, 'Not found.', 404);
  const [withMembers] = await withMemberCounts(c.env.DB, [project]);
  let head = null;
  if (project.head_user_id) {
    const headRow = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(project.head_user_id).first();
    head = headRow ? publicUser(headRow) : null;
  }
  const creatorRow = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(project.created_by).first();
  return ok(c, {
    project,
    head,
    members: withMembers.members,
    creator: creatorRow ? publicUser(creatorRow) : null,
    member_count: withMembers.member_count,
    isMember: (withMembers.members ?? []).some((m) => m.id === session.user_id),
    canEdit: !!session.is_admin,
  });
});

export async function checkHeadId(db, body) {
  if (!Object.hasOwn(body, 'head_user_id')) return null;
  const headErr = validateHeadId(body.head_user_id);
  if (headErr) return headErr;
  if (body.head_user_id != null) {
    const headUser = await db.prepare('SELECT id FROM users WHERE id = ?').bind(body.head_user_id).first();
    if (!headUser) return 'Unknown member.';
  }
  return null;
}

app.post('/api/projects', requireAdmin, async (c) => {
  const session = c.get('session');
  const body = await c.req.json();
  const err = validateProject({ ...body, intensity: Number(body.intensity) });
  if (err) return fail(c, err, 400);
  const headErr = await checkHeadId(c.env.DB, body);
  if (headErr) return fail(c, headErr, 400);
  const id = uid('p');
  await c.env.DB.prepare('INSERT INTO projects (id, title, description, intensity, location, start_at, end_at, max_members, created_by, head_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, body.title.trim(), body.description ?? '', Number(body.intensity), body.location ?? '', body.start_at, body.end_at, body.max_members ?? null, session.user_id, body.head_user_id ?? null, nowISO()).run();
  const p = await c.env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first();
  return ok(c, { project: p }, 201);
});

app.patch('/api/projects/:id', requireAdmin, async (c) => {
  const body = await c.req.json();
  const existing = await c.env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(c.req.param('id')).first();
  if (!existing) return fail(c, 'Not found.', 404);
  const headErr = await checkHeadId(c.env.DB, body);
  if (headErr) return fail(c, headErr, 400);
  const merged = { ...existing, ...body };
  const err = validateProject({ ...merged, intensity: Number(merged.intensity) });
  if (err) return fail(c, err, 400);
  await c.env.DB.prepare('UPDATE projects SET title=?, description=?, intensity=?, location=?, start_at=?, end_at=?, max_members=?, head_user_id=? WHERE id=?')
    .bind(merged.title, merged.description, Number(merged.intensity), merged.location, merged.start_at, merged.end_at, merged.max_members ?? null, merged.head_user_id ?? null, existing.id).run();
  return ok(c, { project: await c.env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(existing.id).first() });
});

app.delete('/api/projects/:id', requireAdmin, async (c) => {
  await c.env.DB.prepare('DELETE FROM memberships WHERE project_id = ?').bind(c.req.param('id')).run();
  await c.env.DB.prepare('DELETE FROM project_photos WHERE project_id = ?').bind(c.req.param('id')).run();
  await c.env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(c.req.param('id')).run();
  return ok(c, {});
});

app.post('/api/projects/:id/join', requireUser, async (c) => {
  const session = c.get('session');
  const pid = c.req.param('id');
  const project = await c.env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(pid).first();
  if (!project) return fail(c, 'Not found.', 404);
  const existing = await c.env.DB.prepare('SELECT * FROM memberships WHERE project_id = ? AND user_id = ?').bind(pid, session.user_id).first();
  if (existing) return fail(c, 'Already joined.', 409);
  // Atomic join: single statement fails when full (no check-then-insert race).
  const joined = await c.env.DB.prepare(
    'INSERT INTO memberships (project_id, user_id, joined_at) SELECT ?, ?, ? WHERE (SELECT max_members FROM projects WHERE id = ?) IS NULL OR (SELECT COUNT(*) FROM memberships WHERE project_id = ?) < (SELECT max_members FROM projects WHERE id = ?)',
  ).bind(pid, session.user_id, nowISO(), pid, pid, pid).run();
  if (!joined.meta.changes) {
    const stillThere = await c.env.DB.prepare('SELECT id FROM projects WHERE id = ?').bind(pid).first();
    if (!stillThere) return fail(c, 'Not found.', 404);
    return fail(c, 'Project is full.', 409);
  }
  return ok(c, {}, 201);
});

app.delete('/api/projects/:id/join', requireUser, async (c) => {
  const session = c.get('session');
  const pid = c.req.param('id');
  const r = await c.env.DB.prepare('DELETE FROM memberships WHERE project_id = ? AND user_id = ?').bind(pid, session.user_id).run();
  if (!r.meta.changes) return fail(c, 'Not found.', 404);
  return ok(c, {});
});

// --- Project photos (shared albums) ---
const MAX_PHOTOS = 30;

async function canUploadPhoto(c, pid) {
  const session = c.get('session');
  if (session.is_admin) return true;
  const m = await c.env.DB.prepare('SELECT * FROM memberships WHERE project_id = ? AND user_id = ?').bind(pid, session.user_id).first();
  return !!m;
}

const photoJson = (p) => ({ id: p.id, r2_key: p.r2_key, uploaded_by: p.uploaded_by, created_at: p.created_at });

app.get('/api/projects/:id/photos', requireUser, async (c) => {
  const project = await c.env.DB.prepare('SELECT id FROM projects WHERE id = ?').bind(c.req.param('id')).first();
  if (!project) return fail(c, 'Not found.', 404);
  const { results } = await c.env.DB.prepare('SELECT * FROM project_photos WHERE project_id = ? ORDER BY created_at').bind(project.id).all();
  return ok(c, { photos: (results ?? []).map(photoJson) });
});

app.post('/api/projects/:id/photos', requireUser, async (c) => {
  const pid = c.req.param('id');
  const project = await c.env.DB.prepare('SELECT id FROM projects WHERE id = ?').bind(pid).first();
  if (!project) return fail(c, 'Not found.', 404);
  if (!(await canUploadPhoto(c, pid))) return fail(c, 'Join the project to upload photos.', 403);
  const contentType = c.req.header('content-type') ?? '';
  if (!ALLOWED_TYPES.some((t) => contentType.includes(t))) return fail(c, 'Only jpg/png/webp.', 415);
  const buf = await c.req.arrayBuffer();
  if (buf.byteLength > 2 * 1024 * 1024) return fail(c, 'Image too large (max 2MB).', 413);
  const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM project_photos WHERE project_id = ?').bind(pid).first();
  if (count.n >= MAX_PHOTOS) return fail(c, 'Album is full.', 400);
  const id = uid('ph');
  const key = `galleries/${pid}-${Date.now()}.jpg`;
  await c.env.AVATARS.put(key, buf, { httpMetadata: { contentType } });
  await c.env.DB.prepare('INSERT INTO project_photos (id, project_id, r2_key, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, pid, key, c.get('session').user_id, nowISO()).run();
  const photo = await c.env.DB.prepare('SELECT * FROM project_photos WHERE id = ?').bind(id).first();
  return ok(c, { photo: { ...photoJson(photo), project_id: pid } }, 201);
});

app.delete('/api/photos/:id', requireUser, async (c) => {
  const session = c.get('session');
  const photo = await c.env.DB.prepare('SELECT * FROM project_photos WHERE id = ?').bind(c.req.param('id')).first();
  if (!photo) return fail(c, 'Not found.', 404);
  if (photo.uploaded_by !== session.user_id && !session.is_admin) return fail(c, 'Not yours.', 403);
  await c.env.DB.prepare('DELETE FROM project_photos WHERE id = ?').bind(photo.id).run();
  return ok(c, {});
});

app.get('/gallery/:key', async (c) => {
  const obj = await c.env.AVATARS.get(`galleries/${c.req.param('key')}`);
  if (!obj) return fail(c, 'Not found.', 404);
  return new Response(obj.body, { headers: { 'Content-Type': obj.httpMetadata?.contentType ?? 'image/jpeg', 'Cache-Control': 'public, max-age=86400' } });
});

app.get('/avatars/:key', async (c) => {
  const obj = await c.env.AVATARS.get(`avatars/${c.req.param('key')}`);
  if (!obj) return fail(c, 'Not found.', 404);
  return new Response(obj.body, { headers: { 'Content-Type': obj.httpMetadata?.contentType ?? 'image/jpeg', 'Cache-Control': 'public, max-age=86400' } });
});

// --- Produced films (public listing, admin-managed) ---
export function validateFilm(f) {
  if (!f.title?.trim()) return 'Title is required.';
  if (!/^https?:\/\/.+\..+/.test(f.url ?? '')) return 'Film website URL must start with http(s).';
  return null;
}

app.get('/api/films', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM films ORDER BY created_at').all();
  return ok(c, { films: results });
});

app.post('/api/films', requireAdmin, async (c) => {
  const body = await c.req.json();
  const err = validateFilm(body);
  if (err) return fail(c, err, 400);
  const id = uid('f');
  await c.env.DB.prepare('INSERT INTO films (id, title, poster_r2_key, url, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, body.title.trim(), null, body.url.trim(), nowISO()).run();
  const film = await c.env.DB.prepare('SELECT * FROM films WHERE id = ?').bind(id).first();
  return ok(c, { film }, 201);
});

app.patch('/api/films/:id', requireAdmin, async (c) => {
  const body = await c.req.json();
  const existing = await c.env.DB.prepare('SELECT * FROM films WHERE id = ?').bind(c.req.param('id')).first();
  if (!existing) return fail(c, 'Not found.', 404);
  const merged = { ...existing, ...body };
  const err = validateFilm(merged);
  if (err) return fail(c, err, 400);
  await c.env.DB.prepare('UPDATE films SET title = ?, url = ? WHERE id = ?')
    .bind(merged.title.trim(), merged.url.trim(), existing.id).run();
  return ok(c, { film: await c.env.DB.prepare('SELECT * FROM films WHERE id = ?').bind(existing.id).first() });
});

app.delete('/api/films/:id', requireAdmin, async (c) => {
  const existing = await c.env.DB.prepare('SELECT * FROM films WHERE id = ?').bind(c.req.param('id')).first();
  if (!existing) return fail(c, 'Not found.', 404);
  await c.env.DB.prepare('DELETE FROM films WHERE id = ?').bind(existing.id).run();
  return ok(c, {});
});

app.post('/api/films/:id/poster', requireAdmin, async (c) => {
  const film = await c.env.DB.prepare('SELECT * FROM films WHERE id = ?').bind(c.req.param('id')).first();
  if (!film) return fail(c, 'Not found.', 404);
  const contentType = c.req.header('content-type') ?? '';
  if (!ALLOWED_TYPES.some((t) => contentType.includes(t))) return fail(c, 'Only jpg/png/webp.', 415);
  const buf = await c.req.arrayBuffer();
  if (buf.byteLength > 2 * 1024 * 1024) return fail(c, 'Image too large (max 2MB).', 413);
  const key = `posters/${film.id}-${Date.now()}.jpg`;
  await c.env.AVATARS.put(key, buf, { httpMetadata: { contentType } });
  await c.env.DB.prepare('UPDATE films SET poster_r2_key = ? WHERE id = ?').bind(key, film.id).run();
  return ok(c, { poster_r2_key: key });
});

app.get('/posters/:key', async (c) => {
  const obj = await c.env.AVATARS.get(`posters/${c.req.param('key')}`);
  if (!obj) return fail(c, 'Not found.', 404);
  return new Response(obj.body, { headers: { 'Content-Type': obj.httpMetadata?.contentType ?? 'image/jpeg', 'Cache-Control': 'public, max-age=86400' } });
});

app.post('/api/contact', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (body.website) return ok(c, { sent: true });
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const subject = String(body.subject ?? '').trim();
  const message = String(body.message ?? '').trim();
  if (!name || name.length > 100) return fail(c, 'Please tell us your name.', 400);
  if (!isEmail(email)) return fail(c, 'Please enter a valid email address.', 400);
  if (!subject || subject.length > 150) return fail(c, 'Please add a subject.', 400);
  if (!message || message.length > 5000) return fail(c, 'Please write a message.', 400);
  if (!c.env.RESEND_API_KEY) return fail(c, 'Email not configured.', 503);
  const text = [`Name: ${name}`, `Email: ${email}`, '', message].join('\n');
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: CONTACT_FROM, to: CONTACT_TO, reply_to: email, subject: `[Website] ${subject}`, text }),
    });
    if (!res.ok) return fail(c, `Email failed (${res.status}).`, 502);
    return ok(c, { sent: true });
  } catch (err) {
    return fail(c, err.message, 502);
  }
});

app.get('/api/calendar', requireUser, async (c) => {
  const month = c.req.query('month');
  if (!/^\d{4}-\d{2}$/.test(month ?? '')) return fail(c, 'month as YYYY-MM is required.', 400);
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59)).toISOString();
  const { results } = await c.env.DB.prepare('SELECT * FROM projects WHERE start_at <= ? AND end_at >= ? ORDER BY start_at').bind(end, start).all();
  return ok(c, { month, projects: await withMemberCounts(c.env.DB, results) });
});

// --- Shoot reminders (daily cron + manual resend) ---
export async function sendShootReminders(env, now, onlyProjectId = null) {
  const nowMs = Date.parse(now);
  const windowEnd = new Date(nowMs + 48 * 3600 * 1000).toISOString();
  let projects;
  if (onlyProjectId) {
    const project = await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(onlyProjectId).first();
    if (!project) return null;
    projects = [project];
  } else {
    const { results } = await env.DB.prepare('SELECT * FROM projects WHERE start_at > ? AND start_at <= ?').bind(now, windowEnd).all();
    projects = results ?? [];
  }
  let emailed = 0;
  let failed = 0;
  let reminded = 0;
  for (const project of projects) {
    const logged = await env.DB.prepare('SELECT * FROM reminder_log WHERE project_id = ? AND start_at = ?')
      .bind(project.id, project.start_at).first();
    if (logged) continue;
    const { results: members } = await env.DB.prepare('SELECT u.email, u.name FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.project_id = ?')
      .bind(project.id).all();
    const day = String(project.start_at).slice(0, 10);
    const time = String(project.start_at).slice(11, 16);
    for (const m of members ?? []) {
      const text = [
        `Hallo ${m.name},`,
        '',
        `am ${day} um ${time} findet ${project.title} statt (${project.location}).`,
        '',
        `Wir freuen uns auf dich!`,
        '',
        `Archer FilmStudios`,
      ].join('\n');
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: CONTACT_FROM, to: m.email, subject: `Erinnerung: ${project.title} – Archer FilmStudios`, text }),
        });
        if (!res.ok) failed += 1;
        else emailed += 1;
      } catch {
        failed += 1;
      }
    }
    await env.DB.prepare('INSERT INTO reminder_log (project_id, start_at, sent_at) VALUES (?, ?, ?)')
      .bind(project.id, project.start_at, nowISO()).run();
    reminded += 1;
  }
  return { projects: reminded, emails: emailed, failed };
}

app.post('/api/projects/:id/remind', requireAdmin, async (c) => {
  const result = await sendShootReminders(c.env, new Date().toISOString(), c.req.param('id'));
  if (!result) return fail(c, 'Not found.', 404);
  return ok(c, result);
});

app.scheduled = (event, env, ctx) => ctx.waitUntil(sendShootReminders(env, new Date().toISOString()));

export default app;
