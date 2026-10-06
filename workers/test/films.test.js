import { describe, expect, it } from 'vitest';
import app from '../src/index.js';
import { validateFilm } from '../src/index.js';

const ADMIN_SESSION = { id: 's1', user_id: 'u-admin', expires_at: '2030-01-01T00:00:00Z', is_admin: 1 };
const MEMBER_SESSION = { id: 's2', user_id: 'u-1', expires_at: '2030-01-01T00:00:00Z', is_admin: 0 };
const FILM_ROW = { id: 'f1', title: 'Night Reel', poster_r2_key: null, url: 'https://example.com/night-reel', created_at: '2026-01-01T00:00:00Z' };

function fakeDb({ session = null, film = FILM_ROW, films = [FILM_ROW] } = {}) {
  const allFor = (sql) => {
    if (sql.includes('FROM films')) return { results: films };
    return { results: [] };
  };
  return {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          if (sql.includes('FROM sessions')) return session;
          if (sql === 'SELECT * FROM films WHERE id = ?') return film;
          return null;
        },
        all: async () => allFor(sql),
        run: async () => ({}),
      }),
      all: async () => allFor(sql),
    }),
  };
}

const json = { 'Content-Type': 'application/json' };

describe('validateFilm', () => {
  it('accepts title and http(s) url', () => {
    expect(validateFilm({ title: 'T', url: 'https://example.com/x' })).toBeNull();
  });
  it('rejects missing title', () => {
    expect(validateFilm({ title: ' ', url: 'https://example.com/x' })).toBe('Title is required.');
  });
  it('rejects non-http urls', () => {
    expect(validateFilm({ title: 'T', url: 'ftp://example.com' })).toBe('Film website URL must start with http(s).');
    expect(validateFilm({ title: 'T', url: '' })).toBe('Film website URL must start with http(s).');
  });
});

describe('films endpoints', () => {
  it('GET /api/films is public (no session)', async () => {
    const res = await app.request('/api/films', {}, { DB: fakeDb() });
    expect(res.status).toBe(200);
    expect((await res.json()).data.films).toHaveLength(1);
  });
  it('POST /api/films without session gives 401', async () => {
    const res = await app.request('/api/films', { method: 'POST', headers: json, body: '{}' });
    expect(res.status).toBe(401);
  });
  it('POST /api/films as member gives 403', async () => {
    const res = await app.request('/api/films', {
      method: 'POST', headers: { Cookie: 'app-session=s2', ...json }, body: '{}',
    }, { DB: fakeDb({ session: MEMBER_SESSION }) });
    expect(res.status).toBe(403);
  });
  it('POST /api/films with bad url gives 400', async () => {
    const res = await app.request('/api/films', {
      method: 'POST', headers: { Cookie: 'app-session=s1', ...json },
      body: JSON.stringify({ title: 'T', url: 'notaurl' }),
    }, { DB: fakeDb({ session: ADMIN_SESSION }) });
    expect(res.status).toBe(400);
  });
  it('POST /api/films valid gives 201', async () => {
    const res = await app.request('/api/films', {
      method: 'POST', headers: { Cookie: 'app-session=s1', ...json },
      body: JSON.stringify({ title: 'T', url: 'https://example.com/t' }),
    }, { DB: fakeDb({ session: ADMIN_SESSION, film: { ...FILM_ROW, id: 'f-new' } }) });
    expect(res.status).toBe(201);
  });
  it('POST /api/films/:id/poster wrong type gives 415', async () => {
    const res = await app.request('/api/films/f1/poster', {
      method: 'POST', headers: { Cookie: 'app-session=s1', 'Content-Type': 'image/heic' }, body: new Uint8Array([1]),
    }, { DB: fakeDb({ session: ADMIN_SESSION }), AVATARS: { put: async () => ({}) } });
    expect(res.status).toBe(415);
  });
  it('DELETE /api/films/:id unknown gives 404', async () => {
    const res = await app.request('/api/films/nope', {
      method: 'DELETE', headers: { Cookie: 'app-session=s1' },
    }, { DB: fakeDb({ session: ADMIN_SESSION, film: null }) });
    expect(res.status).toBe(404);
  });
  it('GET /posters/:key missing gives 404', async () => {
    const res = await app.request('/posters/none.jpg', {}, { DB: fakeDb(), AVATARS: { get: async () => null } });
    expect(res.status).toBe(404);
  });
});
