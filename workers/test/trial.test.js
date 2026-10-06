import { describe, expect, it, vi } from 'vitest';
import app from '../src/index.js';

const json = { 'Content-Type': 'application/json' };
const ENV = { RESEND_API_KEY: 're_test' };
const ADMIN = { id: 's-a', user_id: 'u-admin', expires_at: '2030-01-01T00:00:00Z', is_admin: 1, is_kassier: 0 };
const MEMBER_SESSION = { id: 's-m', user_id: 'u-1', expires_at: '2030-01-01T00:00:00Z', is_admin: 0, is_kassier: 0 };
const adm = { Cookie: 'app-session=s-a' };
const mem = { Cookie: 'app-session=s-m' };

const GOOD = { name: 'Leo Gast', email: 'leo@example.com', note: 'Komme gern vorbei!' };
const ROW = { id: 't-1', name: 'Leo Gast', email: 'leo@example.com', note: 'Komme gern vorbei!', created_at: '2026-10-06T12:00:00Z', contacted: 0 };

function fakeDb({ session = null, signupRow = ROW, signups = [ROW], runLog = null } = {}) {
  return {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          if (sql.includes('FROM sessions')) return session;
          if (sql.includes('FROM trial_signups') && sql.includes('id = ?')) return signupRow;
          return null;
        },
        all: async () => {
          if (sql.includes('FROM trial_signups')) return { results: signups };
          return { results: [] };
        },
        run: async () => {
          runLog?.(sql, args);
          return {};
        },
      }),
      all: async () => {
        if (sql.includes('FROM trial_signups')) return { results: signups };
        return { results: [] };
      },
    }),
  };
}

describe('trial signups', () => {
  it('valid signup stores the lead and notifies the board', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'mail-1' }) });
    vi.stubGlobal('fetch', fetchMock);
    const ran = [];
    try {
      const res = await app.request('/api/trial-signups', {
        method: 'POST', headers: json, body: JSON.stringify(GOOD),
      }, { DB: fakeDb({ runLog: (sql, args) => ran.push([sql, args]) }), ...ENV });
      expect(res.status).toBe(201);
      const { signup, email } = (await res.json()).data;
      expect(signup.name).toBe('Leo Gast');
      expect(signup.contacted).toBe(0);
      expect(email).toEqual({ sent: true });
      expect(ran.some(([sql]) => sql.startsWith('INSERT INTO trial_signups'))).toBe(true);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.to).toBe('archerfilmstudios@gmail.com');
      expect(body.reply_to).toBe('leo@example.com');
      expect(body.subject).toBe('[Schnuppern] Leo Gast');
      expect(body.text).toContain('leo@example.com');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('signup is kept when Resend fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await app.request('/api/trial-signups', {
        method: 'POST', headers: json, body: JSON.stringify(GOOD),
      }, { DB: fakeDb(), ...ENV });
      expect(res.status).toBe(201);
      expect((await res.json()).data.email.sent).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('honeypot succeeds silently', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const ran = [];
    try {
      const res = await app.request('/api/trial-signups', {
        method: 'POST', headers: json, body: JSON.stringify({ ...GOOD, website: 'http://spam.example' }),
      }, { DB: fakeDb({ runLog: (sql, args) => ran.push([sql, args]) }), ...ENV });
      expect(res.status).toBe(200);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(ran).toHaveLength(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects bad input with 400', async () => {
    for (const body of [
      { ...GOOD, name: '' },
      { ...GOOD, email: 'nope' },
      { ...GOOD, note: 'x'.repeat(1001) },
    ]) {
      const res = await app.request('/api/trial-signups', {
        method: 'POST', headers: json, body: JSON.stringify(body),
      }, { DB: fakeDb(), ...ENV });
      expect(res.status).toBe(400);
    }
  });

  it('duplicate emails create two rows', async () => {
    const ran = [];
    const db = fakeDb({ signupRow: { ...ROW, id: 't-9' }, runLog: (sql, args) => ran.push([sql, args]) });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'mail-1' }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      for (let i = 0; i < 2; i += 1) {
        const res = await app.request('/api/trial-signups', {
          method: 'POST', headers: json, body: JSON.stringify(GOOD),
        }, { DB: db, ...ENV });
        expect(res.status).toBe(201);
      }
      const inserts = ran.filter(([sql]) => sql.startsWith('INSERT INTO trial_signups'));
      expect(inserts).toHaveLength(2);
      expect(inserts[0][1][0]).not.toBe(inserts[1][1][0]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('list and contacted-toggle are admin-only', async () => {
    const deniedList = await app.request('/api/trial-signups', { headers: mem }, { DB: fakeDb({ session: MEMBER_SESSION }) });
    expect(deniedList.status).toBe(403);
    const list = await app.request('/api/trial-signups', { headers: adm }, { DB: fakeDb({ session: ADMIN }) });
    expect(list.status).toBe(200);
    expect((await list.json()).data.signups).toHaveLength(1);
    const deniedPatch = await app.request('/api/trial-signups/t-1', {
      method: 'PATCH', headers: { ...mem, ...json }, body: JSON.stringify({ contacted: 1 }),
    }, { DB: fakeDb({ session: MEMBER_SESSION }) });
    expect(deniedPatch.status).toBe(403);
    const patched = await app.request('/api/trial-signups/t-1', {
      method: 'PATCH', headers: { ...adm, ...json }, body: JSON.stringify({ contacted: 1 }),
    }, { DB: fakeDb({ session: ADMIN, signupRow: { ...ROW, contacted: 1 } }) });
    expect(patched.status).toBe(200);
    const missing = await app.request('/api/trial-signups/nope', {
      method: 'PATCH', headers: { ...adm, ...json }, body: JSON.stringify({ contacted: 1 }),
    }, { DB: fakeDb({ session: ADMIN, signupRow: null }) });
    expect(missing.status).toBe(404);
  });
});
