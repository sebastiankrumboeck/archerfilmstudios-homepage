import { describe, expect, it } from 'vitest';
import app from '../src/index.js';

const ADMIN = { id: 's-a', user_id: 'u-admin', expires_at: '2030-01-01T00:00:00Z', is_admin: 1, is_kassier: 0 };
const MEMBER_SESSION = { id: 's-m', user_id: 'u-1', expires_at: '2030-01-01T00:00:00Z', is_admin: 0, is_kassier: 0 };
const adm = { Cookie: 'app-session=s-a' };
const mem = { Cookie: 'app-session=s-m' };
const json = { 'Content-Type': 'application/json' };

const A1 = { id: 'a-1', title: 'GV Frühjahr', held_on: '2026-03-15', minutes_id: 'm-1', created_at: '2026-03-01T00:00:00Z' };
const A2 = { id: 'a-2', title: 'GV Herbst', held_on: '2026-10-15', minutes_id: null, created_at: '2026-10-01T00:00:00Z' };
const MINUTE = { id: 'm-1', title: 'Protokoll Frühjahr', r2_key: 'minutes/m-1.pdf', uploaded_by: 'u-7', created_at: '2026-03-16T00:00:00Z' };
const USERS = [
  { id: 'u-1', name: 'Anna', created_at: '2024-03-01T00:00:00Z' },
  { id: 'u-2', name: 'Ben', created_at: '2026-05-01T00:00:00Z' },
];
const PROJECTS = [{ id: 'p1', title: 'Shoot', start_at: '2026-06-01T18:00:00Z', end_at: '2026-06-01T22:00:00Z' }];
const MEMBERSHIPS = [{ project_id: 'p1', user_id: 'u-1' }, { project_id: 'p1', user_id: 'u-2' }];
const OPEN = { id: 'i-1', user_id: 'u-1', user_name: 'Anna', year: 2026, amount_cents: 1200, reason: 'Beitrag', status: 'open', created_at: '2026-01-05T00:00:00Z', paid_at: null };
const PAID = { id: 'i-2', user_id: 'u-2', user_name: 'Ben', year: 2026, amount_cents: 1200, reason: 'Beitrag', status: 'paid', created_at: '2026-01-06T00:00:00Z', paid_at: '2026-02-01T00:00:00Z', paid_method: 'cash' };

function fakeDb({ session = ADMIN, assemblies = [A1, A2], assemblyRow = A1, minuteRow = MINUTE, runLog = null, users = USERS, projects = PROJECTS, memberships = MEMBERSHIPS, invoices = [OPEN, PAID], attendance = [{ assembly_id: 'a-1', user_id: 'u-1', present: 1 }] } = {}) {
  const store = { assemblies: assemblies.map((r) => ({ ...r })), attendance: attendance.map((r) => ({ ...r })) };
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
  const handler = (sql) => ({
    bind: (...args) => ({
      first: async () => {
        if (sql.includes('FROM sessions')) return session;
        if (sql.includes('FROM assemblies') && sql.includes('id = ?')) {
          return store.assemblies.find((r) => r.id === args[0]) ?? null;
        }
        if (sql.includes('FROM minutes') && sql.includes('id = ?')) {
          return minuteRow && args[0] === minuteRow.id ? minuteRow : null;
        }
        if (sql.includes('FROM invoices') && sql.includes("status = 'open'")) return sums(inYear(invoices.filter((r) => r.status === 'open'), args));
        if (sql.includes('FROM invoices') && sql.includes("status = 'paid'")) return sums(inYear(invoices.filter((r) => r.status === 'paid'), args));
        if (sql.includes('FROM invoices') && sql.includes("status = 'cancelled'")) {
          return { n: inYear(invoices.filter((r) => r.status === 'cancelled'), args).length };
        }
        if (sql.includes('COUNT(*) AS n FROM memberships')) {
          return { n: memberships.filter((m) => m.project_id === args[0]).length };
        }
        return null;
      },
      all: async () => {
        if (sql.includes('FROM assemblies')) return { results: store.assemblies };
        if (sql === 'SELECT * FROM users') return { results: users };
        if (sql.includes('FROM projects')) return { results: projects };
        if (sql.includes('FROM invoices')) {
          const status = sql.includes("status = 'open'") ? 'open' : null;
          return { results: inYear(invoices.filter((r) => !status || r.status === status), args) };
        }
        if (sql.includes('FROM memberships m JOIN users')) {
          return { results: memberships.filter((m) => m.project_id === args[0]).map((m) => users.find((u) => u.id === m.user_id)) };
        }
        if (sql.includes('FROM assembly_attendance')) {
          const aid = args[0];
          return { results: store.attendance.filter((r) => aid === undefined || r.assembly_id === aid) };
        }
        return { results: [] };
      },
      run: async () => {
        runLog?.(sql, args);
        if (sql.startsWith('INSERT INTO assemblies')) {
          store.assemblies.push({ id: args[0], title: args[1], held_on: args[2], minutes_id: null, created_at: args[3] });
        }
        if (sql.startsWith('UPDATE assemblies SET minutes_id')) {
          const row = store.assemblies.find((r) => r.id === args[1]);
          if (row) row.minutes_id = args[0];
        }
        if (sql.startsWith('UPDATE assemblies SET title')) {
          const row = store.assemblies.find((r) => r.id === args[3]);
          if (row) {
            row.title = args[0];
            row.held_on = args[1];
            row.minutes_id = args[2];
          }
        }
        if (sql.startsWith('DELETE FROM assemblies')) {
          store.assemblies = store.assemblies.filter((r) => r.id !== args[0]);
        }
        if (sql.startsWith('DELETE FROM assembly_attendance')) {
          store.attendance = store.attendance.filter((r) => r.assembly_id !== args[0]);
        }
        if (sql.startsWith('INSERT INTO assembly_attendance')) {
          store.attendance.push({ assembly_id: args[0], user_id: args[1], present: 1 });
        }
        if (sql.startsWith('UPDATE assemblies SET minutes_id = NULL')) {
          for (const r of store.assemblies) if (r.minutes_id === args[0]) r.minutes_id = null;
        }
        return {};
      },
    }),
    all: async () => {
      if (sql.includes('FROM assemblies')) return { results: store.assemblies };
      if (sql === 'SELECT * FROM users') return { results: users };
      if (sql.includes('FROM assembly_attendance')) return { results: store.attendance };
      return { results: [] };
    },
  });
  return {
    store,
    db: { prepare: handler },
  };
}

describe('assemblies', () => {
  it('lists assemblies newest first with minutes links', async () => {
    const seen = [];
    const inner = fakeDb();
    const db = { prepare: (sql) => { seen.push(sql); return inner.db.prepare(sql); } };
    const res = await app.request('/api/assemblies', { headers: adm }, { DB: db });
    expect(res.status).toBe(200);
    const { assemblies } = (await res.json()).data;
    expect(assemblies.map((a) => a.id).sort()).toEqual(['a-1', 'a-2']);
    expect(assemblies.find((a) => a.id === 'a-1').minutes_id).toBe('m-1');
    expect(seen.some((sql) => sql.includes('ORDER BY held_on DESC'))).toBe(true);
  });

  it('creates with validation', async () => {
    const { store, db } = fakeDb();
    const res = await app.request('/api/assemblies', {
      method: 'POST', headers: { ...adm, ...json }, body: JSON.stringify({ title: 'GV Winter', held_on: '2026-12-10' }),
    }, { DB: db });
    expect(res.status).toBe(201);
    const { assembly } = (await res.json()).data;
    expect(assembly.title).toBe('GV Winter');
    expect(assembly.minutes_id).toBeNull();
    expect(store.assemblies.some((r) => r.id === assembly.id)).toBe(true);
    for (const body of [{ title: '' }, { title: 'X', held_on: '2026-13-99' }, { title: 'X', held_on: 'someday' }]) {
      const bad = await app.request('/api/assemblies', {
        method: 'POST', headers: { ...adm, ...json }, body: JSON.stringify(body),
      }, { DB: db });
      expect(bad.status).toBe(400);
    }
    const denied = await app.request('/api/assemblies', {
      method: 'POST', headers: { ...mem, ...json }, body: JSON.stringify({ title: 'X', held_on: '2026-12-10' }),
    }, { DB: fakeDb({ session: MEMBER_SESSION }).db });
    expect(denied.status).toBe(403);
  });

  it('links and clears minutes with existence check', async () => {
    const { store, db } = fakeDb();
    const bad = await app.request('/api/assemblies/a-2', {
      method: 'PATCH', headers: { ...adm, ...json }, body: JSON.stringify({ minutes_id: 'nope' }),
    }, { DB: db });
    expect(bad.status).toBe(400);
    const linked = await app.request('/api/assemblies/a-2', {
      method: 'PATCH', headers: { ...adm, ...json }, body: JSON.stringify({ minutes_id: 'm-1' }),
    }, { DB: db });
    expect(linked.status).toBe(200);
    expect(store.assemblies.find((r) => r.id === 'a-2').minutes_id).toBe('m-1');
    const cleared = await app.request('/api/assemblies/a-1', {
      method: 'PATCH', headers: { ...adm, ...json }, body: JSON.stringify({ minutes_id: null }),
    }, { DB: db });
    expect(cleared.status).toBe(200);
    expect(store.assemblies.find((r) => r.id === 'a-1').minutes_id).toBeNull();
    const missing = await app.request('/api/assemblies/nope', {
      method: 'PATCH', headers: { ...adm, ...json }, body: JSON.stringify({ title: 'X' }),
    }, { DB: db });
    expect(missing.status).toBe(404);
  });

  it('delete removes assembly and its attendance, unknown gives 404, member gets 403', async () => {
    const { store, db } = fakeDb();
    const res = await app.request('/api/assemblies/a-1', { method: 'DELETE', headers: adm }, { DB: db });
    expect(res.status).toBe(200);
    expect(store.assemblies.some((r) => r.id === 'a-1')).toBe(false);
    expect(store.attendance).toEqual([]);
    const missing = await app.request('/api/assemblies/nope', { method: 'DELETE', headers: adm }, { DB: db });
    expect(missing.status).toBe(404);
    const denied = await app.request('/api/assemblies/a-2', { method: 'DELETE', headers: mem }, { DB: fakeDb({ session: MEMBER_SESSION }).db });
    expect(denied.status).toBe(403);
  });

  it('deleting a linked minute clears the assembly link', async () => {    const { store } = fakeDb();
    const res = await app.request('/api/minutes/m-1', { method: 'DELETE', headers: adm }, {
      DB: {
        prepare: (sql) => ({
          bind: (...args) => ({
            first: async () => {
              if (sql.includes('FROM sessions')) return ADMIN;
              if (sql.includes('FROM minutes')) return MINUTE;
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => {
              if (sql.startsWith('UPDATE assemblies SET minutes_id = NULL')) {
                for (const r of store.assemblies) if (r.minutes_id === args[0]) r.minutes_id = null;
              }
              return {};
            },
          }),
        }),
      },
      AVATARS: { put: async () => ({}), get: async () => null, delete: async () => ({}) },
    });
    expect(res.status).toBe(200);
    expect(store.assemblies.find((r) => r.id === 'a-1').minutes_id).toBeNull();
  });

  it('pack loads by assembly with its year numbers and scoped attendance', async () => {
    const { db } = fakeDb();
    const res = await app.request('/api/assembly-pack?assembly=a-1', { headers: adm }, { DB: db });
    expect(res.status).toBe(200);
    const { assembly, pack } = (await res.json()).data;
    expect(assembly.id).toBe('a-1');
    expect(assembly.minutes_id).toBe('m-1');
    expect(pack.year).toBe(2026);
    expect(pack.member_count).toBe(2);
    expect(pack.new_members.map((m) => m.name)).toEqual(['Ben']);
    expect(pack.projects).toHaveLength(1);
    expect(pack.projects[0].member_count).toBe(2);
    expect(pack.finance.paid_cents).toBe(1200);
    expect(pack.open_invoices).toHaveLength(1);
    expect(pack.attendance).toEqual([{ user_id: 'u-1', present: 1 }]);
    const other = await app.request('/api/assembly-pack?assembly=a-2', { headers: adm }, { DB: db });
    expect((await other.json()).data.pack.attendance).toEqual([]);
  });

  it('unknown assembly gives 404 on pack and attendance PATCH', async () => {
    const { db } = fakeDb();
    const pack = await app.request('/api/assembly-pack?assembly=nope', { headers: adm }, { DB: db });
    expect(pack.status).toBe(404);
    const missing = await app.request('/api/assembly-pack?assembly=nope', { headers: adm }, { DB: db });
    expect(missing.status).toBe(404);
    const patch = await app.request('/api/assembly-pack/attendance', {
      method: 'PATCH', headers: { ...adm, ...json }, body: JSON.stringify({ assembly: 'nope', present: ['u-1'] }),
    }, { DB: db });
    expect(patch.status).toBe(404);
  });

  it('attendance PATCH replaces per assembly idempotently with dedupe', async () => {
    const { store, db } = fakeDb({ attendance: [] });
    const json = { 'Content-Type': 'application/json' };
    const first = await app.request('/api/assembly-pack/attendance', {
      method: 'PATCH', headers: { ...adm, ...json }, body: JSON.stringify({ assembly: 'a-2', present: ['u-1', 'u-1', 'u-2'] }),
    }, { DB: db });
    expect(first.status).toBe(200);
    expect((await first.json()).data.saved).toBe(2);
    expect(store.attendance).toEqual([
      { assembly_id: 'a-2', user_id: 'u-1', present: 1 },
      { assembly_id: 'a-2', user_id: 'u-2', present: 1 },
    ]);
  });
});
