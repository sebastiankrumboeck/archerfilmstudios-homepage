import { describe, expect, it, vi } from 'vitest';
import app from '../src/index.js';

const MEMBER_SESSION = { id: 's-m', user_id: 'u-1', expires_at: '2030-01-01T00:00:00Z', is_admin: 0, is_kassier: 0 };
const ADMIN = { id: 's-a', user_id: 'u-9', expires_at: '2030-01-01T00:00:00Z', is_admin: 1, is_kassier: 0 };
const mem = { Cookie: 'app-session=s-m' };
const adm = { Cookie: 'app-session=s-a' };

const PROJECT = { id: 'p1', title: 'Shoot' };
const PHOTO = { id: 'ph-1', project_id: 'p1', r2_key: 'galleries/p1-123.jpg', uploaded_by: 'u-1', created_at: '2026-10-01T00:00:00Z' };

function fakeDb({ session = MEMBER_SESSION, project = PROJECT, member = true, photos = [PHOTO], photoRow = PHOTO, runLog = null, count = 1 } = {}) {
  return {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          if (sql.includes('FROM sessions')) return session;
          if (sql.includes('COUNT(*)')) return { n: count };
          if (sql.includes('FROM projects') && sql.includes('id = ?')) return project;
          if (sql.includes('FROM memberships')) return member ? { project_id: 'p1', user_id: 'u-1' } : null;
          if (sql.includes('FROM project_photos') && sql.includes('id = ?')) return photoRow;
          return null;
        },
        all: async () => {
          if (sql.includes('FROM project_photos')) return { results: photos };
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

const fakeR2 = () => ({ put: vi.fn().mockResolvedValue({}), get: vi.fn(), delete: vi.fn().mockResolvedValue({}) });
const imgBody = new Uint8Array([0xff, 0xd8, 0xff, 0x00]).buffer;
const imgHeaders = { 'Content-Type': 'image/jpeg' };

describe('project photos', () => {
  it('member lists photos of a project', async () => {
    const res = await app.request('/api/projects/p1/photos', { headers: mem }, { DB: fakeDb() });
    expect(res.status).toBe(200);
    const { photos } = (await res.json()).data;
    expect(photos).toHaveLength(1);
    expect(photos[0]).toEqual({ id: 'ph-1', r2_key: 'galleries/p1-123.jpg', uploaded_by: 'u-1', created_at: '2026-10-01T00:00:00Z' });
  });

  it('unknown project photos give 404', async () => {
    const res = await app.request('/api/projects/nope/photos', { headers: mem }, { DB: fakeDb({ project: null }) });
    expect(res.status).toBe(404);
  });

  it('non-member upload gives 403, joined member gets 201, admin gets 201', async () => {
    const denied = await app.request('/api/projects/p1/photos', {
      method: 'POST', headers: { ...mem, ...imgHeaders }, body: imgBody,
    }, { DB: fakeDb({ member: false }), AVATARS: fakeR2() });
    expect(denied.status).toBe(403);
    const r2 = fakeR2();
    const okRes = await app.request('/api/projects/p1/photos', {
      method: 'POST', headers: { ...mem, ...imgHeaders }, body: imgBody,
    }, { DB: fakeDb({ photoRow: { ...PHOTO, id: 'ph-9' } }), AVATARS: r2 });
    expect(okRes.status).toBe(201);
    expect((await okRes.json()).data.photo.project_id).toBe('p1');
    expect(r2.put).toHaveBeenCalled();
    const adminRes = await app.request('/api/projects/p1/photos', {
      method: 'POST', headers: { ...adm, ...imgHeaders }, body: imgBody,
    }, { DB: fakeDb({ session: ADMIN, member: false, photoRow: { ...PHOTO, id: 'ph-8' } }), AVATARS: fakeR2() });
    expect(adminRes.status).toBe(201);
  });

  it('rejects non-images with 415 and oversize with 413', async () => {
    const badType = await app.request('/api/projects/p1/photos', {
      method: 'POST', headers: { ...mem, 'Content-Type': 'text/plain' }, body: 'hello',
    }, { DB: fakeDb(), AVATARS: fakeR2() });
    expect(badType.status).toBe(415);
    const big = new Uint8Array(3 * 1024 * 1024).buffer;
    const tooBig = await app.request('/api/projects/p1/photos', {
      method: 'POST', headers: { ...mem, ...imgHeaders }, body: big,
    }, { DB: fakeDb(), AVATARS: fakeR2() });
    expect(tooBig.status).toBe(413);
  });

  it('31st photo gives 400', async () => {
    const res = await app.request('/api/projects/p1/photos', {
      method: 'POST', headers: { ...mem, ...imgHeaders }, body: imgBody,
    }, { DB: fakeDb({ count: 30 }), AVATARS: fakeR2() });
    expect(res.status).toBe(400);
  });

  it('delete by stranger gives 403, by uploader gives 200, unknown gives 404', async () => {
    const stranger = await app.request('/api/photos/ph-1', {
      method: 'DELETE', headers: mem,
    }, { DB: fakeDb({ photoRow: { ...PHOTO, uploaded_by: 'u-other' } }) });
    expect(stranger.status).toBe(403);
    const r2del = fakeR2();
    const mine = await app.request('/api/photos/ph-1', {
      method: 'DELETE', headers: mem,
    }, { DB: fakeDb(), AVATARS: r2del });
    expect(mine.status).toBe(200);
    expect(r2del.delete).toHaveBeenCalledWith('galleries/p1-123.jpg');
    const adminDel = await app.request('/api/photos/ph-1', {
      method: 'DELETE', headers: adm,
    }, { DB: fakeDb({ session: ADMIN, photoRow: { ...PHOTO, uploaded_by: 'u-other' } }), AVATARS: fakeR2() });
    expect(adminDel.status).toBe(200);
    const missing = await app.request('/api/photos/nope', {
      method: 'DELETE', headers: adm,
    }, { DB: fakeDb({ session: ADMIN, photoRow: null }) });
    expect(missing.status).toBe(404);
  });

  it('deleting a project deletes its photo rows', async () => {
    const ran = [];
    const res = await app.request('/api/projects/p1', {
      method: 'DELETE', headers: adm,
    }, { DB: fakeDb({ session: ADMIN, runLog: (sql, args) => ran.push([sql, args]) }) });
    expect(res.status).toBe(200);
    expect(ran.some(([sql]) => sql.includes('DELETE FROM project_photos'))).toBe(true);
  });

  it('gallery serves stored objects publicly', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const r2 = { put: vi.fn(), get: vi.fn().mockResolvedValue({ body: bytes, httpMetadata: { contentType: 'image/jpeg' } }) };
    const res = await app.request('/gallery/p1-123.jpg', {}, { DB: fakeDb(), AVATARS: r2 });
    expect(res.status).toBe(200);
    expect(r2.get).toHaveBeenCalledWith('galleries/p1-123.jpg');
  });
});
