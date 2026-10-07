import { describe, expect, it } from 'vitest';
import app from '../src/index.js';

const ADMIN = { id: 's-a', user_id: 'u-admin', expires_at: '2030-01-01T00:00:00Z', is_admin: 1, is_kassier: 0 };
const MEMBER_SESSION = { id: 's-m', user_id: 'u-1', expires_at: '2030-01-01T00:00:00Z', is_admin: 0, is_kassier: 0 };
const adm = { Cookie: 'app-session=s-a' };
const mem = { Cookie: 'app-session=s-m' };

const DAY = 86400000;
const YEAR_NOW = new Date().getUTCFullYear();
const isoDaysAgo = (n) => new Date(Date.now() - n * DAY).toISOString();

const USERS = [
  { id: 'u-1', name: 'Anna', created_at: isoDaysAgo(400) },
  { id: 'u-2', name: 'Ben', created_at: `${YEAR_NOW}-01-15T00:00:00Z` },
  { id: 'u-3', name: 'Cid', created_at: isoDaysAgo(800) },
];
const OLD_START = isoDaysAgo(400);
const PROJECTS = [
  { id: 'p1', title: 'Frühjahr', start_at: `${YEAR_NOW}-02-01T18:00:00Z`, end_at: `${YEAR_NOW}-02-01T22:00:00Z` },
  { id: 'p2', title: 'Sommer', start_at: `${YEAR_NOW}-03-01T18:00:00Z`, end_at: `${YEAR_NOW}-03-01T22:00:00Z` },
  { id: 'p0', title: 'Alt', start_at: OLD_START, end_at: OLD_START },
];
const MEMBERSHIPS = [
  { project_id: 'p1', user_id: 'u-1' },
  { project_id: 'p2', user_id: 'u-1' },
  { project_id: 'p2', user_id: 'u-admin' },
  { project_id: 'p0', user_id: 'u-3' },
];

function fakeDb({ session = ADMIN, users = USERS, projects = PROJECTS, memberships = MEMBERSHIPS } = {}) {
  return {
    prepare: (sql) => ({
      bind: (..._args) => ({
        first: async () => (sql.includes('FROM sessions') ? session : null),
        all: async () => {
          if (sql.includes('FROM users')) return { results: users };
          if (sql.includes('FROM projects')) return { results: projects };
          if (sql.includes('FROM memberships')) return { results: memberships };
          return { results: [] };
        },
        run: async () => ({}),
      }),
      all: async () => {
        if (sql.includes('FROM users')) return { results: users };
        if (sql.includes('FROM projects')) return { results: projects };
        if (sql.includes('FROM memberships')) return { results: memberships };
        return { results: [] };
      },
    }),
  };
}

describe('member stats', () => {
  it('aggregates totals, yearly joins and activity', async () => {
    const res = await app.request('/api/stats', { headers: adm }, { DB: fakeDb() });
    expect(res.status).toBe(200);
    const { stats } = (await res.json()).data;
    expect(stats.total_members).toBe(3);
    expect(stats.new_this_year).toBe(1);
    expect(stats.projects_this_year).toBe(2);
    expect(stats.participations_this_year).toBe(3);
    const yearNow = new Date().getUTCFullYear();
    expect(stats.joins_by_year.find((r) => r.year === yearNow).count).toBe(1);
    expect(stats.inactive.map((r) => r.id)).toEqual(['u-2', 'u-3']);
    expect(stats.inactive.find((r) => r.id === 'u-2').last_active).toBe('nie');
    expect(stats.inactive.find((r) => r.id === 'u-3').last_active).toBe(OLD_START.slice(0, 10));
  });

  it('window boundary: 365 days ago is active, 366 is not', async () => {
    const users = [
      { id: 'u-4', name: 'Dan', created_at: isoDaysAgo(800) },
      { id: 'u-5', name: 'Eli', created_at: isoDaysAgo(800) },
    ];
    const projects = [
      { id: 'p365', title: 'Grenze', start_at: isoDaysAgo(365), end_at: isoDaysAgo(365) },
      { id: 'p366', title: 'Draussen', start_at: isoDaysAgo(366), end_at: isoDaysAgo(366) },
    ];
    const memberships = [
      { project_id: 'p365', user_id: 'u-4' },
      { project_id: 'p366', user_id: 'u-5' },
    ];
    const res = await app.request('/api/stats', { headers: adm }, { DB: fakeDb({ users, projects, memberships }) });
    expect(res.status).toBe(200);
    expect((await res.json()).data.stats.inactive.map((r) => r.id)).toEqual(['u-5']);
  });

  it('empty database returns zeros', async () => {
    const res = await app.request('/api/stats', { headers: adm }, { DB: fakeDb({ users: [], projects: [], memberships: [] }) });
    expect(res.status).toBe(200);
    const { stats } = (await res.json()).data;
    expect(stats.total_members).toBe(0);
    expect(stats.joins_by_year).toEqual([]);
    expect(stats.inactive).toEqual([]);
  });

  it('non-admin gets 403', async () => {
    const res = await app.request('/api/stats', { headers: mem }, { DB: fakeDb({ session: MEMBER_SESSION }) });
    expect(res.status).toBe(403);
  });
});
