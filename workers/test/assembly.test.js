import { describe, expect, it } from 'vitest';
import app from '../src/index.js';

const ADMIN = { id: 's-a', user_id: 'u-admin', expires_at: '2030-01-01T00:00:00Z', is_admin: 1, is_kassier: 0 };
const MEMBER_SESSION = { id: 's-m', user_id: 'u-1', expires_at: '2030-01-01T00:00:00Z', is_admin: 0, is_kassier: 0 };
const adm = { Cookie: 'app-session=s-a' };
const mem = { Cookie: 'app-session=s-m' };

const USERS = [
  { id: 'u-1', name: 'Anna', created_at: '2024-03-01T00:00:00Z' },
  { id: 'u-2', name: 'Ben', created_at: '2026-05-01T00:00:00Z' },
];
const PROJECTS = [
  { id: 'p1', title: 'Shoot', start_at: '2026-06-01T18:00:00Z', end_at: '2026-06-01T22:00:00Z' },
];
const MEMBERSHIPS = [{ project_id: 'p1', user_id: 'u-1' }, { project_id: 'p1', user_id: 'u-2' }];
const OPEN = { id: 'i-1', user_id: 'u-1', user_name: 'Anna', year: 2026, amount_cents: 1200, reason: 'Beitrag', status: 'open', created_at: '2026-01-05T00:00:00Z', paid_at: null };
const PAID = { id: 'i-2', user_id: 'u-2', user_name: 'Ben', year: 2026, amount_cents: 1200, reason: 'Beitrag', status: 'paid', created_at: '2026-01-06T00:00:00Z', paid_at: '2026-02-01T00:00:00Z', paid_method: 'cash' };

function fakeDb({ session = ADMIN, users = USERS, projects = PROJECTS, invoices = [OPEN, PAID], attendance = [{ user_id: 'u-1', present: 1 }], runLog = null } = {}) {
  const store = { attendance: attendance.map((r) => ({ ...r })) };
  const inYear = (rows, args) => {
    const year = args.find((a) => Number.isInteger(a));
    return year === undefined ? rows : rows.filter((r) => r.year === year);
  };
  const sums = (rows) => ({
    n: rows.length,
    sum: rows.reduce((n, r) => n + r.amount_cents, 0),
    cash: rows.filter((r) => r.paid_method === 'cash').reduce((n, r) => n + r.amount_cents, 0),
    transfer: rows.filter((r) => r.paid_method === 'transfer').reduce((n, r) => n + r.amount_cents, 0),
  });
  return {
    store,
    db: {
      prepare: (sql) => ({
        bind: (...args) => ({
          first: async () => {
            if (sql.includes('FROM sessions')) return session;
            if (sql.includes('FROM invoices') && sql.includes("status = 'open'")) return sums(inYear(invoices.filter((r) => r.status === 'open'), args));
            if (sql.includes('FROM invoices') && sql.includes("status = 'paid'")) return sums(inYear(invoices.filter((r) => r.status === 'paid'), args));
            if (sql.includes('FROM invoices') && sql.includes("status = 'cancelled'")) {
              return { n: inYear(invoices.filter((r) => r.status === 'cancelled'), args).length };
            }
            if (sql.includes('COUNT(*) AS n FROM memberships')) {
              return { n: MEMBERSHIPS.filter((m) => m.project_id === args[0]).length };
            }
            return null;
          },
          all: async () => {
            if (sql === 'SELECT * FROM users') return { results: users };
            if (sql.includes('FROM projects')) return { results: projects };
            if (sql.includes('FROM invoices')) {
              const status = sql.includes("status = 'open'") ? 'open' : null;
              return { results: inYear(invoices.filter((r) => !status || r.status === status), args) };
            }
            if (sql.includes('FROM memberships m JOIN users')) {
              return { results: MEMBERSHIPS.filter((m) => m.project_id === args[0]).map((m) => USERS.find((u) => u.id === m.user_id)) };
            }
            if (sql.includes('FROM assembly_attendance')) return { results: store.attendance };
            return { results: [] };
          },
          run: async () => {
            runLog?.(sql, args);
            if (sql.startsWith('DELETE FROM assembly_attendance')) store.attendance = [];
            if (sql.startsWith('INSERT INTO assembly_attendance')) store.attendance.push({ year: args[0], user_id: args[1], present: 1 });
            return {};
          },
        }),
        all: async () => {
          if (sql === 'SELECT * FROM users') return { results: users };
          if (sql.includes('FROM assembly_attendance')) return { results: store.attendance };
          return { results: [] };
        },
      }),
    },
  };
}

describe('assembly pack', () => {
  it('pack aggregates members, projects, finance and attendance', async () => {
    const { db } = fakeDb();
    const res = await app.request('/api/assembly-pack?year=2026', { headers: adm }, { DB: db });
    expect(res.status).toBe(200);
    const { pack } = (await res.json()).data;
    expect(pack.year).toBe(2026);
    expect(pack.member_count).toBe(2);
    expect(pack.new_members.map((m) => m.name)).toEqual(['Ben']);
    expect(pack.projects).toHaveLength(1);
    expect(pack.projects[0].member_count).toBe(2);
    expect(pack.finance.paid_cents).toBe(1200);
    expect(pack.open_invoices).toHaveLength(1);
    expect(pack.open_invoices[0].user_name).toBe('Anna');
    expect(pack.attendance).toEqual([{ user_id: 'u-1', present: 1 }]);
  });

  it('empty year returns zeros and empty arrays', async () => {
    const { db } = fakeDb({ users: [], projects: [], invoices: [], attendance: [] });
    const res = await app.request('/api/assembly-pack?year=2030', { headers: adm }, { DB: db });
    expect(res.status).toBe(200);
    const { pack } = (await res.json()).data;
    expect(pack.member_count).toBe(0);
    expect(pack.new_members).toEqual([]);
    expect(pack.projects).toEqual([]);
    expect(pack.finance.invoiced_cents).toBe(0);
    expect(pack.open_invoices).toEqual([]);
  });

  it('rejects bad year with 400 and non-admin with 403', async () => {
    const { db } = fakeDb();
    const bad = await app.request('/api/assembly-pack?year=abc', { headers: adm }, { DB: db });
    expect(bad.status).toBe(400);
    const denied = await app.request('/api/assembly-pack?year=2026', { headers: mem }, { DB: fakeDb({ session: MEMBER_SESSION }).db });
    expect(denied.status).toBe(403);
  });

  it('attendance PATCH replaces rows idempotently', async () => {
    const { store, db } = fakeDb();
    const json = { 'Content-Type': 'application/json' };
    const first = await app.request('/api/assembly-pack/attendance', {
      method: 'PATCH', headers: { ...adm, ...json }, body: JSON.stringify({ year: 2026, present: ['u-1', 'u-2'] }),
    }, { DB: db });
    expect(first.status).toBe(200);
    expect((await first.json()).data.saved).toBe(2);
    const second = await app.request('/api/assembly-pack/attendance', {
      method: 'PATCH', headers: { ...adm, ...json }, body: JSON.stringify({ year: 2026, present: ['u-2'] }),
    }, { DB: db });
    expect((await second.json()).data.saved).toBe(1);
    expect(store.attendance).toEqual([{ year: 2026, user_id: 'u-2', present: 1 }]);
    const denied = await app.request('/api/assembly-pack/attendance', {
      method: 'PATCH', headers: { ...mem, ...json }, body: JSON.stringify({ year: 2026, present: [] }),
    }, { DB: fakeDb({ session: MEMBER_SESSION }).db });
    expect(denied.status).toBe(403);
  });
});
