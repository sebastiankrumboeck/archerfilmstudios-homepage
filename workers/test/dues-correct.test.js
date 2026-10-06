import { describe, expect, it, vi } from 'vitest';
import app from '../src/index.js';

const KASSIER_SESSION = { id: 's-k', user_id: 'u-kas', expires_at: '2030-01-01T00:00:00Z', is_admin: 0, is_kassier: 1 };
const kas = { Cookie: 'app-session=s-k' };
const json = { 'Content-Type': 'application/json' };

const OPEN = { id: 'inv-1', user_id: 'u-2', year: 2026, amount_cents: 1200, reason: 'Mitgliedsbeitrag 2026', status: 'open', created_by: 'u-kas', created_at: '2026-01-05T00:00:00Z', paid_at: null, paid_method: null, marked_by: null, credit_of: null, corrected_by: null };
const MEMBER_USER = { id: 'u-2', email: 'm@x.at', name: 'Mara' };

function statefulDb({ invoices = [OPEN], runLog = null } = {}) {
  const store = { invoices: invoices.map((r) => ({ ...r })) };
  return {
    store,
    db: {
      prepare: (sql) => ({
        bind: (...args) => ({
          first: async () => {
            if (sql.includes('FROM sessions')) return KASSIER_SESSION;
            if (sql.includes('FROM invoices') && sql.includes('id = ?')) {
              return store.invoices.find((r) => r.id === args[0]) ?? null;
            }
            if (sql.includes('FROM users')) return MEMBER_USER;
            return null;
          },
          all: async () => ({ results: [] }),
          run: async () => {
            runLog?.(sql, args);
            if (sql.startsWith('INSERT INTO invoices')) {
              const [id, user_id, year, amount_cents, reason, status, created_by, created_at] = args;
              store.invoices.push({ id, user_id, year, amount_cents, reason, status, created_by, created_at, paid_at: null, paid_method: null, marked_by: null, credit_of: null, corrected_by: null });
            }
            if (sql.startsWith('UPDATE invoices SET status')) {
              const row = store.invoices.find((r) => r.id === args[1]);
              if (row) row.status = args[0];
            }
            if (sql.startsWith('UPDATE invoices SET corrected_by')) {
              const row = store.invoices.find((r) => r.id === args[1]);
              if (row) row.corrected_by = args[0];
            }
            if (sql.startsWith('UPDATE invoices SET credit_of')) {
              const row = store.invoices.find((r) => r.id === args[1]);
              if (row) row.credit_of = args[0];
            }
            return {};
          },
        }),
      }),
    },
  };
}

const ENV = { RESEND_API_KEY: 're_test', ARCHER_IBAN: 'AT00 1234' };

describe('invoice corrections', () => {
  it('corrects an open invoice with a linked replacement and mails it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'mail-1' }) });
    vi.stubGlobal('fetch', fetchMock);
    const { store, db } = statefulDb();
    try {
      const res = await app.request('/api/invoices/inv-1/correct', {
        method: 'POST', headers: { ...kas, ...json }, body: JSON.stringify({ amount_cents: 1000, reason: 'Korrigiert' }),
      }, { DB: db, ...ENV });
      expect(res.status).toBe(201);
      const { invoice, email } = (await res.json()).data;
      expect(invoice.amount_cents).toBe(1000);
      expect(invoice.reason).toBe('Korrigiert');
      expect(invoice.status).toBe('open');
      expect(invoice.credit_of).toBe('inv-1');
      expect(email.sent).toBe(true);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).to).toBe('m@x.at');
      const original = store.invoices.find((r) => r.id === 'inv-1');
      expect(original.status).toBe('cancelled');
      expect(original.corrected_by).toBe(invoice.id);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('defaults to the original amount and reason', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'mail-1' }) }));
    const { db } = statefulDb();
    try {
      const res = await app.request('/api/invoices/inv-1/correct', {
        method: 'POST', headers: { ...kas, ...json }, body: JSON.stringify({}),
      }, { DB: db, ...ENV });
      expect(res.status).toBe(201);
      const { invoice } = (await res.json()).data;
      expect(invoice.amount_cents).toBe(1200);
      expect(invoice.reason).toBe('Mitgliedsbeitrag 2026');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('paid and cancelled invoices give 409, unknown gives 404, bad amount gives 400', async () => {
    const paid = await app.request('/api/invoices/inv-9/correct', {
      method: 'POST', headers: { ...kas, ...json }, body: JSON.stringify({}),
    }, { DB: statefulDb({ invoices: [{ ...OPEN, id: 'inv-9', status: 'paid' }] }).db, ...ENV });
    expect(paid.status).toBe(409);
    const cancelled = await app.request('/api/invoices/inv-1/correct', {
      method: 'POST', headers: { ...kas, ...json }, body: JSON.stringify({}),
    }, { DB: statefulDb({ invoices: [{ ...OPEN, status: 'cancelled' }] }).db, ...ENV });
    expect(cancelled.status).toBe(409);
    const missing = await app.request('/api/invoices/nope/correct', {
      method: 'POST', headers: { ...kas, ...json }, body: JSON.stringify({}),
    }, { DB: statefulDb({ invoices: [] }).db, ...ENV });
    expect(missing.status).toBe(404);
    const bad = await app.request('/api/invoices/inv-1/correct', {
      method: 'POST', headers: { ...kas, ...json }, body: JSON.stringify({ amount_cents: 0 }),
    }, { DB: statefulDb().db, ...ENV });
    expect(bad.status).toBe(400);
  });

  it('mail failure still creates the linked pair', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    const { store, db } = statefulDb();
    try {
      const res = await app.request('/api/invoices/inv-1/correct', {
        method: 'POST', headers: { ...kas, ...json }, body: JSON.stringify({}),
      }, { DB: db, ...ENV });
      expect(res.status).toBe(201);
      expect((await res.json()).data.email.sent).toBe(false);
      expect(store.invoices.find((r) => r.id === 'inv-1').status).toBe('cancelled');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
