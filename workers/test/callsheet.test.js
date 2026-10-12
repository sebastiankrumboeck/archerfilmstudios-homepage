import { describe, expect, it, vi } from 'vitest';
import app from '../src/index.js';

const SESSIONS = {
  's-head': { id: 's-head', user_id: 'u-head', expires_at: '2030-01-01T00:00:00.000Z', is_admin: 0, is_kassier: 0, is_vorstand: 0 },
  's-a': { id: 's-a', user_id: 'u-admin', expires_at: '2030-01-01T00:00:00.000Z', is_admin: 1, is_kassier: 0, is_vorstand: 0 },
  's-m': { id: 's-m', user_id: 'u-1', expires_at: '2030-01-01T00:00:00.000Z', is_admin: 0, is_kassier: 0, is_vorstand: 0 },
};

const ROLES = ['Kamera', 'Ton', 'Regie', 'Schnitt', 'Foto', 'Schauspiel', 'Organisation', 'Fahrer'];

function makeState() {
  return {
    users: [
      { id: 'u-head', email: 'h@x.at', name: 'Head' },
      { id: 'u-1', email: 'm@x.at', name: 'Max' },
    ],
    projects: [
      { id: 'p1', title: 'Nachtdreh', start_at: '2026-11-08T18:00:00.000Z', end_at: '2026-11-08T22:00:00.000Z', location: 'St. Pölten', head_user_id: 'u-head' },
    ],
    memberships: [
      { project_id: 'p1', user_id: 'u-head' },
      { project_id: 'p1', user_id: 'u-1' },
    ],
    sheets: [],
    roles: [],
  };
}

function stmt(sql, args, handlers) {
  return { first: () => handlers.first(sql, args), all: () => handlers.all(sql, args), run: () => handlers.run(sql, args), _sql: sql, _args: args };
}

function fakeDb(state) {
  const handlers = {
    first: async (sql, args) => {
      if (sql.includes('FROM sessions')) return SESSIONS[args[0]] ?? null;
      if (sql.includes('FROM projects') && sql.includes('id = ?')) return state.projects.find((p) => p.id === args[0]) ?? null;
      if (sql.includes('FROM users') && sql.includes('id = ?')) return state.users.find((u) => u.id === args[0]) ?? null;
      if (sql.includes('FROM call_sheets')) return state.sheets.find((s) => s.project_id === args[0]) ?? null;
      return null;
    },
    all: async (sql, args) => {
      if (sql.includes('FROM call_sheet_roles')) return { results: state.roles.filter((r) => r.project_id === args[0]) };
      if (sql.includes('JOIN users')) {
        return { results: state.memberships.filter((m) => m.project_id === args[0]).map((m) => state.users.find((u) => u.id === m.user_id)) };
      }
      return { results: [] };
    },
    run: async (sql, args) => {
      if (sql.startsWith('INSERT INTO call_sheets')) {
        const exists = state.sheets.some((s) => s.project_id === args[0]);
        if (exists && sql.includes('DO NOTHING')) return { meta: { changes: 0 } };
        if (sql.includes('DO NOTHING')) {
          state.sheets.push({ project_id: args[0], call_time: null, meeting_point: null, schedule: null, logistics: null, emergency_contacts: null, published_at: null, created_at: args[1], updated_at: args[2] });
          return { meta: { changes: 1 } };
        }
        const row = { project_id: args[0], call_time: args[1], meeting_point: args[2], schedule: args[3], logistics: args[4], emergency_contacts: args[5], published_at: null, created_at: '2026-10-12T00:00:00.000Z', updated_at: '2026-10-12T00:00:00.000Z' };
        const i = state.sheets.findIndex((s) => s.project_id === row.project_id);
        if (i >= 0) state.sheets[i] = { ...state.sheets[i], ...row };
        else state.sheets.push(row);
        return { meta: { changes: 1 } };
      }
      if (sql.startsWith('DELETE FROM call_sheet_roles')) {
        state.roles = state.roles.filter((r) => r.project_id !== args[0]);
        return { meta: { changes: 1 } };
      }
      if (sql.startsWith('INSERT INTO call_sheet_roles')) {
        state.roles.push({ id: args[0], project_id: args[1], role: args[2], user_id: args[3] });
        return { meta: { changes: 1 } };
      }
      if (sql.startsWith('UPDATE call_sheets SET published_at')) {
        const sheet = state.sheets.find((s) => s.project_id === args[1]);
        if (!sheet || sheet.published_at) return { meta: { changes: 0 } };
        sheet.published_at = args[0];
        return { meta: { changes: 1 } };
      }
      if (sql.startsWith('DELETE FROM call_sheet_roles')) {
        state.roles = state.roles.filter((r) => r.project_id !== args[0]);
        return { meta: { changes: 1 } };
      }
      if (sql.startsWith('DELETE FROM call_sheets')) {
        state.sheets = state.sheets.filter((s) => s.project_id !== args[0]);
        return { meta: { changes: 1 } };
      }
      return {};
    },
  };
  return {
    prepare: (sql) => ({ bind: (...args) => stmt(sql, args, handlers) }),
    batch: async (stmts) => {
      const out = [];
      for (const s of stmts) out.push(await handlers.run(s._sql, s._args));
      return out;
    },
  };
}

async function requestWith(state, path, session, method = 'GET', body) {
  const headers = { Cookie: `app-session=${session}` };
  const init = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  return app.request(path, init, { DB: fakeDb(state), RESEND_API_KEY: 're_test' });
}

const PUT_BODY = {
  call_time: '2026-11-08T17:00:00.000Z',
  meeting_point: 'Bahnhof St. Pölten',
  schedule: '17:00 Aufbau',
  logistics: 'Parken gratis',
  emergency_contacts: 'Head 0664',
  roles: [{ role: 'Kamera', user_id: 'u-1' }, { role: 'Ton', user_id: null }],
};

describe('call sheet GET/PUT', () => {
  it('GET returns the empty template when nothing stored', async () => {
    const res = await requestWith(makeState(), '/api/projects/p1/callsheet', 's-m');
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.sheet.call_time).toBeNull();
    expect(data.roles.map((r) => r.role).sort()).toEqual([...ROLES].sort());
    expect(data.roles.every((r) => r.user_id === null)).toBe(true);
  });

  it('PUT as plain member is 403 in German', async () => {
    const res = await requestWith(makeState(), '/api/projects/p1/callsheet', 's-m', 'PUT', PUT_BODY);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/Head oder Admin/);
  });

  it('PUT as head upserts and overwrites without duplicates', async () => {
    const state = makeState();
    const first = await requestWith(state, '/api/projects/p1/callsheet', 's-head', 'PUT', PUT_BODY);
    expect(first.status).toBe(200);
    const second = await requestWith(state, '/api/projects/p1/callsheet', 's-head', 'PUT', { ...PUT_BODY, meeting_point: 'Rathaus' });
    expect(second.status).toBe(200);
    expect(state.sheets).toHaveLength(1);
    expect(state.sheets[0].meeting_point).toBe('Rathaus');
    expect(state.roles.filter((r) => r.project_id === 'p1')).toHaveLength(2);
    const get = await requestWith(state, '/api/projects/p1/callsheet', 's-m');
    const { data } = await get.json();
    expect(data.roles.find((r) => r.role === 'Kamera')).toMatchObject({ user_id: 'u-1', user_name: 'Max' });
  });

  it('PUT rejects bad role, unknown user, and bad call_time in German', async () => {
    const badRole = await requestWith(makeState(), '/api/projects/p1/callsheet', 's-head', 'PUT', { ...PUT_BODY, roles: [{ role: 'kamera ', user_id: null }] });
    expect(badRole.status).toBe(400);
    const badUser = await requestWith(makeState(), '/api/projects/p1/callsheet', 's-head', 'PUT', { ...PUT_BODY, roles: [{ role: 'Kamera', user_id: 'u-nope' }] });
    expect(badUser.status).toBe(400);
    expect((await badUser.json()).error).toMatch(/Unbekannt/);
    const badTime = await requestWith(makeState(), '/api/projects/p1/callsheet', 's-head', 'PUT', { ...PUT_BODY, call_time: 'bald' });
    expect(badTime.status).toBe(400);
  });

  it('PUT rejects duplicate roles in German', async () => {
    const res = await requestWith(makeState(), '/api/projects/p1/callsheet', 's-head', 'PUT', {
      ...PUT_BODY,
      roles: [{ role: 'Kamera', user_id: null }, { role: 'Kamera', user_id: 'u-1' }],
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Doppelt/);
  });

  it('GET shows unbesetzt for a deleted role user', async () => {
    const state = makeState();
    await requestWith(state, '/api/projects/p1/callsheet', 's-head', 'PUT', PUT_BODY);
    state.users = state.users.filter((u) => u.id !== 'u-1');
    const res = await requestWith(state, '/api/projects/p1/callsheet', 's-m');
    const { data } = await res.json();
    const kamera = data.roles.find((r) => r.role === 'Kamera');
    expect(kamera.user_id).toBe('u-1');
    expect(kamera.user_name).toBeNull();
  });
});

describe('call sheet publish', () => {
  it('first publish mails every member once in German', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const state = makeState();
      await requestWith(state, '/api/projects/p1/callsheet', 's-head', 'PUT', PUT_BODY);
      const res = await requestWith(state, '/api/projects/p1/callsheet/publish', 's-head', 'POST');
      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.published_at).toBeTruthy();
      expect(data.email).toMatchObject({ sent: 2, failed: 0 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const bodies = fetchMock.mock.calls.map(([, opts]) => JSON.parse(opts.body));
      expect(bodies[0].subject).toMatch(/Nachtdreh.*Call Sheet/);
      expect(bodies[0].text).toContain('Bahnhof St. Pölten');
      expect(bodies[0].text).toContain('/projects/?id=p1');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('second publish is 409 with no further email', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const state = makeState();
      await requestWith(state, '/api/projects/p1/callsheet', 's-head', 'PUT', PUT_BODY);
      await requestWith(state, '/api/projects/p1/callsheet/publish', 's-head', 'POST');
      fetchMock.mockClear();
      const res = await requestWith(state, '/api/projects/p1/callsheet/publish', 's-head', 'POST');
      expect(res.status).toBe(409);
      expect((await res.json()).error).toMatch(/Bereits veröffentlicht/);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('publish without API key still publishes and counts failures', async () => {
    const state = makeState();
    await requestWith(state, '/api/projects/p1/callsheet', 's-head', 'PUT', PUT_BODY);
    const res = await app.request('/api/projects/p1/callsheet/publish', {
      method: 'POST',
      headers: { Cookie: 'app-session=s-head' },
    }, { DB: fakeDb(state) });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.published_at).toBeTruthy();
    expect(data.email).toMatchObject({ sent: 0, failed: 2 });
  });

  it('publish by plain member is 403', async () => {
    const res = await requestWith(makeState(), '/api/projects/p1/callsheet/publish', 's-m', 'POST');
    expect(res.status).toBe(403);
  });

  it('publish without a saved sheet creates and publishes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const state = makeState();
      const res = await requestWith(state, '/api/projects/p1/callsheet/publish', 's-head', 'POST');
      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.published_at).toBeTruthy();
      expect(state.sheets).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('deleting the project removes its sheet and roles', async () => {
    const state = makeState();
    await requestWith(state, '/api/projects/p1/callsheet', 's-head', 'PUT', PUT_BODY);
    expect(state.sheets).toHaveLength(1);
    const res = await requestWith(state, '/api/projects/p1', 's-a', 'DELETE');
    expect(res.status).toBe(200);
    expect(state.sheets).toHaveLength(0);
    expect(state.roles).toHaveLength(0);
  });
});
