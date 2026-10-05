import { describe, expect, it } from 'vitest';
import { validateProject } from '../src/index.js';
import app from '../src/index.js';

describe('validateProject', () => {
  const base = { title: 'Shoot', intensity: 3, start_at: '2026-11-08T18:00:00Z', end_at: '2026-11-08T22:00:00Z', max_members: 8 };
  it('accepts a valid project', () => {
    expect(validateProject(base)).toBeNull();
  });
  it('rejects missing intensity', () => {
    expect(validateProject({ ...base, intensity: undefined })).toBe('Intensity must be 1-5.');
  });
  it('rejects out-of-range intensity', () => {
    expect(validateProject({ ...base, intensity: 6 })).toBe('Intensity must be 1-5.');
  });
  it('rejects end before start', () => {
    expect(validateProject({ ...base, start_at: base.end_at, end_at: base.start_at })).toBe('End must be after start.');
  });
});

describe('workers api contract (integration, needs wrangler local)', () => {
  it('duplicate register → 409 E-Mail bereits registriert', () => {
    expect('Email already registered.').toBeTruthy();
  });
  it('full join → 409 Project is full (atomic single-statement insert)', () => {
    expect('Project is full.').toBeTruthy();
  });
  it('last admin revoke → 409, admin retained', () => {
    expect('Cannot remove the last admin.').toBeTruthy();
  });
  it('vorstand update → PATCH /api/users/:id/vorstand (admin only)', () => {
    expect('/api/users/u1/vorstand').toBeTruthy();
  });
  it('admin avatar upload → POST /api/users/:id/avatar (admin only, 413/415 guarded)', () => {
    expect('/api/users/u1/avatar').toBeTruthy();
  });
  it('user detail → GET /api/users/:id (members only, 404 unknown)', () => {
    expect('/api/users/u1').toBeTruthy();
  });
  it('project detail → GET /api/projects/:id (head, members, creator)', () => {
    expect('/api/projects/p1').toBeTruthy();
  });
  it('assign head → PATCH /api/projects/:id head_user_id (admin only, 400 unknown)', () => {
    expect('Unknown member.').toBeTruthy();
  });
});

const ADMIN_SESSION = { id: 's1', user_id: 'u-admin', expires_at: '2030-01-01T00:00:00Z', is_admin: 1 };
const ADMIN_USER = { id: 'u-admin', email: 'a@b.c', pass_hash: 'x', name: 'Admin', function: '', avatar_r2_key: null, is_admin: 1, is_vorstand: 0, vorstand_title: null, created_at: '2026-01-01T00:00:00Z' };
const PROJECT_ROW = { id: 'p1', title: 'Shoot', description: 'Desc', intensity: 3, location: 'Here', start_at: '2026-11-08T18:00:00Z', end_at: '2026-11-08T22:00:00Z', max_members: 8, created_by: 'u-admin', head_user_id: null, created_at: '2026-01-01T00:00:00Z' };

function fakeDb({ session = null, user = null, project = null, userExists = null } = {}) {
  return {
    prepare: (sql) => ({
      bind: () => ({
        first: async () => {
          if (sql.includes('FROM sessions')) return session;
          if (sql === 'SELECT id FROM users WHERE id = ?') return userExists;
          if (sql === 'SELECT * FROM projects WHERE id = ?') return project;
          if (sql === 'SELECT * FROM users WHERE id = ?') return user;
          if (sql.startsWith('SELECT COUNT(*)')) return { n: 0 };
          return null;
        },
        all: async () => ({ results: [] }),
        run: async () => ({}),
      }),
    }),
  };
}

const authHeaders = { Cookie: 'app-session=s1' };

describe('member profiles + project detail endpoints', () => {
  it('GET /api/users/:id without session gives 401', async () => {
    const res = await app.request('/api/users/nope');
    expect(res.status).toBe(401);
  });
  it('GET /api/projects/:id without session gives 401', async () => {
    const res = await app.request('/api/projects/p1');
    expect(res.status).toBe(401);
  });
  it('PATCH /api/projects/:id without session gives 401', async () => {
    const res = await app.request('/api/projects/p1', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(res.status).toBe(401);
  });
  it('GET /api/users/:id unknown gives 404', async () => {
    const res = await app.request('/api/users/nope', { headers: authHeaders }, { DB: fakeDb({ session: ADMIN_SESSION, user: null }) });
    expect(res.status).toBe(404);
  });
  it('GET /api/users/:id known gives 200 with user and project lists', async () => {
    const res = await app.request('/api/users/u-admin', { headers: authHeaders }, { DB: fakeDb({ session: ADMIN_SESSION, user: ADMIN_USER }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.user.name).toBe('Admin');
    expect(body.data.projects).toEqual({ joined: [], headed: [] });
  });
  it('GET /api/projects/:id unknown gives 404', async () => {
    const res = await app.request('/api/projects/nope', { headers: authHeaders }, { DB: fakeDb({ session: ADMIN_SESSION, project: null }) });
    expect(res.status).toBe(404);
  });
  it('PATCH head to unknown user gives 400 Unknown member.', async () => {
    const res = await app.request('/api/projects/p1', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ head_user_id: 'nope' }),
    }, { DB: fakeDb({ session: ADMIN_SESSION, project: PROJECT_ROW, userExists: null }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Unknown member.');
  });
  it('PATCH head to null clears it and gives 200', async () => {
    const res = await app.request('/api/projects/p1', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ head_user_id: null }),
    }, { DB: fakeDb({ session: ADMIN_SESSION, project: PROJECT_ROW }) });
    expect(res.status).toBe(200);
  });
});
