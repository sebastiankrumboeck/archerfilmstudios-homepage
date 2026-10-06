import { describe, expect, it } from 'vitest';
import app from '../src/index.js';

// Contract: implementation must use exactly these SQL shapes
// (single-row lookups by equality, lists via .all()).

const ADMIN_NOFIN = { id: 's-a', user_id: 'u-admin', expires_at: '2030-01-01T00:00:00Z', is_admin: 1, is_kassier: 0 };
const KASSIER_SESSION = { id: 's-k', user_id: 'u-kas', expires_at: '2030-01-01T00:00:00Z', is_admin: 0, is_kassier: 1 };
const MEMBER_SESSION = { id: 's-m', user_id: 'u-1', expires_at: '2030-01-01T00:00:00Z', is_admin: 0, is_kassier: 0 };

const MEMBER = { id: 'u-2', email: 'm@x.at', pass_hash: 'x', name: 'M', function: '', avatar_r2_key: null, is_admin: 0, is_vorstand: 0, vorstand_title: null, is_kassier: 0, created_at: '2024-05-01T00:00:00Z' };
const OPEN_INV = { id: 'i-1', user_id: 'u-2', year: 2026, amount_cents: 1200, reason: 'Mitgliedsbeitrag 2026', status: 'open', created_by: 'u-kas', created_at: '2026-01-05T00:00:00Z', paid_at: null, paid_method: null, marked_by: null };
const PAID_INV = { ...OPEN_INV, id: 'i-2', status: 'paid', paid_at: '2026-02-01T00:00:00Z', paid_method: 'cash', marked_by: 'u-kas' };

function fakeDb({ session = null, userRow = null, userExists = null, users = [], invoiceRow = null, invoices = [], invoicesByUser = {}, runLog = null } = {}) {
  return {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          if (sql.includes('FROM sessions')) return session;
          if (sql === 'SELECT id FROM users WHERE id = ?') return userExists;
          if (sql === 'SELECT * FROM users WHERE id = ?') return userRow;
          if (sql === 'SELECT * FROM invoices WHERE id = ?') return invoiceRow;
          if (sql.includes('FROM invoices') && sql.includes('user_id = ?')) {
            const rows = invoicesByUser[args[0]] ?? [];
            return rows[0] ?? null;
          }
          return null;
        },
        all: async () => {
          if (sql === 'SELECT * FROM users') return { results: users };
          if (sql.includes('FROM invoices') && sql.includes('user_id = ?') && sql.includes('year = ?')) {
            return { results: (invoicesByUser[args[0]] ?? []).filter((r) => r.year === args[1]) };
          }
          if (sql.includes('FROM invoices')) return { results: invoices };
          return { results: [] };
        },
        run: async () => {
          runLog?.(sql, args);
          return {};
        },
      }),
      all: async () => {
        if (sql === 'SELECT * FROM users') return { results: users };
        if (sql.includes('FROM invoices')) return { results: invoices };
        return { results: [] };
      },
    }),
  };
}

const json = { 'Content-Type': 'application/json' };
const kas = { Cookie: 'app-session=s-k' };
const mem = { Cookie: 'app-session=s-m' };
const adm = { Cookie: 'app-session=s-a' };

describe('dues endpoints', () => {
  it('anon gets 401 on finance endpoints', async () => {
    for (const [method, path, body] of [
      ['GET', '/api/invoices/me', undefined],
      ['GET', '/api/invoices', undefined],
      ['POST', '/api/invoices', '{}'],
      ['POST', '/api/invoices/generate', '{}'],
      ['PATCH', '/api/invoices/i-1/pay', '{}'],
      ['PATCH', '/api/invoices/i-1/cancel', '{}'],
    ]) {
      const res = await app.request(path, { method, headers: json, body });
      expect(res.status).toBe(401);
    }
  });
  it('member gets 403 on kassier endpoints', async () => {
    const res = await app.request('/api/invoices', { headers: mem }, { DB: fakeDb({ session: MEMBER_SESSION }) });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Kassier only.');
  });
  it('admin without flag gets 403 on kassier endpoints', async () => {
    const cases = [
      ['GET', '/api/invoices', false],
      ['POST', '/api/invoices', true],
      ['POST', '/api/invoices/generate', true],
      ['PATCH', '/api/invoices/i-1/pay', true],
      ['PATCH', '/api/invoices/i-1/cancel', true],
    ];
    for (const [method, path, withBody] of cases) {
      const res = await app.request(path, { method, headers: { ...adm, ...json }, ...(withBody ? { body: '{}' } : {}) }, { DB: fakeDb({ session: ADMIN_NOFIN }) });
      expect(res.status).toBe(403);
    }
  });
  it('member reads own invoices', async () => {
    const res = await app.request('/api/invoices/me', { headers: mem }, {
      DB: fakeDb({ session: MEMBER_SESSION, invoices: [OPEN_INV].map((r) => ({ ...r, user_id: 'u-1' })) }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).data.invoices).toHaveLength(1);
  });
  it('create applies yearly defaults', async () => {
    let ran = null;
    const db = fakeDb({ session: KASSIER_SESSION, userExists: { id: 'u-2' }, invoiceRow: { ...OPEN_INV, id: 'i-9' } });
    const origPrepare = db.prepare;
    db.prepare = (sql) => {
      const q = origPrepare(sql);
      return { bind: (...args) => {
        const b = q.bind(...args);
        return { ...b, run: async () => { ran = { sql, args }; return {}; } };
      } };
    };
    const res = await app.request('/api/invoices', {
      method: 'POST', headers: { ...kas, ...json }, body: JSON.stringify({ user_id: 'u-2' }),
    }, { DB: db });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.invoice.reason).toBe(`Mitgliedsbeitrag ${new Date().getFullYear()}`);
    expect(body.data.invoice.amount_cents).toBe(1200);
    expect(ran.args).toContain(1200);
  });
  it('create validates user, amount, year', async () => {
    const badUser = await app.request('/api/invoices', {
      method: 'POST', headers: { ...kas, ...json }, body: JSON.stringify({ user_id: 'nope', amount_cents: 500, reason: 'X' }),
    }, { DB: fakeDb({ session: KASSIER_SESSION, userExists: null }) });
    expect(badUser.status).toBe(400);
    const badAmount = await app.request('/api/invoices', {
      method: 'POST', headers: { ...kas, ...json }, body: JSON.stringify({ user_id: 'u-2', amount_cents: 0, reason: 'X' }),
    }, { DB: fakeDb({ session: KASSIER_SESSION, userExists: { id: 'u-2' } }) });
    expect(badAmount.status).toBe(400);
    const badYear = await app.request('/api/invoices', {
      method: 'POST', headers: { ...kas, ...json }, body: JSON.stringify({ user_id: 'u-2', year: 1999, amount_cents: 500, reason: 'X' }),
    }, { DB: fakeDb({ session: KASSIER_SESSION, userExists: { id: 'u-2' } }) });
    expect(badYear.status).toBe(400);
  });
  it('pay twice gives 409, cancel-then-pay gives 409', async () => {
    const twice = await app.request('/api/invoices/i-2/pay', {
      method: 'PATCH', headers: { ...kas, ...json }, body: JSON.stringify({ method: 'cash' }),
    }, { DB: fakeDb({ session: KASSIER_SESSION, invoiceRow: PAID_INV }) });
    expect(twice.status).toBe(409);
    const cancelled = { ...OPEN_INV, status: 'cancelled' };
    const afterCancel = await app.request('/api/invoices/i-1/pay', {
      method: 'PATCH', headers: { ...kas, ...json }, body: JSON.stringify({ method: 'cash' }),
    }, { DB: fakeDb({ session: KASSIER_SESSION, invoiceRow: cancelled }) });
    expect(afterCancel.status).toBe(409);
  });
  it('generate skips join-year members and existing invoices, rerun creates 0', async () => {
    const thisYear = new Date().getFullYear();
    const users = [
      { ...MEMBER, id: 'u-old', created_at: `${thisYear - 2}-03-01T00:00:00Z` },
      { ...MEMBER, id: 'u-new', created_at: `${thisYear}-03-01T00:00:00Z` },
      { ...MEMBER, id: 'u-has', created_at: `${thisYear - 2}-03-01T00:00:00Z` },
    ];
    const template = `Mitgliedsbeitrag ${thisYear}`;
    const store = {
      invoices: [{ ...OPEN_INV, id: 'i-x', user_id: 'u-has', year: thisYear, reason: template, status: 'open' }],
    };
    const created = [];
    const db = {
      prepare: (sql) => ({
        bind: (...args) => ({
          first: async () => (sql.includes('FROM sessions') ? KASSIER_SESSION : null),
          all: async () => {
            if (sql === 'SELECT * FROM users') return { results: users };
            if (sql.includes('FROM invoices')) {
              return { results: store.invoices.filter((r) => r.user_id === args[0] && r.year === args[1]) };
            }
            return { results: [] };
          },
          run: async () => {
            if (sql.startsWith('INSERT INTO invoices')) {
              const [id, user_id, year, amount_cents, reason] = args;
              store.invoices.push({ id, user_id, year, amount_cents, reason, status: 'open' });
              created.push(id);
            }
            return {};
          },
        }),
        all: async () => {
          if (sql === 'SELECT * FROM users') return { results: users };
          return { results: [] };
        },
      }),
    };
    const call = () => app.request('/api/invoices/generate', {
      method: 'POST', headers: { ...kas, ...json }, body: JSON.stringify({ year: thisYear }),
    }, { DB: db });
    const first = await call();
    expect(first.status).toBe(200);
    expect((await first.json()).data.created).toBe(1);
    const second = await call();
    expect(second.status).toBe(200);
    expect((await second.json()).data.created).toBe(0);
    expect(created).toHaveLength(1);
  });
  it('kassier grant as admin gives 200, as member gives 403', async () => {
    const okRes = await app.request('/api/users/u-2/kassier', {
      method: 'PATCH', headers: { ...adm, ...json }, body: JSON.stringify({ is_kassier: 1 }),
    }, { DB: fakeDb({ session: ADMIN_NOFIN, userRow: { ...MEMBER, is_kassier: 1 } }) });
    expect(okRes.status).toBe(200);
    const noRes = await app.request('/api/users/u-2/kassier', {
      method: 'PATCH', headers: { ...mem, ...json }, body: JSON.stringify({ is_kassier: 1 }),
    }, { DB: fakeDb({ session: MEMBER_SESSION }) });
    expect(noRes.status).toBe(403);
  });
});
