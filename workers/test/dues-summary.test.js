import { describe, expect, it } from 'vitest';
import app from '../src/index.js';

const KASSIER_SESSION = { id: 's-k', user_id: 'u-kas', expires_at: '2030-01-01T00:00:00Z', is_admin: 0, is_kassier: 1 };
const MEMBER_SESSION = { id: 's-m', user_id: 'u-1', expires_at: '2030-01-01T00:00:00Z', is_admin: 0, is_kassier: 0 };
const kas = { Cookie: 'app-session=s-k' };
const mem = { Cookie: 'app-session=s-m' };

const OPEN = { id: 'i-1', user_id: 'u-2', year: 2026, amount_cents: 1200, reason: 'Mitgliedsbeitrag 2026', status: 'open' };
const OPEN2 = { id: 'i-2', user_id: 'u-3', year: 2026, amount_cents: 800, reason: 'Workshop', status: 'open' };
const CASH = { id: 'i-3', user_id: 'u-2', year: 2026, amount_cents: 1200, reason: 'Mitgliedsbeitrag 2026', status: 'paid', paid_method: 'cash' };
const TRANSFER = { id: 'i-4', user_id: 'u-4', year: 2026, amount_cents: 1200, reason: 'Mitgliedsbeitrag 2026', status: 'paid', paid_method: 'transfer' };
const CANCELLED = { id: 'i-5', user_id: 'u-5', year: 2026, amount_cents: 5000, reason: 'Fehler', status: 'cancelled' };

function fakeDb({ session = KASSIER_SESSION, invoices = [OPEN, OPEN2, CASH, TRANSFER, CANCELLED] } = {}) {
  const open = invoices.filter((r) => r.status === 'open');
  const paid = invoices.filter((r) => r.status === 'paid');
  const cancelled = invoices.filter((r) => r.status === 'cancelled');
  return {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          if (sql.includes('FROM sessions')) return session;
          if (sql.includes("status = 'open'")) {
            const rows = args.length ? open.filter((r) => r.year === args[0]) : open;
            return { n: rows.length, sum: rows.reduce((n, r) => n + r.amount_cents, 0) };
          }
          if (sql.includes("status = 'paid'")) {
            const rows = args.length ? paid.filter((r) => r.year === args[0]) : paid;
            return {
              n: rows.length,
              sum: rows.reduce((n, r) => n + r.amount_cents, 0),
              cash: rows.filter((r) => r.paid_method === 'cash').reduce((n, r) => n + r.amount_cents, 0),
              transfer: rows.filter((r) => r.paid_method === 'transfer').reduce((n, r) => n + r.amount_cents, 0),
            };
          }
          if (sql.includes("status = 'cancelled'")) {
            const rows = args.length ? cancelled.filter((r) => r.year === args[0]) : cancelled;
            return { n: rows.length };
          }
          return null;
        },
        all: async () => ({ results: [] }),
        run: async () => ({}),
      }),
    }),
  };
}

describe('invoice summary', () => {
  it('aggregates open, paid, cash, transfer and counts for a year', async () => {
    const res = await app.request('/api/invoices/summary?year=2026', { headers: kas }, { DB: fakeDb() });
    expect(res.status).toBe(200);
    expect((await res.json()).data.summary).toEqual({
      year: 2026,
      invoiced_cents: 4400,
      paid_cents: 2400,
      open_cents: 2000,
      paid_cash_cents: 1200,
      paid_transfer_cents: 1200,
      count_open: 2,
      count_paid: 2,
      count_cancelled: 1,
    });
  });

  it('defaults to the current year and reports zeros when empty', async () => {
    const res = await app.request('/api/invoices/summary', { headers: kas }, { DB: fakeDb({ invoices: [] }) });
    expect(res.status).toBe(200);
    const { summary } = (await res.json()).data;
    expect(summary.year).toBe(new Date().getFullYear());
    expect(summary.invoiced_cents).toBe(0);
    expect(summary.count_open).toBe(0);
  });

  it('rejects invalid years with 400 and non-kassier with 403', async () => {
    const bad = await app.request('/api/invoices/summary?year=abc', { headers: kas }, { DB: fakeDb() });
    expect(bad.status).toBe(400);
    const denied = await app.request('/api/invoices/summary?year=2026', { headers: mem }, { DB: fakeDb({ session: MEMBER_SESSION }) });
    expect(denied.status).toBe(403);
  });
});
