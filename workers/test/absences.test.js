import { describe, expect, it, vi, beforeEach } from 'vitest';
import app from '../src/index.js';

const NOW_MS = Date.parse('2026-10-10T12:00:00.000Z');
const FUTURE_START = '2026-10-20T18:00:00.000Z'; // Frist (3d) not passed
const LATE_START = '2026-10-12T18:00:00.000Z'; // Frist passed (deadline was 10-09)

const SESSIONS = {
  's-m': { id: 's-m', user_id: 'u-1', expires_at: '2030-01-01T00:00:00.000Z', is_admin: 0, is_kassier: 0, is_vorstand: 0 },
  's-v': { id: 's-v', user_id: 'u-v', expires_at: '2030-01-01T00:00:00.000Z', is_admin: 0, is_kassier: 0, is_vorstand: 1 },
  's-v2': { id: 's-v2', user_id: 'u-v2', expires_at: '2030-01-01T00:00:00.000Z', is_admin: 0, is_kassier: 0, is_vorstand: 1 },
  's-b': { id: 's-b', user_id: 'u-b', expires_at: '2030-01-01T00:00:00.000Z', is_admin: 0, is_kassier: 0, is_vorstand: 0 },
};

function makeState() {
  return {
    users: [
      { id: 'u-1', email: 'm@x.at', name: 'Max', is_vorstand: 0, banned_until: null },
      { id: 'u-v', email: 'v1@x.at', name: 'Vera', is_vorstand: 1, banned_until: null },
      { id: 'u-v2', email: 'v2@x.at', name: 'Viktor', is_vorstand: 1, banned_until: null },
      { id: 'u-b', email: 'b@x.at', name: 'Ben', is_vorstand: 0, banned_until: '2026-10-24T12:00:00.000Z' },
    ],
    projects: [
      { id: 'p-future', title: 'Weitwurf', start_at: FUTURE_START, end_at: '2026-10-20T22:00:00.000Z' },
      { id: 'p-late', title: 'Nachtdreh', start_at: LATE_START, end_at: '2026-10-12T22:00:00.000Z' },
    ],
    memberships: [
      { project_id: 'p-future', user_id: 'u-1' },
      { project_id: 'p-late', user_id: 'u-1' },
    ],
    absences: [],
    seq: 0,
  };
}

function fakeDb(state) {
  const first = async (sql, args) => {
    if (sql.includes('FROM sessions')) return SESSIONS[args[0]] ?? null;
    if (sql.includes('FROM projects') && sql.includes('id = ?')) {
      return state.projects.find((p) => p.id === args[0]) ?? null;
    }
    if (sql.includes('FROM memberships') && sql.includes('project_id = ? AND user_id = ?')) {
      return state.memberships.find((m) => m.project_id === args[0] && m.user_id === args[1]) ?? null;
    }
    if (sql.includes('FROM users') && sql.includes('id = ?')) {
      return state.users.find((u) => u.id === args[0]) ?? null;
    }
    if (sql.includes('FROM absence_requests') && sql.includes('id = ?')) {
      return state.absences.find((a) => a.id === args[0]) ?? null;
    }
    return null;
  };
  const all = async (sql, args) => {
    if (sql.includes('FROM users') && sql.includes('is_vorstand = 1')) {
      return { results: state.users.filter((u) => u.is_vorstand === 1) };
    }
    if (sql.includes('FROM absence_requests')) {
      return { results: [...state.absences] };
    }
    if (sql.includes('FROM projects') && sql.includes('start_at > ?')) return { results: [] };
    if (sql.includes('JOIN users')) return { results: [] };
    return { results: [] };
  };
  const run = async (sql, args) => {
    if (sql.startsWith('INSERT INTO memberships')) {
      state.memberships.push({ project_id: args[0], user_id: args[1] });
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('DELETE FROM memberships')) {
      const n = state.memberships.length;
      state.memberships = state.memberships.filter(
        (m) => !(m.project_id === args[0] && m.user_id === args[1]),
      );
      return { meta: { changes: n - state.memberships.length } };
    }
    if (sql.startsWith('INSERT INTO absence_requests')) {
      state.absences.push({
        id: args[0], project_id: args[1], user_id: args[2], reason: args[3],
        status: 'pending', decision_note: '', decided_by: null,
        created_at: args[4], decided_at: null,
      });
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('UPDATE absence_requests')) {
      const row = state.absences.find((a) => a.id === args[4]);
      if (!row || row.status !== 'pending') return { meta: { changes: 0 } };
      row.status = args[0];
      row.decision_note = args[1];
      row.decided_by = args[2];
      row.decided_at = args[3];
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('UPDATE users SET banned_until')) {
      const u = state.users.find((x) => x.id === args[1]);
      if (u) u.banned_until = args[0];
      return { meta: { changes: u ? 1 : 0 } };
    }
    if (sql.startsWith('INSERT INTO reminder_log')) return { meta: { changes: 1 } };
    return {};
  };
  return {
    prepare: (sql) => {
      const bound = (...args) => ({
        first: () => first(sql, args),
        all: () => all(sql, args),
        run: () => run(sql, args),
      });
      return { bind: (...args) => bound(...args), ...bound([]) };
    },
    batch: async (stmts) => {
      const out = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    },
  };
}

const ENV = { RESEND_API_KEY: 're_test' };

async function requestWith(state, path, session, method = 'GET', body) {
  const headers = { Cookie: `app-session=${session}` };
  const init = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  return app.request(path, init, { DB: fakeDb(state), ...ENV });
}

describe('absence workflow (Abmelden mit Frist)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
  });

  it('blocks banned members from joining with a German 403', async () => {
    const state = makeState();
    const res = await requestWith(state, '/api/projects/p-future/join', 's-b', 'POST', {});
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/gesperrt/i);
  });

  it('lets non-banned members join', async () => {
    const state = makeState();
    state.memberships = state.memberships.filter((m) => m.project_id !== 'p-future');
    const res = await requestWith(state, '/api/projects/p-future/join', 's-m', 'POST', {});
    expect(res.status).toBe(201);
  });

  it('leaves within the Frist without a reason and files no request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    try {
      const state = makeState();
      const res = await requestWith(state, '/api/projects/p-future/join', 's-m', 'DELETE');
      expect(res.status).toBe(200);
      expect(state.memberships.some((m) => m.project_id === 'p-future')).toBe(false);
      expect(state.absences).toHaveLength(0);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects late leaves without a reason in German', async () => {
    const state = makeState();
    const res = await requestWith(state, '/api/projects/p-late/join', 's-m', 'DELETE', {});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Grund/i);
    expect(state.memberships.some((m) => m.project_id === 'p-late')).toBe(true);
  });

  it('late leave with reason frees the spot, files a request and mails the Vorstand in German', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'mail-1' }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const state = makeState();
      const res = await requestWith(state, '/api/projects/p-late/join', 's-m', 'DELETE', { reason: 'Bin krank.' });
      expect(res.status).toBe(200);
      expect(state.memberships.some((m) => m.project_id === 'p-late')).toBe(false);
      expect(state.absences).toHaveLength(1);
      expect(state.absences[0]).toMatchObject({ project_id: 'p-late', user_id: 'u-1', reason: 'Bin krank.', status: 'pending' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const bodies = fetchMock.mock.calls.map(([, opts]) => JSON.parse(opts.body));
      expect(bodies.map((b) => b.to).sort()).toEqual(['v1@x.at', 'v2@x.at']);
      expect(bodies[0].subject).toMatch(/Nachtdreh/);
      expect(bodies[0].text).toContain('Bin krank.');
      expect(bodies[0].text).toContain(`/projects/?absence=${state.absences[0].id}`);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('non-Vorstand members cannot list or decide absence requests', async () => {
    const state = makeState();
    const list = await requestWith(state, '/api/absences', 's-m');
    expect(list.status).toBe(403);
    const decide = await requestWith(state, '/api/absences/a-1/decision', 's-m', 'POST', { approved: true });
    expect(decide.status).toBe(403);
  });

  it('Vorstand lists pending requests and approves without touching other bans', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'mail-1' }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const state = makeState();
      // requester u-b already banned from another case
      state.absences.push({
        id: 'a-1', project_id: 'p-late', user_id: 'u-b', reason: 'Notfall.',
        status: 'pending', decision_note: '', decided_by: null,
        created_at: '2026-10-10T12:00:00.000Z', decided_at: null,
      });
      const list = await requestWith(state, '/api/absences', 's-v');
      expect(list.status).toBe(200);
      expect((await list.json()).data.absences.map((a) => a.id)).toContain('a-1');
      const res = await requestWith(state, '/api/absences/a-1/decision', 's-v', 'POST', { approved: true });
      expect(res.status).toBe(200);
      expect(state.absences[0].status).toBe('approved');
      // other ban untouched
      expect(state.users.find((u) => u.id === 'u-b').banned_until).toBe('2026-10-24T12:00:00.000Z');
      const bodies = fetchMock.mock.calls.map(([, opts]) => JSON.parse(opts.body));
      expect(bodies.map((b) => b.to)).toEqual(['b@x.at']);
      expect(bodies[0].subject).toMatch(/genehmigt/i);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejection requires a note, bans for 14 days and mails note plus end date', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'mail-1' }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const state = makeState();
      state.absences.push({
        id: 'a-1', project_id: 'p-late', user_id: 'u-1', reason: 'Keine Lust.',
        status: 'pending', decision_note: '', decided_by: null,
        created_at: '2026-10-10T12:00:00.000Z', decided_at: null,
      });
      const noNote = await requestWith(state, '/api/absences/a-1/decision', 's-v', 'POST', { approved: false });
      expect(noNote.status).toBe(400);
      const res = await requestWith(state, '/api/absences/a-1/decision', 's-v', 'POST', { approved: false, note: 'Das reicht nicht.' });
      expect(res.status).toBe(200);
      expect(state.users.find((u) => u.id === 'u-1').banned_until).toBe('2026-10-24T12:00:00.000Z');
      const bodies = fetchMock.mock.calls.map(([, opts]) => JSON.parse(opts.body));
      expect(bodies[0].to).toBe('m@x.at');
      expect(bodies[0].subject).toMatch(/abgelehnt/i);
      expect(bodies[0].text).toContain('Das reicht nicht.');
      expect(bodies[0].text).toContain('24.10.2026');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('only the first of two simultaneous decisions succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'm' }) }));
    try {
      const state = makeState();
      state.absences.push({
        id: 'a-1', project_id: 'p-late', user_id: 'u-1', reason: 'Krank.',
        status: 'pending', decision_note: '', decided_by: null,
        created_at: '2026-10-10T12:00:00.000Z', decided_at: null,
      });
      const first = await requestWith(state, '/api/absences/a-1/decision', 's-v', 'POST', { approved: true });
      expect(first.status).toBe(200);
      const second = await requestWith(state, '/api/absences/a-1/decision', 's-v2', 'POST', { approved: false, note: 'Zu spät.' });
      expect(second.status).toBe(409);
      expect((await second.json()).error).toMatch(/bereits entschieden/i);
      expect(state.absences[0].status).toBe('approved');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('a Vorstand member cannot decide their own request', async () => {
    const state = makeState();
    state.absences.push({
      id: 'a-1', project_id: 'p-late', user_id: 'u-v', reason: 'Dienstreise.',
      status: 'pending', decision_note: '', decided_by: null,
      created_at: '2026-10-10T12:00:00.000Z', decided_at: null,
    });
    const res = await requestWith(state, '/api/absences/a-1/decision', 's-v', 'POST', { approved: true });
    expect(res.status).toBe(403);
  });
});
