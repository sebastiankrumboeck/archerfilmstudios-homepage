import { describe, expect, it } from 'vitest';
import app from '../src/index.js';

const ADMIN_SESSION = { id: 's1', user_id: 'u-admin', expires_at: '2030-01-01T00:00:00Z', is_admin: 1 };
const MEMBER_SESSION = { id: 's2', user_id: 'u-1', expires_at: '2030-01-01T00:00:00Z', is_admin: 0 };

function fakeDb({ session = null, user = null, linkRows = [] } = {}) {
  let links = [...linkRows];
  const firstFor = (sql) => {
    if (sql.includes('FROM sessions')) return session;
    if (sql === 'SELECT * FROM users WHERE id = ?') return user;
    if (sql === 'SELECT id FROM users WHERE id = ?') return user ? { id: user.id } : null;
    return null;
  };
  const allFor = (sql) => {
    if (sql.includes('FROM vorstand_links')) return { results: links };
    return { results: [] };
  };
  const runFor = (sql, args) => {
    if (sql.startsWith('INSERT OR REPLACE INTO vorstand_links')) {
      links = [...links.filter((r) => r.slot !== args[0]), { slot: args[0], user_id: args[1] }];
    }
    if (sql.startsWith('DELETE FROM vorstand_links')) {
      links = links.filter((r) => r.slot !== args[0]);
    }
    return {};
  };
  return {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => firstFor(sql),
        all: async () => allFor(sql),
        run: async () => runFor(sql, args),
      }),
      first: async () => firstFor(sql),
      all: async () => allFor(sql),
      run: async () => runFor(sql, []),
    }),
  };
}

const authAdmin = { Cookie: 'app-session=s1' };
const authMember = { Cookie: 'app-session=s2' };

describe('vorstand links', () => {
  it('GET /api/vorstand-links without session gives 401', async () => {
    const res = await app.request('/api/vorstand-links');
    expect(res.status).toBe(401);
  });
  it('PUT /api/vorstand-links as non-admin gives 403', async () => {
    const res = await app.request('/api/vorstand-links', {
      method: 'PUT',
      headers: { ...authMember, 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot: 'kassier', user_id: 'u-1' }),
    }, { DB: fakeDb({ session: MEMBER_SESSION }) });
    expect(res.status).toBe(403);
  });
  it('PUT unknown slot gives 400', async () => {
    const res = await app.request('/api/vorstand-links', {
      method: 'PUT',
      headers: { ...authAdmin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot: 'pope', user_id: 'u-1' }),
    }, { DB: fakeDb({ session: ADMIN_SESSION, user: { id: 'u-1', name: 'Klemens' } }) });
    expect(res.status).toBe(400);
  });
  it('PUT unknown user gives 400 Unknown member.', async () => {
    const res = await app.request('/api/vorstand-links', {
      method: 'PUT',
      headers: { ...authAdmin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot: 'kassier', user_id: 'nope' }),
    }, { DB: fakeDb({ session: ADMIN_SESSION, user: null }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Unknown member.');
  });
  it('PUT valid link persists and GET shows it', async () => {
    const db = fakeDb({ session: ADMIN_SESSION, user: { id: 'u-1', name: 'Klemens' } });
    const put = await app.request('/api/vorstand-links', {
      method: 'PUT',
      headers: { ...authAdmin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot: 'kassier', user_id: 'u-1' }),
    }, { DB: db });
    expect(put.status).toBe(200);
    const get = await app.request('/api/vorstand-links', { headers: authAdmin }, { DB: db });
    expect((await get.json()).data.links).toEqual({ kassier: 'u-1' });
  });
  it('DELETE removes the link', async () => {
    const db = fakeDb({ session: ADMIN_SESSION, linkRows: [{ slot: 'kassier', user_id: 'u-1' }] });
    const del = await app.request('/api/vorstand-links/kassier', { method: 'DELETE', headers: authAdmin }, { DB: db });
    expect(del.status).toBe(200);
    const get = await app.request('/api/vorstand-links', { headers: authAdmin }, { DB: db });
    expect((await get.json()).data.links).toEqual({});
  });
  it('GET /api/users includes the link map', async () => {
    const db = fakeDb({ session: ADMIN_SESSION, linkRows: [{ slot: 'kassier', user_id: 'u-1' }] });
    const res = await app.request('/api/users', { headers: authAdmin }, { DB: db });
    expect(res.status).toBe(200);
    expect((await res.json()).data.links).toEqual({ kassier: 'u-1' });
  });
});
