import { describe, expect, it, vi } from 'vitest';
import app from '../src/index.js';

const SESSIONS = {
  's-head': { id: 's-head', user_id: 'u-head', expires_at: '2030-01-01T00:00:00.000Z', is_admin: 0, is_kassier: 0, is_vorstand: 0 },
  's-a': { id: 's-a', user_id: 'u-admin', expires_at: '2030-01-01T00:00:00.000Z', is_admin: 1, is_kassier: 0, is_vorstand: 0 },
  's-m': { id: 's-m', user_id: 'u-1', expires_at: '2030-01-01T00:00:00.000Z', is_admin: 0, is_kassier: 0, is_vorstand: 0 },
};

function makeState() {
  return {
    users: [
      { id: 'u-head', email: 'h@x.at', name: 'Head' },
      { id: 'u-1', email: 'm@x.at', name: 'Max' },
      { id: 'u-2', email: 'mia@x.at', name: 'Mia' },
    ],
    projects: [
      { id: 'p1', title: 'Nachtdreh', start_at: '2026-11-08T18:00:00.000Z', end_at: '2026-11-08T22:00:00.000Z', location: 'St. Pölten', head_user_id: 'u-head' },
    ],
    sheets: [],
    roles: [{ id: 'csr-1', project_id: 'p1', role: 'Kamera', user_id: 'u-2' }],
    applications: [],
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
      if (sql.includes('FROM call_sheet_roles')) return state.roles.find((r) => r.project_id === args[0] && (args.length < 2 || r.role === args[1])) ?? null;
      if (sql.includes('FROM role_applications') && sql.includes('id = ?')) return state.applications.find((a) => a.id === args[0]) ?? null;
      return null;
    },
    all: async (sql, args) => {
      if (sql.includes('FROM call_sheet_roles') && !sql.includes('AND role')) return { results: state.roles.filter((r) => r.project_id === args[0]) };
      if (sql.includes('FROM role_applications')) return { results: state.applications.filter((a) => a.project_id === args[0]) };
      if (sql.includes('JOIN users')) {
        return { results: (state.memberships ?? []).filter((m) => m.project_id === args[0]).map((m) => state.users.find((u) => u.id === m.user_id)) };
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
        if (args.length === 2) state.roles = state.roles.filter((r) => !(r.project_id === args[0] && r.role === args[1]));
        else state.roles = state.roles.filter((r) => r.project_id !== args[0]);
        return { meta: { changes: 1 } };
      }
      if (sql.startsWith('INSERT INTO call_sheet_roles')) {
        state.roles.push({ id: args[0], project_id: args[1], role: args[2], user_id: args[3] });
        return { meta: { changes: 1 } };
      }
      if (sql.startsWith('INSERT INTO role_applications')) {
        const dup = state.applications.some((a) => a.project_id === args[1] && a.role === args[2] && a.user_id === args[3]);
        if (dup) throw new Error('UNIQUE constraint failed: role_applications.project_id, role_applications.role, role_applications.user_id');
        state.applications.push({ id: args[0], project_id: args[1], role: args[2], user_id: args[3], status: 'pending', decided_by: null, created_at: args[4], decided_at: null });
        return { meta: { changes: 1 } };
      }
      if (sql.startsWith('UPDATE role_applications SET status')) {
        if (sql.includes('SET status = ?')) {
          const row = state.applications.find((a) => a.id === args[args.length - 1]);
          if (!row || row.status !== 'pending') return { meta: { changes: 0 } };
          row.status = args[0];
          row.decided_by = args[1];
          row.decided_at = args[2];
          return { meta: { changes: 1 } };
        }
        let n = 0;
        for (const a of state.applications) {
          if (a.project_id === args[args.length - 3] && a.role === args[args.length - 2] && a.status === 'pending' && a.id !== args[args.length - 1]) {
            a.status = 'rejected';
            a.decided_by = 'auto';
            n += 1;
          }
        }
        return { meta: { changes: n } };
      }
      if (sql.startsWith('DELETE FROM role_applications')) {
        state.applications = state.applications.filter((a) => a.project_id !== args[0]);
        return { meta: { changes: 1 } };
      }
      if (sql.startsWith('UPDATE call_sheets SET published_at')) {
        const sheet = state.sheets.find((s) => s.project_id === args[1]);
        if (!sheet || sheet.published_at) return { meta: { changes: 0 } };
        sheet.published_at = args[0];
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

describe('crew role applications', () => {
  it('member applies for an open role; names gated by head status', async () => {
    const state = makeState();
    const res = await requestWith(state, '/api/projects/p1/roles/apply', 's-m', 'POST', { role: 'Ton' });
    expect(res.status).toBe(201);
    const getHead = await requestWith(state, '/api/projects/p1/callsheet', 's-head');
    const headData = (await getHead.json()).data;
    expect(headData.applications.map((a) => a.role)).toContain('Ton');
    expect(headData.applications.find((a) => a.role === 'Ton').user_name).toBe('Max');
    const getStranger = await requestWith(state, '/api/projects/p1/callsheet', 's-m');
    const strangerData = (await getStranger.json()).data;
    expect(strangerData.applications.find((a) => a.role === 'Ton').user_name).toBeNull();
  });

  it('apply rejects filled role, duplicates, and bad role names in German', async () => {
    const filled = await requestWith(makeState(), '/api/projects/p1/roles/apply', 's-m', 'POST', { role: 'Kamera' });
    expect(filled.status).toBe(409);
    const state = makeState();
    await requestWith(state, '/api/projects/p1/roles/apply', 's-m', 'POST', { role: 'Ton' });
    const dup = await requestWith(state, '/api/projects/p1/roles/apply', 's-m', 'POST', { role: 'Ton' });
    expect(dup.status).toBe(409);
    expect((await dup.json()).error).toMatch(/Bereits beworben/);
    const bad = await requestWith(makeState(), '/api/projects/p1/roles/apply', 's-m', 'POST', { role: ' ton' });
    expect(bad.status).toBe(400);
  });

  it('decision by plain member is 403; approve fills role, rejects competitors, mails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const state = makeState();
      const mine = await requestWith(state, '/api/projects/p1/roles/apply', 's-m', 'POST', { role: 'Ton' });
      const other = await requestWith(state, '/api/projects/p1/roles/apply', 's-a', 'POST', { role: 'Ton' });
      expect(other.status).toBe(201);
      const mineId = (await mine.json()).data.application_id;
      const denied = await requestWith(state, `/api/role-applications/${mineId}/decision`, 's-m', 'POST', { approved: true });
      expect(denied.status).toBe(403);
      const res = await requestWith(state, `/api/role-applications/${mineId}/decision`, 's-head', 'POST', { approved: true });
      expect(res.status).toBe(200);
      expect(state.roles.find((r) => r.role === 'Ton').user_id).toBe('u-1');
      expect(state.applications.every((a) => a.status !== 'pending')).toBe(true);
      const bodies = fetchMock.mock.calls.map(([, opts]) => JSON.parse(opts.body));
      expect(bodies.map((b) => b.to)).toContain('m@x.at');
      expect(bodies.find((b) => b.to === 'm@x.at').subject).toMatch(/zugesagt|Zusage|bestätigt/i);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reject mails Absage; second decision is 409', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const state = makeState();
      const applied = await requestWith(state, '/api/projects/p1/roles/apply', 's-m', 'POST', { role: 'Ton' });
      const id = (await applied.json()).data.application_id;
      const res = await requestWith(state, `/api/role-applications/${id}/decision`, 's-head', 'POST', { approved: false });
      expect(res.status).toBe(200);
      const bodies = fetchMock.mock.calls.map(([, opts]) => JSON.parse(opts.body));
      expect(bodies[0].subject).toMatch(/abgesagt/i);
      const again = await requestWith(state, `/api/role-applications/${id}/decision`, 's-head', 'POST', { approved: true });
      expect(again.status).toBe(409);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('approve after manual PUT-fill overwrites with the applicant', async () => {
    const state = makeState();
    await requestWith(state, '/api/projects/p1/roles/apply', 's-m', 'POST', { role: 'Ton' });
    await requestWith(state, '/api/projects/p1/callsheet', 's-head', 'PUT', {
      call_time: null, meeting_point: '', schedule: '', logistics: '', emergency_contacts: '',
      roles: [{ role: 'Ton', user_id: 'u-2' }],
    });
    const get = await requestWith(state, '/api/projects/p1/callsheet', 's-head');
    const app = (await get.json()).data.applications.find((a) => a.role === 'Ton' && a.user_id === 'u-1');
    const res = await requestWith(state, `/api/role-applications/${app.id}/decision`, 's-head', 'POST', { approved: true });
    expect(res.status).toBe(200);
    expect(state.roles.filter((r) => r.role === 'Ton')).toHaveLength(1);
    expect(state.roles.find((r) => r.role === 'Ton').user_id).toBe('u-1');
  });

  it('deleting the project removes its applications', async () => {
    const state = makeState();
    const applied = await requestWith(state, '/api/projects/p1/roles/apply', 's-m', 'POST', { role: 'Ton' });
    expect(applied.status).toBe(201);
    expect(state.applications).toHaveLength(1);
    const res = await requestWith(state, '/api/projects/p1', 's-a', 'DELETE');
    expect(res.status).toBe(200);
    expect(state.applications).toHaveLength(0);
  });
});
