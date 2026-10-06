import { describe, expect, it, vi } from 'vitest';
import app from '../src/index.js';

const MEMBER_SESSION = { id: 's-m', user_id: 'u-1', expires_at: '2030-01-01T00:00:00Z', is_admin: 0, is_kassier: 0 };
const ADMIN = { id: 's-a', user_id: 'u-9', expires_at: '2030-01-01T00:00:00Z', is_admin: 1, is_kassier: 0 };
const WRITER = { id: 's-w', user_id: 'u-7', expires_at: '2030-01-01T00:00:00Z', is_admin: 0, is_kassier: 0 };
const mem = { Cookie: 'app-session=s-m' };
const adm = { Cookie: 'app-session=s-a' };
const wrt = { Cookie: 'app-session=s-w' };

const DOC = { id: 'min-1', title: 'Sitzung Oktober', r2_key: 'minutes/min-1.pdf', uploaded_by: 'u-7', created_at: '2026-10-05T00:00:00Z' };

function fakeDb({ session = MEMBER_SESSION, links = [], docRow = DOC, docs = [DOC], runLog = null } = {}) {
  let inserted = null;
  return {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          if (sql.includes('FROM sessions')) return session;
          if (sql.includes('FROM minutes') && sql.includes('id = ?')) return inserted ?? docRow;
          return null;
        },
        all: async () => {
          if (sql.includes('FROM minutes')) return { results: inserted ? [inserted, ...docs] : docs };
          if (sql.includes('FROM vorstand_links')) return { results: links };
          return { results: [] };
        },
        run: async () => {
          if (sql.startsWith('INSERT INTO minutes')) inserted = { id: args[0], title: args[1], created_at: args[4] };
          runLog?.(sql, args);
          return {};
        },
      }),
      all: async () => {
        if (sql.includes('FROM minutes')) return { results: docs };
        if (sql.includes('FROM vorstand_links')) return { results: links };
        return { results: [] };
      },
    }),
  };
}

const fakeR2 = () => ({
  put: vi.fn().mockResolvedValue({}),
  get: vi.fn(),
  delete: vi.fn().mockResolvedValue({}),
});
const pdfBody = new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer;
const pdfHeaders = { 'Content-Type': 'application/pdf' };

describe('mitschriften', () => {
  it('anon gets 401, member lists docs', async () => {
    const anon = await app.request('/api/minutes', {}, { DB: fakeDb() });
    expect(anon.status).toBe(401);
    const res = await app.request('/api/minutes', { headers: mem }, { DB: fakeDb() });
    expect(res.status).toBe(200);
    const { minutes, canUpload } = (await res.json()).data;
    expect(minutes).toHaveLength(1);
    expect(minutes[0].title).toBe('Sitzung Oktober');
    expect(canUpload).toBe(false);
  });

  it('admin and linked schriftfuehrer may upload, plain member gets 403', async () => {
    const denied = await app.request('/api/minutes?title=Test', {
      method: 'POST', headers: { ...mem, ...pdfHeaders }, body: pdfBody,
    }, { DB: fakeDb(), AVATARS: fakeR2() });
    expect(denied.status).toBe(403);
    const r2 = fakeR2();
    const adminRes = await app.request('/api/minutes?title=Test', {
      method: 'POST', headers: { ...adm, ...pdfHeaders }, body: pdfBody,
    }, { DB: fakeDb({ session: ADMIN, docRow: { ...DOC, id: 'min-9' } }), AVATARS: r2 });
    expect(adminRes.status).toBe(201);
    expect((await adminRes.json()).data.minute.title).toBe('Test');
    expect(r2.put).toHaveBeenCalled();
    const writerRes = await app.request('/api/minutes?title=Test', {
      method: 'POST', headers: { ...wrt, ...pdfHeaders }, body: pdfBody,
    }, {
      DB: fakeDb({ session: WRITER, links: [{ user_id: 'u-7' }], docRow: { ...DOC, id: 'min-8' } }),
      AVATARS: fakeR2(),
    });
    expect(writerRes.status).toBe(201);
  });

  it('rejects missing title, non-PDF and oversize with 400/415/413', async () => {
    const noTitle = await app.request('/api/minutes', {
      method: 'POST', headers: { ...adm, ...pdfHeaders }, body: pdfBody,
    }, { DB: fakeDb({ session: ADMIN }), AVATARS: fakeR2() });
    expect(noTitle.status).toBe(400);
    const badType = await app.request('/api/minutes?title=Test', {
      method: 'POST', headers: { ...adm, 'Content-Type': 'application/msword' }, body: 'x',
    }, { DB: fakeDb({ session: ADMIN }), AVATARS: fakeR2() });
    expect(badType.status).toBe(415);
    const big = new Uint8Array(11 * 1024 * 1024).buffer;
    const tooBig = await app.request('/api/minutes?title=Test', {
      method: 'POST', headers: { ...adm, ...pdfHeaders }, body: big,
    }, { DB: fakeDb({ session: ADMIN }), AVATARS: fakeR2() });
    expect(tooBig.status).toBe(413);
  });

  it('delete by stranger gives 403, by uploader deletes row and object', async () => {
    const stranger = await app.request('/api/minutes/min-1', {
      method: 'DELETE', headers: mem,
    }, { DB: fakeDb({ docRow: { ...DOC, uploaded_by: 'u-other' } }) });
    expect(stranger.status).toBe(403);
    const r2 = fakeR2();
    const mine = await app.request('/api/minutes/min-1', {
      method: 'DELETE', headers: wrt,
    }, { DB: fakeDb({ session: WRITER, docRow: DOC }), AVATARS: r2 });
    expect(mine.status).toBe(200);
    expect(r2.delete).toHaveBeenCalledWith('minutes/min-1.pdf');
    const missing = await app.request('/api/minutes/nope', {
      method: 'DELETE', headers: adm,
    }, { DB: fakeDb({ session: ADMIN, docRow: null }), AVATARS: fakeR2() });
    expect(missing.status).toBe(404);
  });

  it('file download requires login and serves the object', async () => {
    const anon = await app.request('/api/minutes/min-1/file', {}, { DB: fakeDb() });
    expect(anon.status).toBe(401);
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const r2 = { put: vi.fn(), get: vi.fn().mockResolvedValue({ body: bytes, httpMetadata: { contentType: 'application/pdf' } }), delete: vi.fn() };
    const res = await app.request('/api/minutes/min-1/file', { headers: mem }, { DB: fakeDb(), AVATARS: r2 });
    expect(res.status).toBe(200);
    expect(r2.get).toHaveBeenCalledWith('minutes/min-1.pdf');
    const missing = await app.request('/api/minutes/nope/file', { headers: mem }, { DB: fakeDb({ docRow: null }), AVATARS: fakeR2() });
    expect(missing.status).toBe(404);
  });
});
