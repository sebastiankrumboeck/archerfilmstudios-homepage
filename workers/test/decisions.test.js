import { describe, expect, it } from 'vitest';
import app from '../src/index.js';

const ADMIN = { id: 's-a', user_id: 'u-admin', expires_at: '2030-01-01T00:00:00Z', is_admin: 1, is_kassier: 0 };
const MEMBER_SESSION = { id: 's-m', user_id: 'u-1', expires_at: '2030-01-01T00:00:00Z', is_admin: 0, is_kassier: 0 };
const adm = { Cookie: 'app-session=s-a' };
const mem = { Cookie: 'app-session=s-m' };
const json = { 'Content-Type': 'application/json' };

const D1 = { id: 'd-1', title: 'Beitrag fix', detail: '12 € ab 2027', decided_at: '2026-09-01', recorded_by: 'u-admin', created_at: '2026-09-02T00:00:00Z' };
const D2 = { id: 'd-2', title: 'Neuer Raum', detail: '', decided_at: '2026-10-01', recorded_by: 'u-admin', created_at: '2026-10-02T00:00:00Z' };

function fakeDb({ session = ADMIN, decisions = [D1, D2], decisionRow = D1 } = {}) {
  let inserted = null;
  return {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          if (sql.includes('FROM sessions')) return session;
          if (sql.includes('FROM decisions') && sql.includes('id = ?')) return inserted ?? decisionRow;
          return null;
        },
        all: async () => {
          if (sql.includes('FROM decisions')) return { results: inserted ? [...decisions, inserted] : decisions };
          return { results: [] };
        },
        run: async () => {
          if (sql.startsWith('INSERT INTO decisions')) {
            inserted = { id: args[0], title: args[1], detail: args[2], decided_at: args[3], recorded_by: args[4], created_at: args[5] };
          }
          return {};
        },
      }),
      all: async () => {
        if (sql.includes('FROM decisions')) return { results: decisions };
        return { results: [] };
      },
    }),
  };
}

describe('decisions', () => {
  it('member lists decisions newest first', async () => {
    const seen = [];
    const inner = fakeDb({ session: MEMBER_SESSION });
    const db = { prepare: (sql) => { seen.push(sql); return inner.prepare(sql); } };
    const res = await app.request('/api/decisions', { headers: mem }, { DB: db });
    expect(res.status).toBe(200);
    const { decisions } = (await res.json()).data;
    expect(decisions.map((d) => d.id).sort()).toEqual(['d-1', 'd-2']);
    expect(seen.some((sql) => sql.includes('ORDER BY decided_at DESC'))).toBe(true);
  });

  it('admin creates with defaults, member gets 403', async () => {
    const res = await app.request('/api/decisions', {
      method: 'POST', headers: { ...adm, ...json }, body: JSON.stringify({ title: 'Neuer Beschluss' }),
    }, { DB: fakeDb({ decisionRow: { ...D1, id: 'd-9', title: 'Neuer Beschluss' } }) });
    expect(res.status).toBe(201);
    const { decision } = (await res.json()).data;
    expect(decision.title).toBe('Neuer Beschluss');
    expect(decision.decided_at).toBe(new Date().toISOString().slice(0, 10));
    const denied = await app.request('/api/decisions', {
      method: 'POST', headers: { ...mem, ...json }, body: JSON.stringify({ title: 'X' }),
    }, { DB: fakeDb({ session: MEMBER_SESSION }) });
    expect(denied.status).toBe(403);
  });

  it('rejects bad input with 400', async () => {
    const bodies = [
      { title: '' },
      { title: 'x'.repeat(151) },
      { title: 'Ok', detail: 'x'.repeat(2001) },
      { title: 'Ok', decided_at: '2026-13-99' },
      { title: 'Ok', decided_at: 'next week' },
    ];
    for (const body of bodies) {
      const res = await app.request('/api/decisions', {
        method: 'POST', headers: { ...adm, ...json }, body: JSON.stringify(body),
      }, { DB: fakeDb() });
      expect(res.status).toBe(400);
    }
  });

  it('delete removes, unknown gives 404, member gets 403', async () => {
    const res = await app.request('/api/decisions/d-1', { method: 'DELETE', headers: adm }, { DB: fakeDb() });
    expect(res.status).toBe(200);
    const missing = await app.request('/api/decisions/nope', { method: 'DELETE', headers: adm }, { DB: fakeDb({ decisionRow: null }) });
    expect(missing.status).toBe(404);
    const denied = await app.request('/api/decisions/d-1', { method: 'DELETE', headers: mem }, { DB: fakeDb({ session: MEMBER_SESSION }) });
    expect(denied.status).toBe(403);
  });
});
