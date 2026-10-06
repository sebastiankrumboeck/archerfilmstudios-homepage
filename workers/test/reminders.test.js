import { describe, expect, it, vi } from 'vitest';
import app, { sendShootReminders } from '../src/index.js';

const NOW = '2026-10-06T12:00:00.000Z';
const SOON_START = '2026-10-07T18:00:00.000Z';
const LATER_START = '2026-10-20T18:00:00.000Z';
const ADMIN = { id: 's-a', user_id: 'u-admin', expires_at: '2030-01-01T00:00:00Z', is_admin: 1, is_kassier: 0 };
const MEMBER_SESSION = { id: 's-m', user_id: 'u-1', expires_at: '2030-01-01T00:00:00Z', is_admin: 0, is_kassier: 0 };

const SOON = { id: 'p-soon', title: 'Night shoot', location: 'St. Pölten', start_at: SOON_START, end_at: '2026-10-07T22:00:00.000Z' };
const LATER = { id: 'p-later', title: 'Far trip', location: 'Wien', start_at: LATER_START, end_at: '2026-10-20T22:00:00.000Z' };
const JOINED = [
  { email: 'a@x.at', name: 'Anna' },
  { email: 'b@x.at', name: 'Ben' },
];

function fakeDb({ projects = [SOON], logged = [], members = JOINED, runLog = null } = {}) {
  return {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          if (sql.includes('FROM sessions')) return sql.includes('u-admin') || args[0] === 's-a' ? ADMIN : MEMBER_SESSION;
          if (sql.includes('FROM reminder_log')) {
            return logged.some(([pid, start]) => pid === args[0] && start === args[1]) ? { project_id: args[0] } : null;
          }
          if (sql.includes('FROM projects') && sql.includes('id = ?')) {
            return projects.find((p) => p.id === args[0]) ?? null;
          }
          return null;
        },
        all: async () => {
          if (sql.includes('FROM projects') && sql.includes('start_at > ?')) {
            return { results: projects.filter((p) => p.start_at > args[0] && p.start_at <= args[1]) };
          }
          if (sql.includes('JOIN users')) return { results: members };
          return { results: [] };
        },
        run: async () => {
          runLog?.(sql, args);
          return {};
        },
      }),
    }),
  };
}

const ENV = { RESEND_API_KEY: 're_test' };
const envWith = (cfg, runLog) => ({ DB: fakeDb({ ...cfg, runLog }), ...ENV });

describe('shoot reminders', () => {
  it('reminds joined members of shoots starting within 48h', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'mail-1' }) });
    vi.stubGlobal('fetch', fetchMock);
    const ran = [];
    try {
      const res = await sendShootReminders(envWith({}, (sql, args) => ran.push([sql, args])), NOW);
      expect(res).toEqual({ projects: 1, emails: 2, failed: 0 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const bodies = fetchMock.mock.calls.map(([, opts]) => JSON.parse(opts.body));
      expect(bodies[0].to).toBe('a@x.at');
      expect(bodies[0].subject).toBe('Erinnerung: Night shoot – Archer FilmStudios');
      expect(bodies[0].text).toContain('Hallo Anna,');
      expect(bodies[0].text).toContain('Night shoot');
      expect(ran.some(([sql]) => sql.startsWith('INSERT INTO reminder_log'))).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('skips shoots outside the window and already-logged shoots', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await sendShootReminders(
        envWith({ projects: [LATER, SOON], logged: [['p-soon', SOON_START]] }),
        NOW,
      );
      expect(res).toEqual({ projects: 0, emails: 0, failed: 0 });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('a member joining after the run gets no mail on rerun', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'mail-1' }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const env = envWith({ logged: [['p-soon', SOON_START]], members: [...JOINED, { email: 'c@x.at', name: 'Cid' }] });
      const res = await sendShootReminders(env, NOW);
      expect(res.emails).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('an edited start time counts as a new shoot', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'mail-1' }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const moved = { ...SOON, start_at: '2026-10-08T10:00:00.000Z' };
      const res = await sendShootReminders(
        envWith({ projects: [moved], logged: [['p-soon', SOON_START]] }),
        NOW,
      );
      expect(res.emails).toBe(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('one failing recipient does not abort the run', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue({ ok: true, json: async () => ({ id: 'mail-1' }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await sendShootReminders(envWith({}), NOW);
      expect(res).toEqual({ projects: 1, emails: 1, failed: 1 });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('manual remind endpoint is admin-only and writes the log', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'mail-1' }) });
    vi.stubGlobal('fetch', fetchMock);
    const ran = [];
    try {
      const denied = await app.request('/api/projects/p-soon/remind', {
        method: 'POST', headers: { Cookie: 'app-session=s-m' },
      }, envWith({}, (sql, args) => ran.push([sql, args])));
      expect(denied.status).toBe(403);
      const okRes = await app.request('/api/projects/p-soon/remind', {
        method: 'POST', headers: { Cookie: 'app-session=s-a' },
      }, envWith({}, (sql, args) => ran.push([sql, args])));
      expect(okRes.status).toBe(200);
      expect((await okRes.json()).data.emails).toBe(2);
      expect(ran.some(([sql]) => sql.startsWith('INSERT INTO reminder_log'))).toBe(true);
      const missing = await app.request('/api/projects/nope/remind', {
        method: 'POST', headers: { Cookie: 'app-session=s-a' },
      }, envWith({ projects: [] }));
      expect(missing.status).toBe(404);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('app exposes a scheduled handler', () => {
    expect(typeof app.scheduled).toBe('function');
  });
});
