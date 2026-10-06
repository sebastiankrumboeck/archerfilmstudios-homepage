import { describe, expect, it } from 'vitest';
import app from '../src/index.js';

const emptyDb = () => ({
  prepare: () => ({
    bind: () => ({
      first: async () => null,
      all: async () => ({ results: [] }),
      run: async () => ({}),
    }),
  }),
});
const env = () => ({ DB: emptyDb() });

describe('https enforcement', () => {
  it('redirects plain-http to https preserving path', async () => {
    const res = await app.request('http://archerfilmstudios.com/api/me', {}, env());
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('https://archerfilmstudios.com/api/me');
  });

  it('leaves localhost http alone', async () => {
    const res = await app.request('http://localhost/api/me', {}, env());
    expect(res.status).not.toBe(308);
  });

  it('trusts proxy scheme headers (no loop behind flexible TLS)', async () => {
    const cf = await app.request('http://archerfilmstudios.com/api/me', { headers: { 'CF-Visitor': '{"scheme":"https"}' } }, env());
    expect(cf.status).not.toBe(308);
    const fwd = await app.request('http://archerfilmstudios.com/api/me', { headers: { 'X-Forwarded-Proto': 'https' } }, env());
    expect(fwd.status).not.toBe(308);
  });
});
