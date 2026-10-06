import { describe, expect, it, vi } from 'vitest';
import app from '../src/index.js';

const json = { 'Content-Type': 'application/json' };
const ENV = { RESEND_API_KEY: 're_test' };
const GOOD = { name: 'Jane Doe', email: 'jane@example.com', subject: 'Mitmachen', message: 'Hi, ich will mitmachen!' };
const post = (body, env = ENV) => app.request('/api/contact', {
  method: 'POST', headers: json, body: JSON.stringify(body),
}, env);

describe('contact endpoint', () => {
  it('rejects missing fields and invalid email with 400', async () => {
    for (const body of [
      { ...GOOD, name: '' },
      { ...GOOD, email: 'not-an-email' },
      { ...GOOD, subject: '' },
      { ...GOOD, message: '' },
    ]) {
      const res = await post(body);
      expect(res.status).toBe(400);
    }
  });

  it('honeypot succeeds without sending', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await post({ ...GOOD, website: 'http://spam.example' });
      expect(res.status).toBe(200);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('sends to the club address with reply-to sender', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'mail-1' }) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await post(GOOD);
      expect(res.status).toBe(200);
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.resend.com/emails');
      const body = JSON.parse(opts.body);
      expect(body.to).toBe('archerfilmstudios@gmail.com');
      expect(body.reply_to).toBe('jane@example.com');
      expect(body.subject).toContain('Mitmachen');
      expect(body.text).toContain('Jane Doe');
      expect(body.text).toContain('Hi, ich will mitmachen!');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('without API key gives 503', async () => {
    const res = await post(GOOD, {});
    expect(res.status).toBe(503);
  });

  it('Resend failure gives 502', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await post(GOOD);
      expect(res.status).toBe(502);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
