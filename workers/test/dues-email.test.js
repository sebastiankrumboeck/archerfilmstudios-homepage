import { describe, expect, it, vi } from 'vitest';
import app, { sendInvoiceEmail } from '../src/index.js';

const INV = { id: 'i-1', user_id: 'u-2', year: 2026, amount_cents: 1200, reason: 'Mitgliedsbeitrag 2026', status: 'open', created_at: '2026-01-01T00:00:00Z', paid_at: null, paid_method: null };
const KASSIER_SESSION = { id: 's-k', user_id: 'u-kas', expires_at: '2030-01-01T00:00:00Z', is_admin: 0, is_kassier: 1 };
const kas = { Cookie: 'app-session=s-k' };
const ENV = { RESEND_API_KEY: 're_test', ARCHER_IBAN: 'AT00 1234 5678 9012 3456' };

function fakeDb({ session = KASSIER_SESSION, invoiceRow = INV, userRow = null } = {}) {
  return {
    prepare: (sql) => ({
      bind: () => ({
        first: async () => {
          if (sql.includes('FROM sessions')) return session;
          if (sql.includes('FROM invoices')) return invoiceRow;
          if (sql.includes('FROM users')) return userRow;
          return null;
        },
        all: async () => ({ results: [] }),
        run: async () => ({}),
      }),
    }),
  };
}

describe('sendInvoiceEmail', () => {
  it('without API key reports not configured and sends nothing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await sendInvoiceEmail({}, { to: 'a@b.c', invoice: INV, memberName: 'M' });
      expect(res).toEqual({ ok: false, error: 'Email not configured.' });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('calls Resend with auth, recipient and subject', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'mail-1' }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await sendInvoiceEmail(ENV, { to: 'a@b.c', invoice: INV, memberName: 'Max Muster' });
      expect(res.ok).toBe(true);
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.resend.com/emails');
      expect(opts.headers.Authorization).toBe('Bearer re_test');
      const body = JSON.parse(opts.body);
      expect(body.to).toBe('a@b.c');
      expect(body.subject).toBe('Mitgliedsbeitrag 2026 – Archer FilmStudios');
      expect(body.text).toContain('Hallo Max Muster,');
      expect(body.text).toContain('Beitragsvorschreibung für den Mitgliedsbeitrag 2026');
      expect(body.text).toContain('Mitgliedsbeitrag: 12,00 €');
      expect(body.text).toContain('Beitragsjahr: 2026');
      expect(body.text).toContain('Kontoinhaber: Archer FilmStudios');
      expect(body.text).toContain('IBAN: AT00 1234 5678 9012 3456');
      expect(body.text).toContain('Verwendungszweck: 2026-u-2');
      expect(body.text).toContain('Vielen Dank für deine Mitgliedschaft!');
      expect(body.text).not.toContain('REPLACE_WITH_');
      expect(body.text).not.toContain('2026 2026');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('custom-reason invoices keep their reason instead of the dues template', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'mail-1' }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const custom = { ...INV, reason: 'Workshopgebühr' };
      const res = await sendInvoiceEmail(ENV, { to: 'a@b.c', invoice: custom, memberName: 'M' });
      expect(res.ok).toBe(true);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.subject).toBe('Workshopgebühr – Archer FilmStudios');
      expect(body.text).not.toContain('2026 2026');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('missing IBAN reports bank details not configured and sends nothing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await sendInvoiceEmail({ RESEND_API_KEY: 're_test' }, { to: 'a@b.c', invoice: INV, memberName: 'M' });
      expect(res).toEqual({ ok: false, error: 'Bank details not configured.' });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('Resend error is reported, not thrown', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ message: 'boom' }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await sendInvoiceEmail(ENV, { to: 'a@b.c', invoice: INV, memberName: 'M' });
      expect(res.ok).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('invoice email endpoints', () => {
  it('POST /api/invoices/:id/send unknown invoice gives 404', async () => {
    const res = await app.request('/api/invoices/nope/send', {
      method: 'POST', headers: kas,
    }, { DB: fakeDb({ invoiceRow: null }), ...ENV });
    expect(res.status).toBe(404);
  });

  it('POST /api/invoices/:id/send without key gives 503 but keeps invoice', async () => {
    const res = await app.request('/api/invoices/i-1/send', {
      method: 'POST', headers: kas,
    }, { DB: fakeDb({ invoiceRow: INV, userRow: { id: 'u-2', email: 'm@x.at', name: 'M' } }) });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('Email not configured.');
  });

  it('POST /api/invoices/:id/send without IBAN gives 503', async () => {
    const res = await app.request('/api/invoices/i-1/send', {
      method: 'POST', headers: kas,
    }, { DB: fakeDb({ invoiceRow: INV, userRow: { id: 'u-2', email: 'm@x.at', name: 'M' } }), RESEND_API_KEY: 're_test' });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('Bank details not configured.');
  });

  it('POST /api/invoices/:id/send delivers to the member email', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'mail-1' }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await app.request('/api/invoices/i-1/send', {
        method: 'POST', headers: kas,
      }, { DB: fakeDb({ invoiceRow: INV, userRow: { id: 'u-2', email: 'm@x.at', name: 'M' } }), ...ENV });
      expect(res.status).toBe(200);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).to).toBe('m@x.at');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
