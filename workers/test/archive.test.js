import { describe, expect, it, vi } from 'vitest';
import app from '../src/index.js';

const ADMIN = { id: 's-a', user_id: 'u-9', expires_at: '2030-01-01T00:00:00Z', is_admin: 1, is_kassier: 0 };
const VORSTAND = { id: 's-v', user_id: 'u-7', expires_at: '2030-01-01T00:00:00Z', is_admin: 0, is_kassier: 0, is_vorstand: 1 };
const MEMBER_SESSION = { id: 's-m', user_id: 'u-1', expires_at: '2030-01-01T00:00:00Z', is_admin: 0, is_kassier: 0, is_vorstand: 0 };
const adm = { Cookie: 'app-session=s-a' };
const vor = { Cookie: 'app-session=s-v' };
const mem = { Cookie: 'app-session=s-m' };

const DOC = { id: 'doc-1', title: 'Statuten', r2_key: 'documents/doc-1.pdf', content_type: 'application/pdf', uploaded_by: 'u-9', created_at: '2026-01-05T00:00:00Z' };

function fakeDb({ session = VORSTAND, docRow = DOC, docs = [DOC] } = {}) {
  let inserted = null;
  return {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          if (sql.includes('FROM sessions')) return session;
          if (sql.includes('FROM documents') && sql.includes('id = ?')) return inserted ?? docRow;
          return null;
        },
        all: async () => {
          if (sql.includes('FROM documents')) return { results: inserted ? [inserted, ...docs] : docs };
          return { results: [] };
        },
        run: async () => {
          if (sql.startsWith('INSERT INTO documents')) {
            inserted = { id: args[0], title: args[1], r2_key: args[2], content_type: args[3], uploaded_by: args[4], created_at: args[5] };
          }
          return {};
        },
      }),
      all: async () => {
        if (sql.includes('FROM documents')) return { results: docs };
        return { results: [] };
      },
    }),
  };
}

const fakeR2 = () => ({ put: vi.fn().mockResolvedValue({}), get: vi.fn(), delete: vi.fn().mockResolvedValue({}) });
const pdfBody = new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer;

describe('vorstand archive', () => {
  it('board member lists documents without r2 keys', async () => {
    const seen = [];
    const inner = fakeDb();
    const db = { prepare: (sql) => { seen.push(sql); return inner.prepare(sql); } };
    const res = await app.request('/api/archive', { headers: vor }, { DB: db });
    expect(res.status).toBe(200);
    const { documents } = (await res.json()).data;
    expect(documents).toHaveLength(1);
    expect(documents[0].title).toBe('Statuten');
    expect(seen.some((sql) => sql.includes('FROM documents') && !sql.includes('r2_key') && !sql.includes('*'))).toBe(true);
  });

  it('plain member gets 403 on all four endpoints', async () => {
    const db = fakeDb({ session: MEMBER_SESSION });
    expect((await app.request('/api/archive', { headers: mem }, { DB: db })).status).toBe(403);
    expect((await app.request('/api/archive?title=X', { method: 'POST', headers: { ...mem, 'Content-Type': 'application/pdf' }, body: pdfBody }, { DB: db, AVATARS: fakeR2() })).status).toBe(403);
    expect((await app.request('/api/archive/doc-1', { method: 'DELETE', headers: mem }, { DB: db })).status).toBe(403);
    expect((await app.request('/api/archive/doc-1/file', { headers: mem }, { DB: db })).status).toBe(403);
  });

  it('admin upload stores with mapped extension', async () => {
    const r2 = fakeR2();
    const docxBody = new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer;
    const res = await app.request('/api/archive?title=Vertrag', {
      method: 'POST', headers: { ...adm, 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }, body: docxBody,
    }, { DB: fakeDb({ session: ADMIN, docRow: { ...DOC, id: 'doc-9', title: 'Vertrag' } }), AVATARS: r2 });
    expect(res.status).toBe(201);
    expect(r2.put).toHaveBeenCalled();
    const key = r2.put.mock.calls[0][0];
    expect(key.endsWith('.docx')).toBe(true);
  });

  it('rejects bad type with 415 and oversize with 413, missing title with 400', async () => {
    const db = () => fakeDb({ session: ADMIN });
    const badType = await app.request('/api/archive?title=X', {
      method: 'POST', headers: { ...adm, 'Content-Type': 'application/x-sh' }, body: 'x',
    }, { DB: db(), AVATARS: fakeR2() });
    expect(badType.status).toBe(415);
    const big = new Uint8Array(11 * 1024 * 1024).buffer;
    const tooBig = await app.request('/api/archive?title=X', {
      method: 'POST', headers: { ...adm, 'Content-Type': 'application/pdf' }, body: big,
    }, { DB: db(), AVATARS: fakeR2() });
    expect(tooBig.status).toBe(413);
    const noTitle = await app.request('/api/archive', {
      method: 'POST', headers: { ...adm, 'Content-Type': 'application/pdf' }, body: pdfBody,
    }, { DB: db(), AVATARS: fakeR2() });
    expect(noTitle.status).toBe(400);
  });

  it('delete removes row and R2 object, unknown gives 404', async () => {
    const r2 = fakeR2();
    const res = await app.request('/api/archive/doc-1', { method: 'DELETE', headers: vor }, { DB: fakeDb(), AVATARS: r2 });
    expect(res.status).toBe(200);
    expect(r2.delete).toHaveBeenCalledWith('documents/doc-1.pdf');
    const missing = await app.request('/api/archive/nope', { method: 'DELETE', headers: adm }, { DB: fakeDb({ session: ADMIN, docRow: null }), AVATARS: fakeR2() });
    expect(missing.status).toBe(404);
  });

  it('file serves stored content type, unknown gives 404', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const r2 = { put: vi.fn(), get: vi.fn().mockResolvedValue({ body: bytes, httpMetadata: { contentType: 'application/pdf' } }), delete: vi.fn() };
    const res = await app.request('/api/archive/doc-1/file', { headers: vor }, { DB: fakeDb(), AVATARS: r2 });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
    expect(r2.get).toHaveBeenCalledWith('documents/doc-1.pdf');
    const missing = await app.request('/api/archive/nope/file', { headers: vor }, { DB: fakeDb({ docRow: null }), AVATARS: fakeR2() });
    expect(missing.status).toBe(404);
  });
});
