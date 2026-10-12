import { describe, expect, it, vi } from 'vitest';
import app from '../src/index.js';

const SESSIONS = {
  's-m': { id: 's-m', user_id: 'u-1', expires_at: '2030-01-01T00:00:00.000Z', is_admin: 0, is_kassier: 0, is_vorstand: 0 },
  's-n': { id: 's-n', user_id: 'u-2', expires_at: '2030-01-01T00:00:00.000Z', is_admin: 0, is_kassier: 0, is_vorstand: 0 },
};

function makeState() {
  return {
    users: [
      { id: 'u-1', email: 'm@x.at', name: 'Max' },
      { id: 'u-2', email: 'n@x.at', name: 'Nina' },
    ],
    ideas: [],
    r2: new Map(),
  };
}

function fakeDb(state) {
  const handlers = {
    first: async (sql, args) => {
      if (sql.includes('FROM sessions')) return SESSIONS[args[0]] ?? null;
      if (sql.includes('FROM ideas') && sql.includes('id = ?')) return state.ideas.find((i) => i.id === args[0]) ?? null;
      return null;
    },
    all: async (sql, args) => {
      if (sql.includes('FROM ideas')) {
        const rows = args.length ? state.ideas.filter((i) => i.created_by === args[0]) : [...state.ideas];
        return { results: rows };
      }
      return { results: [] };
    },
    run: async (sql, args) => {
      if (sql.startsWith('INSERT INTO ideas')) {
        state.ideas.push({ id: args[0], title: args[1], author_name: args[2], script_r2_key: null, created_by: args[4], created_at: args[5] });
        return { meta: { changes: 1 } };
      }
      if (sql.startsWith('UPDATE ideas SET script_r2_key')) {
        const row = state.ideas.find((i) => i.id === args[1]);
        if (row) row.script_r2_key = args[0];
        return { meta: { changes: row ? 1 : 0 } };
      }
      return {};
    },
  };
  return {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: () => handlers.first(sql, args),
        all: () => handlers.all(sql, args),
        run: () => handlers.run(sql, args),
      }),
    }),
    batch: async (stmts) => {
      const out = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    },
  };
}

function fakeR2(state) {
  return {
    put: async (key, buf, opts) => {
      state.r2.set(key, { buf: Buffer.from(buf), contentType: opts?.httpMetadata?.contentType });
      return {};
    },
    get: async (key) => {
      const obj = state.r2.get(key);
      if (!obj) return null;
      return { body: obj.buf, httpMetadata: { contentType: obj.contentType } };
    },
  };
}

function envWith(state, extra = {}) {
  return { DB: fakeDb(state), AVATARS: fakeR2(state), RESEND_API_KEY: 're_test', ...extra };
}

async function jsonRequest(state, path, session, method, body, extra) {
  return app.request(path, {
    method,
    headers: { Cookie: `app-session=${session}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, envWith(state, extra));
}

async function pdfRequest(state, path, session, bytes, contentType = 'application/pdf', extra) {
  return app.request(path, {
    method: 'POST',
    headers: { Cookie: `app-session=${session}`, 'Content-Type': contentType },
    body: bytes,
  }, envWith(state, extra));
}

const PDF = Buffer.from('%PDF-1.4 fake script');

describe('ideas inbox', () => {
  it('creates with title+author; missing/over-long fields are German 400', async () => {
    const state = makeState();
    const res = await jsonRequest(state, '/api/ideas', 's-m', 'POST', { title: 'Nachtschicht', author_name: 'Max M.' });
    expect(res.status).toBe(201);
    expect((await res.json()).data.idea).toMatchObject({ title: 'Nachtschicht', author_name: 'Max M.' });
    const missing = await jsonRequest(state, '/api/ideas', 's-m', 'POST', { title: '', author_name: 'x' });
    expect(missing.status).toBe(400);
    const long = await jsonRequest(state, '/api/ideas', 's-m', 'POST', { title: 't'.repeat(151), author_name: 'x' });
    expect(long.status).toBe(400);
    expect((await long.json()).error).toMatch(/150|lang/i);
  });

  it('rejects non-PDF with German 415 and oversized PDF with German 413', async () => {
    const state = makeState();
    const { data } = await (await jsonRequest(state, '/api/ideas', 's-m', 'POST', { title: 'T', author_name: 'A' })).json();
    const wrongType = await pdfRequest(state, `/api/ideas/${data.idea.id}/script`, 's-m', Buffer.from('png'), 'image/png');
    expect(wrongType.status).toBe(415);
    const huge = await pdfRequest(state, `/api/ideas/${data.idea.id}/script`, 's-m', Buffer.alloc(40 * 1024 * 1024 + 1));
    expect(huge.status).toBe(413);
    expect((await huge.json()).error).toMatch(/40 MB/);
    expect(state.r2.size).toBe(0);
  });

  it('upload stores under scripts key and mails title/author/link to club address', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const state = makeState();
      const { data } = await (await jsonRequest(state, '/api/ideas', 's-m', 'POST', { title: 'Nachtschicht', author_name: 'Max M.' })).json();
      const res = await pdfRequest(state, `/api/ideas/${data.idea.id}/script`, 's-m', PDF);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.email).toMatchObject({ sent: true });
      expect([...state.r2.keys()]).toEqual([`scripts/${data.idea.id}.pdf`]);
      const mail = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(mail.to).toBe('archerfilmstudios@gmail.com');
      expect(mail.subject).toContain('Nachtschicht');
      expect(mail.text).toContain('Max M.');
      expect(mail.text).toContain(`/scripts/${data.idea.id}.pdf`);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('stores without API key and reports sent:false; strangers cannot upload', async () => {
    const state = makeState();
    const { data } = await (await jsonRequest(state, '/api/ideas', 's-m', 'POST', { title: 'T', author_name: 'A' })).json();
    const res = await pdfRequest(state, `/api/ideas/${data.idea.id}/script`, 's-m', PDF, 'application/pdf', { RESEND_API_KEY: undefined });
    expect(res.status).toBe(200);
    expect((await res.json()).data.email).toMatchObject({ sent: false });
    expect(state.r2.size).toBe(1);
    const stranger = await pdfRequest(state, `/api/ideas/${data.idea.id}/script`, 's-n', PDF);
    expect(stranger.status).toBe(403);
  });

  it('re-upload replaces the file and re-sends the mail', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const state = makeState();
      const { data } = await (await jsonRequest(state, '/api/ideas', 's-m', 'POST', { title: 'T', author_name: 'A' })).json();
      await pdfRequest(state, `/api/ideas/${data.idea.id}/script`, 's-m', PDF);
      const res = await pdfRequest(state, `/api/ideas/${data.idea.id}/script`, 's-m', Buffer.from('%PDF-1.4 v2'));
      expect(res.status).toBe(200);
      expect(state.r2.get(`scripts/${data.idea.id}.pdf`).buf.toString()).toContain('v2');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('mine lists only own ideas; download needs login and a known key', async () => {
    const state = makeState();
    await jsonRequest(state, '/api/ideas', 's-m', 'POST', { title: 'Mine', author_name: 'A' });
    await jsonRequest(state, '/api/ideas', 's-n', 'POST', { title: 'Theirs', author_name: 'B' });
    const mine = await app.request('/api/ideas/mine', { headers: { Cookie: 'app-session=s-m' } }, envWith(state));
    expect(mine.status).toBe(200);
    expect((await mine.json()).data.ideas.map((i) => i.title)).toEqual(['Mine']);
    const anon = await app.request('/scripts/whatever.pdf', {}, envWith(state));
    expect(anon.status).toBe(401);
    const missing = await app.request('/scripts/whatever.pdf', { headers: { Cookie: 'app-session=s-m' } }, envWith(state));
    expect(missing.status).toBe(404);
  });
});
