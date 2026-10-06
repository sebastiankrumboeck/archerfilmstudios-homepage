import { describe, expect, it } from 'vitest';
import app from '../src/index.js';

const KASSIER_SESSION = { id: 's-k', user_id: 'u-kas', expires_at: '2030-01-01T00:00:00Z', is_admin: 0, is_kassier: 1 };
const MEMBER_SESSION = { id: 's-m', user_id: 'u-1', expires_at: '2030-01-01T00:00:00Z', is_admin: 0, is_kassier: 0 };
const kas = { Cookie: 'app-session=s-k' };
const mem = { Cookie: 'app-session=s-m' };

const OPEN = { id: 'i-1', user_id: 'u-2', user_name: 'Mara', user_email: 'm@x.at', year: 2026, amount_cents: 1200, reason: 'Mitgliedsbeitrag 2026', status: 'open', created_at: '2026-01-05T00:00:00Z', paid_at: null, paid_method: null };
const PAID = { id: 'i-2', user_id: 'u-3', user_name: 'Leo', user_email: 'l@x.at', year: 2026, amount_cents: 1250, reason: 'Workshop; "Spezial"', status: 'paid', created_at: '2026-02-01T00:00:00Z', paid_at: '2026-02-03T00:00:00Z', paid_method: 'cash' };

function fakeDb({ session = KASSIER_SESSION, invoices = [OPEN, PAID], seen = null } = {}) {
  return {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => (sql.includes('FROM sessions') ? session : null),
        all: async () => {
          if (sql.includes('FROM invoices')) {
            if (seen) seen.sql = sql, seen.args = args;
            return { results: invoices };
          }
          return { results: [] };
        },
        run: async () => ({}),
      }),
    }),
  };
}

const HEADER = 'ID;Mitglied;E-Mail;Jahr;Grund;Betrag €;Status;Beleg;Referenz;Erstellt;Bezahlt am';

describe('invoice CSV export', () => {
  it('exports header plus open and paid rows with German formatting', async () => {
    const res = await app.request('/api/invoices/export?year=2026', { headers: kas }, { DB: fakeDb() });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('rechnungen-2026.csv');
    const lines = (await res.text()).split('\r\n');
    expect(lines[0]).toBe(HEADER);
    expect(lines[1]).toBe('i-1;Mara;m@x.at;2026;Mitgliedsbeitrag 2026;12,00;Offen;;2026-u-2;2026-01-05T00:00:00Z;');
    expect(lines[2]).toBe('i-2;Leo;l@x.at;2026;"Workshop; ""Spezial""";12,50;Bezahlt;Bar;2026-u-3;2026-02-01T00:00:00Z;2026-02-03T00:00:00Z');
  });

  it('passes combined filters into the query', async () => {
    const seen = {};
    const res = await app.request('/api/invoices/export?status=paid&year=2026&method=cash', { headers: kas }, { DB: fakeDb({ seen }) });
    expect(res.status).toBe(200);
    expect(seen.sql).toContain('i.status = ?');
    expect(seen.sql).toContain('i.year = ?');
    expect(seen.sql).toContain('i.paid_method = ?');
    expect(seen.args).toEqual(['paid', 2026, 'cash']);
  });

  it('rejects invalid method with 400 and non-kassier with 403', async () => {
    const bad = await app.request('/api/invoices/export?method=bitcoin', { headers: kas }, { DB: fakeDb() });
    expect(bad.status).toBe(400);
    const denied = await app.request('/api/invoices/export', { headers: mem }, { DB: fakeDb({ session: MEMBER_SESSION }) });
    expect(denied.status).toBe(403);
  });
});
